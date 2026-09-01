import assert from 'node:assert/strict';
import test from 'node:test';
import { createStructuredLogger, structuredError } from './logger.mjs';

test('log de erro é JSON estruturado e não expõe segredos', () => {
  const lines = [];
  const logger = createStructuredLogger({
    write: line => lines.push(line),
    includeStack: false,
    clock: () => new Date('2026-09-01T12:00:00.000Z'),
  });
  logger.error('http request failed', Object.assign(new Error('Falha controlada'), { code: 'E_TEST' }), {
    method: 'POST',
    path: '/api/teste',
    password: 'não pode aparecer',
    headers: { authorization: 'Bearer segredo', accept: 'application/json' },
  });
  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]);
  assert.deepEqual({ timestamp: payload.timestamp, level: payload.level, event: payload.event, message: payload.message, code: payload.code }, {
    timestamp: '2026-09-01T12:00:00.000Z', level: 'error', event: 'http_request_failed', message: 'Falha controlada', code: 'E_TEST',
  });
  assert.equal(payload.password, '[redigido]');
  assert.equal(payload.headers.authorization, '[redigido]');
  assert.equal(payload.headers.accept, 'application/json');
  assert.equal(payload.stack, undefined);
});

test('serializador aceita falhas não lançadas como Error', () => {
  const payload = structuredError('storage_cleanup_failed', 'Falha simples', {}, { includeStack: false, clock: () => new Date('2026-09-01T12:00:00.000Z') });
  assert.equal(payload.message, 'Falha simples');
});
