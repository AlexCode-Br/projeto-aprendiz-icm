import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { applicationTables } from './database/sql-compatibility.mjs';
import { requireLocalTestDatabase } from './test-support/postgres.mjs';

const connectionString = process.env.TEST_DATABASE_URL;

test('all PostgreSQL migrations build a fresh private schema with MFA and session fields', {
  skip: !connectionString && 'defina TEST_DATABASE_URL para executar a regressão PostgreSQL',
  timeout: 30_000,
}, async () => {
  const client = new pg.Client({ connectionString: requireLocalTestDatabase(connectionString) });
  const schema = `migration_test_${randomBytes(6).toString('hex')}`;
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    for (const role of ['anon', 'authenticated']) {
      if (!(await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await client.query(`CREATE ROLE ${role} NOLOGIN`);
    }
    await client.query('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    const root = new URL('./migrations/', import.meta.url);
    for (const name of (await readdir(root)).filter(name => name.endsWith('.sql')).sort()) {
      const source = (await readFile(new URL(name, root), 'utf8')).replaceAll('projeto_aprendiz', schema);
      try { await client.query(source); }
      catch (error) { throw new Error(`${name}: ${error.message}`, { cause: error }); }
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
    const tables = await client.query('SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind=\'r\'', [schema]);
    assert.deepEqual(new Set(tables.rows.map(row => row.relname)), applicationTables);
    assert.equal(tables.rows.every(row => row.relrowsecurity), true, 'todas as tabelas privadas precisam de RLS');
    for (const role of ['anon', 'authenticated']) {
      const permissions = await client.query("SELECT has_schema_privilege($1,$2,'USAGE') AS schema_access, has_table_privilege($1,$3,'SELECT') AS challenges_access, has_table_privilege($1,$4,'SELECT') AS devices_access", [role, schema, `${schema}.manager_login_challenges`, `${schema}.manager_login_devices`]);
      assert.deepEqual(permissions.rows[0], { schema_access: false, challenges_access: false, devices_access: false });
    }
    const sessionFields = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='sessions'", [schema]);
    for (const field of ['last_seen_at', 'mfa_verified_at', 'user_agent']) assert.ok(sessionFields.rows.some(row => row.column_name === field));
    const deviceFields = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='manager_login_devices'", [schema]);
    for (const field of ['user_id', 'token_hash', 'last_seen_at', 'expires_at']) assert.ok(deviceFields.rows.some(row => row.column_name === field));
    const roleConstraint = await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass AND conname='users_role_check'", [`${schema}.users`]);
    assert.match(roleConstraint.rows[0].definition, /aluno/);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
});
