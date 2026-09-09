import { AsyncLocalStorage } from 'node:async_hooks';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeRow(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]));
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
  'school_years',
  'churches',
  'enrollments', 'attendance_sessions', 'attendance_records', 'announcements', 'announcement_attachments',
  'support_tickets', 'support_messages', 'support_ticket_events', 'dropout_events', 'student_contacts',
  'scheduled_notifications', 'profile_photos', 'push_subscriptions',
]);

function returningId(sql) {
  const match = sql.match(/^\s*INSERT\s+INTO\s+([a-z_]+)/i);
  if (!match || !tablesWithId.has(match[1].toLowerCase()) || /\bRETURNING\b/i.test(sql)) return sql;
  return `${sql} RETURNING id`;
}

export const databaseInternals = { postgresSql, returningId, normalizeRow };

class PreparedStatement {
  constructor(database, sql) { this.database = database; this.sql = sql; }
  get(...params) { return this.database.get(this.sql, params); }
  all(...params) { return this.database.all(this.sql, params); }
  run(...params) { return this.database.run(this.sql, params); }
}

class SqliteDatabase {
  constructor(database) { this.database = database; this.dialect = 'sqlite'; }
  prepare(sql) { return new PreparedStatement(this, sql); }
  async get(sql, params = []) { return normalizeRow(this.database.prepare(sql).get(...params)); }
  async all(sql, params = []) { return this.database.prepare(sql).all(...params).map(normalizeRow); }
  async run(sql, params = []) {
    const result = this.database.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid || 0) };
  }
  async exec(sql) { this.database.exec(sql); }
  async transaction(callback) {
    this.database.exec('BEGIN');
    try { const value = await callback(); this.database.exec('COMMIT'); return value; }
    catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
  async migrate() {}
  async close() { this.database.close(); }
}

class PostgresDatabase {
  constructor(pool) {
    this.pool = pool;
    this.dialect = 'postgres';
    this.transactions = new AsyncLocalStorage();
  }
  prepare(sql) { return new PreparedStatement(this, sql); }
  target() { return this.transactions.getStore() || this.pool; }
  async query(sql, params = []) { return this.target().query(postgresSql(sql), params); }
  async get(sql, params = []) { return normalizeRow((await this.query(sql, params)).rows[0]); }
  async all(sql, params = []) { return (await this.query(sql, params)).rows.map(normalizeRow); }
  async run(sql, params = []) {
    const result = await this.target().query(returningId(postgresSql(sql)), params);
    return { changes: result.rowCount, lastInsertRowid: Number(result.rows?.[0]?.id || 0) };
  }
  async exec(sql) { await this.target().query(sql); }
  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await this.transactions.run(client, callback);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async migrate() {
    await this.pool.query(`
      CREATE SCHEMA IF NOT EXISTS projeto_aprendiz;
      REVOKE ALL ON SCHEMA projeto_aprendiz FROM PUBLIC, anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA projeto_aprendiz REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA projeto_aprendiz REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const migrationRoot = join(here, 'migrations');
    const files = (await readdir(migrationRoot)).filter(name => name.endsWith('.sql')).sort();
    for (const name of files) {
      if (await this.get('SELECT name FROM projeto_aprendiz.schema_migrations WHERE name=?', [name])) continue;
      const sql = await readFile(join(migrationRoot, name), 'utf8');
      await this.transaction(async () => {
        await this.exec('SET LOCAL search_path TO projeto_aprendiz, public');
        await this.exec(sql);
        await this.run('INSERT INTO projeto_aprendiz.schema_migrations (name) VALUES (?)', [name]);
      });
    }
  }
  async close() { await this.pool.end(); }
}

export async function createDatabase({ sqlitePath, logger = console }) {
  if (process.env.DATABASE_URL) {
    const { Pool, types } = await import('pg');
    // Parse only PostgreSQL int8 values (COUNT/SUM), never text that merely
    // resembles a number such as a phone or a catalog named "2026".
    types.setTypeParser(20, value => {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : value;
    });
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Math.min(10, Math.max(1, Number(process.env.DB_POOL_SIZE || 5))),
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      options: '-c search_path=projeto_aprendiz,public -c idle_in_transaction_session_timeout=30000',
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
    });
    pool.on('error', error => logger.error('postgres_pool_error', error));
    const database = new PostgresDatabase(pool);
    await database.migrate();
    return database;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL é obrigatória em produção para evitar perda de dados.');
  }
  const { DatabaseSync } = await import('node:sqlite');
  return new SqliteDatabase(new DatabaseSync(sqlitePath));
}
