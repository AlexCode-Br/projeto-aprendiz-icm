import { AsyncLocalStorage } from 'node:async_hooks';
import { communityPostgresSchema } from './course-community-schema.mjs';
import { ensureOfferingCatalog } from './offering-catalog.mjs';
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
  'support_ticket_events', 'dropout_events', 'student_contacts', 'scheduled_notifications', 'profile_photos', 'push_subscriptions', 'notification_outbox',
  'manager_login_challenges',
]);
const applicationTables = new Set([
  'class_presentation', 'course_post_likes', 'course_post_comments',
  'student_accounts', 'student_invites', 'student_announcement_audiences', 'student_announcement_classes',
  'student_notice_deliveries',
  'student_email_changes', 'notification_outbox',
  'student_course_announcements',
  ...tablesWithId, 'user_settings', 'announcement_reads', 'announcement_recipients',
  'support_ticket_reads', 'class_schedules', 'class_schedule_dates', 'enrollment_repair_archive', 'schema_migrations',
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

// The Worker connects through Hyperdrive and intentionally does not run the
// full application migration set on every request. Keep the push table
// bootstrap narrowly scoped and idempotent so a deployment can safely enable
// Web Push even when the production migration runner is not available.
let pushSchemaReady = false;
let pushSchemaPromise = null;
let scheduleDatesSchemaReady = false;
let scheduleDatesSchemaPromise = null;
let studentPortalSchemaReady = false;
let studentPortalSchemaPromise = null;
let notificationOutboxSchemaReady = false;
let notificationOutboxSchemaPromise = null;

export function ensureNotificationOutboxSchema(database) {
  if (notificationOutboxSchemaReady) return Promise.resolve();
  if (!notificationOutboxSchemaPromise) {
    notificationOutboxSchemaPromise = database.exec(`
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.notification_outbox (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE,
        preference TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,destination TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,notification_tag TEXT NOT NULL,
        email_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_enabled IN (0,1)),
        push_enabled INTEGER NOT NULL DEFAULT 1 CHECK(push_enabled IN (0,1)),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','dead')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
        available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,lease_until TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
        ON projeto_aprendiz.notification_outbox(status,available_at,id);
      CREATE INDEX IF NOT EXISTS notification_outbox_lease_idx
        ON projeto_aprendiz.notification_outbox(status,lease_until) WHERE status='processing';
      ALTER TABLE projeto_aprendiz.notification_outbox ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE projeto_aprendiz.notification_outbox FROM PUBLIC,anon,authenticated;
      REVOKE ALL ON SEQUENCE projeto_aprendiz.notification_outbox_id_seq FROM PUBLIC,anon,authenticated;
    `).then(() => { notificationOutboxSchemaReady = true; }).catch(error => {
      notificationOutboxSchemaPromise = null;
      throw error;
    });
  }
  return notificationOutboxSchemaPromise;
}

export function ensurePushSubscriptionsSchema(database) {
  if (pushSchemaReady) return Promise.resolve();
  if (!pushSchemaPromise) {
    pushSchemaPromise = database.exec(`
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
        ON projeto_aprendiz.push_subscriptions(user_id);
      ALTER TABLE projeto_aprendiz.push_subscriptions ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE projeto_aprendiz.push_subscriptions FROM PUBLIC, anon, authenticated;
      REVOKE ALL ON SEQUENCE projeto_aprendiz.push_subscriptions_id_seq FROM PUBLIC, anon, authenticated;
    `).then(() => { pushSchemaReady = true; }).catch(error => {
      pushSchemaPromise = null;
      throw error;
    });
  }
  return pushSchemaPromise;
}

export function ensureClassScheduleDatesSchema(database) {
  if (scheduleDatesSchemaReady) return Promise.resolve();
  if (!scheduleDatesSchemaPromise) {
    scheduleDatesSchemaPromise = database.exec(`
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.class_schedule_dates (
        class_id INTEGER NOT NULL REFERENCES projeto_aprendiz.classes(id) ON DELETE CASCADE,
        class_date DATE NOT NULL,
        start_minutes SMALLINT NOT NULL CHECK(start_minutes BETWEEN 0 AND 1439),
        PRIMARY KEY(class_id, class_date, start_minutes)
      );
      ALTER TABLE projeto_aprendiz.class_schedule_dates ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE projeto_aprendiz.class_schedule_dates FROM PUBLIC, anon, authenticated;
    `).then(() => { scheduleDatesSchemaReady = true; }).catch(error => {
      scheduleDatesSchemaPromise = null;
      throw error;
    });
  }
  return scheduleDatesSchemaPromise;
}

// The production Worker cannot execute the Node migration runner. Bootstrap
// the student portal's private ownership tables here so a code deployment and
// its database contract become available atomically on every cold start.
export function ensureStudentPortalSchema(database) {
  if (studentPortalSchemaReady) return Promise.resolve();
  if (!studentPortalSchemaPromise) {
    studentPortalSchemaPromise = database.exec(`
      DO $$
      DECLARE role_constraint TEXT;
      BEGIN
        SELECT pg_get_constraintdef(oid) INTO role_constraint
        FROM pg_constraint
        WHERE conrelid='projeto_aprendiz.users'::regclass AND conname='users_role_check';
        IF role_constraint IS NULL OR POSITION('aluno' IN role_constraint)=0 THEN
          ALTER TABLE projeto_aprendiz.users DROP CONSTRAINT IF EXISTS users_role_check;
          ALTER TABLE projeto_aprendiz.users ADD CONSTRAINT users_role_check
            CHECK(role IN ('gestor','professor','aluno'));
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_accounts (
        student_id INTEGER PRIMARY KEY REFERENCES projeto_aprendiz.students(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL UNIQUE REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE
      );
      UPDATE projeto_aprendiz.enrollments
        SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP)
        WHERE status<>'ativa';
      CREATE INDEX IF NOT EXISTS enrollments_class_status_student_idx
        ON projeto_aprendiz.enrollments(class_id,status,student_id);
      CREATE INDEX IF NOT EXISTS enrollments_class_period_idx
        ON projeto_aprendiz.enrollments(class_id,enrolled_at,completed_at,student_id);
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_invites (
        token_hash TEXT PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES projeto_aprendiz.students(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_by INTEGER REFERENCES projeto_aprendiz.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS student_invites_student_idx
        ON projeto_aprendiz.student_invites(student_id);
      CREATE INDEX IF NOT EXISTS student_invites_creator_idx
        ON projeto_aprendiz.student_invites(created_by);
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_announcement_audiences (
        announcement_id INTEGER PRIMARY KEY REFERENCES projeto_aprendiz.announcements(id) ON DELETE CASCADE,
        all_students INTEGER NOT NULL DEFAULT 0 CHECK(all_students IN (0,1))
      );
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_announcement_classes (
        announcement_id INTEGER NOT NULL REFERENCES projeto_aprendiz.student_announcement_audiences(announcement_id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES projeto_aprendiz.classes(id) ON DELETE CASCADE,
        PRIMARY KEY(announcement_id,class_id)
      );
      CREATE INDEX IF NOT EXISTS student_announcement_classes_class_idx
        ON projeto_aprendiz.student_announcement_classes(class_id,announcement_id);
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_notice_deliveries (
        announcement_id INTEGER NOT NULL REFERENCES projeto_aprendiz.announcements(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE,
        lease_until TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        finished INTEGER NOT NULL DEFAULT 0 CHECK(finished IN (0,1)),
        PRIMARY KEY(announcement_id,user_id)
      );
      CREATE INDEX IF NOT EXISTS student_notice_deliveries_user_idx
        ON projeto_aprendiz.student_notice_deliveries(user_id);
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_email_changes (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE,
        old_email TEXT NOT NULL,
        new_email TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS student_email_changes_user_idx
        ON projeto_aprendiz.student_email_changes(user_id);
      CREATE TABLE IF NOT EXISTS projeto_aprendiz.student_course_announcements (
        announcement_id INTEGER PRIMARY KEY REFERENCES projeto_aprendiz.announcements(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES projeto_aprendiz.classes(id) ON DELETE CASCADE,
        requires_acknowledgement INTEGER NOT NULL DEFAULT 0 CHECK(requires_acknowledgement IN (0,1))
      );
      ALTER TABLE projeto_aprendiz.student_course_announcements
        ADD COLUMN IF NOT EXISTS requires_acknowledgement INTEGER NOT NULL DEFAULT 0
        CHECK(requires_acknowledgement IN (0,1));
      CREATE INDEX IF NOT EXISTS student_course_announcements_class_idx
        ON projeto_aprendiz.student_course_announcements(class_id,announcement_id);
      CREATE INDEX IF NOT EXISTS student_course_announcements_class_ack_idx
        ON projeto_aprendiz.student_course_announcements(class_id,requires_acknowledgement,announcement_id);
      ALTER TABLE projeto_aprendiz.student_accounts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projeto_aprendiz.student_invites ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projeto_aprendiz.student_announcement_audiences ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projeto_aprendiz.student_announcement_classes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projeto_aprendiz.student_notice_deliveries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projeto_aprendiz.student_email_changes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE projeto_aprendiz.student_course_announcements ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON TABLE projeto_aprendiz.student_accounts,projeto_aprendiz.student_invites,
        projeto_aprendiz.student_announcement_audiences,projeto_aprendiz.student_announcement_classes,
        projeto_aprendiz.student_notice_deliveries,projeto_aprendiz.student_email_changes,
        projeto_aprendiz.student_course_announcements FROM PUBLIC, anon, authenticated;
    `).then(() => database.exec(communityPostgresSchema)).then(() => ensureOfferingCatalog(database)).then(() => { studentPortalSchemaReady = true; }).catch(error => {
      studentPortalSchemaPromise = null;
      throw error;
    });
  }
  return studentPortalSchemaPromise;
}

// Instantiate inside fetch()/scheduled(), never in module scope. Hyperdrive
// owns the origin connection pool; the driver connection belongs to one request.
// Its configuration MUST have query caching disabled for auth/read-after-write.
export function createWorkerDatabase(env, options) { return new WorkerDatabase(env, options); }

export const workerDatabaseInternals = { postgresSql, returningId, normalizeRow, qualifyApplicationTables, connectionOptions, parseInt8, ensurePushSubscriptionsSchema, ensureClassScheduleDatesSchema, ensureStudentPortalSchema, ensureNotificationOutboxSchema };
