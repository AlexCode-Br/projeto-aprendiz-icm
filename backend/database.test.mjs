import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDatabase, databaseInternals } from './database.mjs';

test('converte a sintaxe compartilhada para PostgreSQL com parâmetros seguros', () => {
  const sql = databaseInternals.postgresSql("INSERT OR IGNORE INTO courses (name) VALUES (?)");
  assert.equal(sql, 'INSERT INTO courses (name) VALUES ($1) ON CONFLICT DO NOTHING');
  assert.equal(databaseInternals.postgresSql("SELECT * FROM users WHERE email LIKE ? LIMIT ?"), 'SELECT * FROM users WHERE email ILIKE $1 LIMIT $2');
  assert.equal(databaseInternals.postgresSql("SELECT GROUP_CONCAT(DISTINCT courses.name) FROM courses"), "SELECT STRING_AGG(DISTINCT courses.name, ',') FROM courses");
  assert.match(databaseInternals.returningId('INSERT INTO school_years (label) VALUES ($1)'), /RETURNING id$/);
});

test('não converte campos textuais que apenas parecem números', () => {
  const row = databaseInternals.normalizeRow({ nome: '2026', telefone: '07199990000', total: 3, created_at: new Date('2026-01-02T03:04:05Z') });
  assert.equal(row.nome, '2026');
  assert.equal(row.telefone, '07199990000');
  assert.equal(row.total, 3);
  assert.equal(row.created_at, '2026-01-02T03:04:05.000Z');
});

test('SQLite preserva transações e desfaz uma operação com erro', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-'));
  const database = await createDatabase({ sqlitePath: join(directory, 'test.db') });
  try {
    await database.exec('CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)');
    await assert.rejects(database.transaction(async () => {
      await database.prepare('INSERT INTO entries (name) VALUES (?)').run('temporário');
      throw new Error('rollback');
    }));
    assert.equal((await database.prepare('SELECT COUNT(*) AS total FROM entries').get()).total, 0);
  } finally {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
