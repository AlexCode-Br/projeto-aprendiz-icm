import assert from 'node:assert/strict';
import test from 'node:test';
import { requireLocalTestDatabase } from './test-support/postgres.mjs';

test('testes de banco aceitam somente PostgreSQL local com nome de teste', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const value = `postgresql://fake@${host}/aprendiz_test`;
    assert.equal(requireLocalTestDatabase(value), value);
  }
  for (const value of ['postgresql://fake@db.example.com/aprendiz_test', 'postgresql://fake@localhost/postgres', 'invalid']) {
    assert.throws(() => requireLocalTestDatabase(value));
  }
});
