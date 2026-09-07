import { AsyncLocalStorage } from 'node:async_hooks';
import { Client, types } from 'pg';

// Keep these compatibility rules aligned with database.mjs. This module must
// never import the Node migration/SQLite adapter into the Worker bundle.
function normalizeRow(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
}

function postgresSql(source) {
  let sql = String(source).trim().replace(/;$/, '');
  const ignoredInsert = /^INSERT\s+OR\s+IGNORE\s+/i.test(sql);
  sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+/i, 'INSERT ');
  sql = sql.replace(/\bLIKE\b/g, 'ILIKE');
  sql = sql.replace(/GROUP_CONCAT\(DISTINCT\s+([^\)]+)\)/gi, "STRING_AGG(DISTINCT $1, ',')");
  sql = sql.replace(/GROUP_CONCAT\(([^,\)]+),\s*'([^']*)'\)/gi, "STRING_AGG($1, '$2')");
  if (ignoredInsert && !/\bON\s+CONFLICT\b/i.test(sql)) sql += ' ON CONFLICT DO NOTHING';
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

const tablesWithId = new Set([
  'users', 'sessions', 'password_resets', 'dev_emails', 'audit_log', 'locations',
  'professor_profiles', 'professor_invites', 'students', 'courses', 'classes',
  'school_years', 'churches', 'enrollments', 'attendance_sessions', 'attendance_records',
  'announcements', 'announcement_attachments', 'support_tickets', 'support_messages',
  'support_ticket_events', 'dropout_events', 'student_contacts', 'scheduled_notifications', 'profile_photos',
]);
const applicationTables = new Set([
  ...tablesWithId, 'user_settings', 'announcement_reads', 'announcement_recipients',
  'support_ticket_reads', 'class_schedules', 'enrollment_repair_archive', 'schema_migrations',
]);

function returningId(sql) {
  const match = sql.match(/^\s*INSERT\s+INTO\s+(?:projeto_aprendiz\.)?([a-z_]+)/i);
  if (!match || !tablesWithId.has(match[1].toLowerCase()) || /\bRETURNING\b/i.test(sql)) return sql;
  return `${sql} RETURNING id`;
}

// Hyperdrive resets session state after each implicit transaction. Qualifying
// application tables avoids both an unsafe persistent search_path assumption
// and extra BEGIN/SET/COMMIT round trips for every ordinary query. Quoted text,
// comments, explicit schemas and aliases are preserved.
function qualifyApplicationTables(sql) {
  const tokens = String(sql).match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\$([a-zA-Z_][\w]*|)\$[\s\S]*?\$\1\$|--[^\r\n]*|\/\*[\s\S]*?\*\/|\s+|[a-zA-Z_][\w$]*|./g) || [];
  const significant = tokens.map((token, index) => ({ token, index })).filter(({ token }) => !/^\s|^--|^\/\*/.test(token));
  for (let position = 1; position < significant.length; position++) {
    const previous = significant[position - 1].token.toUpperCase();
    if (!['FROM', 'JOIN', 'UPDATE', 'INTO', 'USING'].includes(previous)) continue;
    const { token, index } = significant[position];
    const name = token.startsWith('"') ? token.slice(1, -1).replace(/""/g, '"') : token.toLowerCase();
    if (applicationTables.has(name) && significant[position + 1]?.token !== '.') tokens[index] = `projeto_aprendiz.${token}`;
  }
  return tokens.join('');
}

function parseInt8(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
}

function connectionOptions(env) {
  const hyperdrive = env.HYPERDRIVE?.connectionString;
  const connectionString = hyperdrive || env.DATABASE_URL;
  if (!connectionString) throw new Error('Configure HYPERDRIVE ou DATABASE_URL para acessar o banco PostgreSQL.');
  return {
    connectionString,
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    types: { getTypeParser: (oid, format) => Number(oid) === 20 && format !== 'binary' ? parseInt8 : types.getTypeParser(oid, format) },
    // Hyperdrive controls origin TLS itself; only direct connections use these
    // legacy deployment settings. Never pass origin credentials to the client.
    ...(!hyperdrive && {
      ssl: env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
    }),
  };
}

class PreparedStatement {
  constructor(database, sql) { this.database = database; this.sql = sql; }
  get(...params) { return this.database.get(this.sql, params); }
  all(...params) { return this.database.all(this.sql, params); }
  run(...params) { return this.database.run(this.sql, params); }
}

class WorkerDatabase {
  constructor(env, { logger = console, Client: ClientImplementation = Client } = {}) {
    this.dialect = 'postgres';
    this.env = env;
    this.logger = logger;
    this.Client = ClientImplementation;
    this.transactions = new AsyncLocalStorage();
    this.queue = Promise.resolve();
    this.clientPromise = null;
    this.closed = false;
    this.closePromise = null;
  }

  prepare(sql) { return new PreparedStatement(this, sql); }

  async client() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const client = new this.Client(connectionOptions(this.env));
        client.on('error', error => this.logger.error('worker_postgres_client_error', error));
        try { await client.connect(); }
        catch (error) { await client.end().catch(() => {}); throw error; }
        return client;
      })();
    }
    return this.clientPromise;
  }

  enqueue(operation) {
    if (this.closed) return Promise.reject(new Error('A conexão desta requisição já foi encerrada.'));
    const context = this.transactions.getStore();
    if (context) {
      if (!context.active) return Promise.reject(new Error('A transação já foi encerrada.'));
      return operation(context.client);
    }
    // A transaction owns the request's client until commit/rollback. Concurrent
    // work outside its async context must not accidentally join that transaction.
    const result = this.queue.then(async () => operation(await this.client()));
    this.queue = result.catch(() => {});
    return result;
  }

  query(sql, params = []) {
    return this.enqueue(client => client.query(qualifyApplicationTables(postgresSql(sql)), params));
  }
  async get(sql, params = []) { return normalizeRow((await this.query(sql, params)).rows[0]); }
  async all(sql, params = []) { return (await this.query(sql, params)).rows.map(normalizeRow); }
  async run(sql, params = []) {
    const result = await this.enqueue(client => client.query(qualifyApplicationTables(returningId(postgresSql(sql))), params));
    return { changes: result.rowCount, lastInsertRowid: Number(result.rows?.[0]?.id || 0) };
  }
  exec(sql) { return this.enqueue(client => client.query(qualifyApplicationTables(sql))); }

  transaction(callback) {
    if (this.transactions.getStore()) return Promise.reject(new Error('Transações aninhadas não são suportadas.'));
    return this.enqueue(async client => {
      const context = { client, active: true };
      try {
        await client.query("BEGIN; SET LOCAL search_path TO projeto_aprendiz, public; SET LOCAL idle_in_transaction_session_timeout = '30s'");
        const value = await this.transactions.run(context, callback);
        context.active = false;
        await client.query('COMMIT');
        return value;
      } catch (error) {
        context.active = false;
        try { await client.query('ROLLBACK'); }
        catch (rollbackError) { this.logger.error('worker_postgres_rollback_failed', rollbackError); }
        throw error;
      }
    });
  }

  async close() {
    if (!this.closePromise) {
      this.closed = true;
      this.closePromise = (async () => {
        await this.queue;
        if (this.clientPromise) {
          const client = await this.clientPromise.catch(() => null);
          if (client) await client.end();
        }
      })();
    }
    return this.closePromise;
  }
}

// Instantiate inside fetch()/scheduled(), never in module scope. Hyperdrive
// owns the origin connection pool; the driver connection belongs to one request.
// Its configuration MUST have query caching disabled for auth/read-after-write.
export function createWorkerDatabase(env, options) { return new WorkerDatabase(env, options); }

export const workerDatabaseInternals = { postgresSql, returningId, normalizeRow, qualifyApplicationTables, connectionOptions, parseInt8 };
