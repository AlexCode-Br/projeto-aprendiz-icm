import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkerDatabase, workerDatabaseInternals as internals } from './worker-database.mjs';
import { databaseInternals } from './database.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { applicationTables } from './database/sql-compatibility.mjs';

function fakeDriver({ respond = () => ({ rows: [], rowCount: 0 }), failConnect = false } = {}) {
  const clients = [];
  class Client {
    constructor(options) { this.options = options; this.queries = []; this.ended = 0; clients.push(this); }
    on() {}
    async connect() { if (failConnect) throw new Error('connection failed'); }
    async query(sql, params = []) { this.queries.push({ sql, params }); return respond(sql, params); }
    async end() { this.ended++; }
  }
  return { Client, clients };
}

test('Worker preserves SQL adapter semantics and numeric/text/date normalization', () => {
  for (const sql of [
    'INSERT OR IGNORE INTO courses (name) VALUES (?)',
    'SELECT * FROM users WHERE email LIKE ? LIMIT ?',
    'SELECT GROUP_CONCAT(DISTINCT courses.name) FROM courses',
    "SELECT GROUP_CONCAT(courses.name, ' / ') FROM courses",
  ]) assert.equal(internals.postgresSql(sql), databaseInternals.postgresSql(sql));
  const row = { nome: '2026', phone: '07199990000', created_at: new Date('2026-01-02T03:04:05Z') };
  assert.deepEqual(internals.normalizeRow(row), databaseInternals.normalizeRow(row));
  assert.equal(internals.parseInt8('9007199254740993'), '9007199254740993');
  assert.equal(internals.parseInt8('23'), 23);
  assert.equal(internals.returningId('INSERT INTO school_years (label) VALUES ($1)'), 'INSERT INTO school_years (label) VALUES ($1) RETURNING id');
  assert.equal(internals.returningId('INSERT INTO user_settings (user_id) VALUES ($1)'), 'INSERT INTO user_settings (user_id) VALUES ($1)');
});

test('schema qualification preserves aliases, explicit schemas, literals and comments', () => {
  assert.equal(
    internals.qualifyApplicationTables('SELECT * FROM manager_login_challenges WHERE token_hash=$1'),
    'SELECT * FROM projeto_aprendiz.manager_login_challenges WHERE token_hash=$1',
  );
  assert.equal(
    internals.qualifyApplicationTables('UPDATE manager_login_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE id=$1'),
    'UPDATE projeto_aprendiz.manager_login_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE id=$1',
  );
  for(const table of ['student_accounts','student_invites','student_announcement_audiences','student_announcement_classes','student_notice_deliveries','student_email_changes','student_course_announcements']) {
    assert.equal(internals.qualifyApplicationTables(`SELECT * FROM ${table} WHERE 1=1`),`SELECT * FROM projeto_aprendiz.${table} WHERE 1=1`);
    assert.equal(internals.returningId(`INSERT INTO ${table} (user_id) VALUES ($1)`),`INSERT INTO ${table} (user_id) VALUES ($1)`);
  }
  const sql = "SELECT users.name, 'FROM users', $$JOIN courses$$ FROM users JOIN classes c ON c.professor_id=users.id -- FROM students\nWHERE users.id IN (SELECT user_id FROM user_settings)";
  assert.equal(internals.qualifyApplicationTables(sql), "SELECT users.name, 'FROM users', $$JOIN courses$$ FROM projeto_aprendiz.users JOIN projeto_aprendiz.classes c ON c.professor_id=users.id -- FROM students\nWHERE users.id IN (SELECT user_id FROM projeto_aprendiz.user_settings)");
  assert.equal(internals.qualifyApplicationTables('SELECT * FROM public.users JOIN "classes" ON true'), 'SELECT * FROM public.users JOIN projeto_aprendiz."classes" ON true');
  assert.equal(internals.qualifyApplicationTables('DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions)'), 'DELETE FROM projeto_aprendiz.attendance_records WHERE session_id IN (SELECT id FROM projeto_aprendiz.attendance_sessions)');
});

test('lazy request clients prefer Hyperdrive, clean up once and cannot cross requests', async () => {
  const driver = fakeDriver({ respond: () => ({ rows: [{ id: 12, name: '2026' }], rowCount: 1 }) });
  const env = { HYPERDRIVE: { connectionString: 'postgres://hyperdrive/db' }, DATABASE_URL: 'postgres://origin/db' };
  const first = createWorkerDatabase(env, driver);
  const second = createWorkerDatabase(env, driver);
  assert.equal(driver.clients.length, 0);
  assert.deepEqual(await first.prepare('INSERT INTO students (name) VALUES (?)').run('2026'), { changes: 1, lastInsertRowid: 12 });
  assert.equal(await second.prepare('SELECT name FROM students WHERE id=?').get(12).then(row => row.name), '2026');
  assert.equal(driver.clients.length, 2);
  assert.equal(driver.clients[0].options.connectionString, 'postgres://hyperdrive/db');
  assert.equal('ssl' in driver.clients[0].options, false);
  assert.deepEqual(driver.clients[0].queries[0], { sql: 'INSERT INTO projeto_aprendiz.students (name) VALUES ($1) RETURNING id', params: ['2026'] });
  await Promise.all([first.close(), first.close(), second.close()]);
  assert.deepEqual(driver.clients.map(client => client.ended), [1, 1]);
  await assert.rejects(first.get('SELECT 1'), /encerrada/);
});

test('transaction rollback stays on its client and does not include concurrent outside work', async () => {
  const driver = fakeDriver();
  const database = createWorkerDatabase({ DATABASE_URL: 'postgres://localhost/db', DATABASE_SSL: 'false' }, driver);
  let release;
  let entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const transaction = database.transaction(async () => {
    await database.run('UPDATE students SET active=? WHERE id=?', [0, 1]);
    entered();
    await blocked;
    throw new Error('deliberate rollback');
  });
  await enteredPromise;
  const outside = database.get('SELECT name FROM students WHERE id=?', [1]);
  release();
  await assert.rejects(transaction, /deliberate rollback/);
  await outside;
  const queries = driver.clients[0].queries.map(query => query.sql);
  assert.match(queries[0], /^BEGIN; SET LOCAL search_path TO projeto_aprendiz, public/);
  assert.deepEqual(queries.slice(1), ['UPDATE projeto_aprendiz.students SET active=$1 WHERE id=$2', 'ROLLBACK', 'SELECT name FROM projeto_aprendiz.students WHERE id=$1']);
  await database.close();
});

test('successful transaction commits, nested transaction fails and connection failures clean up', async () => {
  const driver = fakeDriver();
  const database = createWorkerDatabase({ DATABASE_URL: 'postgres://localhost/db' }, driver);
  assert.equal(await database.transaction(async () => { await database.run('DELETE FROM sessions WHERE id=?', [1]); return 7; }), 7);
  assert.equal(driver.clients[0].queries.at(-1).sql, 'COMMIT');
  await assert.rejects(database.transaction(() => database.transaction(async () => {})), /aninhadas/);
  assert.equal(driver.clients[0].queries.at(-1).sql, 'ROLLBACK');
  await database.close();

  const failedDriver = fakeDriver({ failConnect: true });
  const failed = createWorkerDatabase({ DATABASE_URL: 'postgres://localhost/db' }, failedDriver);
  await assert.rejects(failed.get('SELECT 1'), /connection failed/);
  await failed.close();
  assert.equal(failedDriver.clients[0].ended, 1);
  const unused = createWorkerDatabase({}, driver);
  await unused.close();
  assert.throws(() => internals.connectionOptions({}), /Configure HYPERDRIVE/);
});

test('every migrated table uses the same private SQL registry in Node and Worker', async () => {
  const root = new URL('./migrations/', import.meta.url);
  for (const name of (await readdir(root)).filter(name => name.endsWith('.sql'))) {
    const source = await readFile(new URL(name, root), 'utf8');
    for (const match of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:projeto_aprendiz\.)?([a-z_]+)/gi)) {
      const table = match[1];
      assert.ok(applicationTables.has(table), `${name}: register ${table} in sql-compatibility.mjs`);
      const sql = `SELECT * FROM ${table} WHERE id=?`;
      assert.equal(internals.qualifyApplicationTables(sql), `SELECT * FROM projeto_aprendiz.${table} WHERE id=?`);
      assert.equal(databaseInternals.qualifyApplicationTables(sql), internals.qualifyApplicationTables(sql));
    }
  }
  assert.equal(databaseInternals.postgresSql, internals.postgresSql);
  assert.equal(databaseInternals.returningId, internals.returningId);
});
