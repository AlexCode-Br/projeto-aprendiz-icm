import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { createHttpSecurity, createSlidingWindowRateLimiter, opaqueRateLimitKey, readJson } from './security.mjs';

test('JSON é limitado em bytes e precisa ser um objeto válido', async () => {
  assert.deepEqual(await readJson(Readable.from(['{"ok":true}'])), { ok: true });
  await assert.rejects(
    readJson(Readable.from([Buffer.from('{"texto":"áá"}', 'utf8')]), 14),
    error => error.code === 'PAYLOAD_TOO_LARGE',
  );
  for (const invalid of ['{"incompleto":', 'null', '"texto"', '42', '[]']) {
    await assert.rejects(
      readJson(Readable.from([invalid])),
      error => error.code === 'INVALID_JSON',
    );
  }
});

test('cookie malformado é ignorado sem descartar os pares válidos', () => {
  const { cookies } = createHttpSecurity({ isProduction: false, appOrigin: 'http://localhost' });
  const request = { headers: { cookie: 'pa_session=sessao%20valida; quebrado=%; tema=claro' } };
  assert.deepEqual(cookies(request), { pa_session: 'sessao valida', tema: 'claro' });
});

test('cookie de sessão não define Max-Age quando o login não é persistente', () => {
  const { cookie } = createHttpSecurity({ isProduction: false, appOrigin: 'http://localhost' });
  assert.equal(cookie('pa_session', 'token', null), 'pa_session=token; Path=/; HttpOnly; SameSite=Strict');
  assert.match(cookie('pa_session', 'token', 30), /Max-Age=30/);
});

test('limitador usa janela deslizante e libera após o período', () => {
  let now = 1_000;
  const limiter = createSlidingWindowRateLimiter({ clock: () => now });
  const policy = { key: 'login:email', limit: 2, windowMs: 1_000 };

  assert.equal(limiter.consume(policy).blocked, false);
  now = 1_500;
  assert.equal(limiter.consume(policy).blocked, false);
  now = 1_600;
  const blocked = limiter.consume(policy);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.retryAfterMs, 400);

  now = 2_001;
  assert.equal(limiter.consume(policy).blocked, false);
});

test('limites por IP e e-mail permanecem independentes', () => {
  const limiter = createSlidingWindowRateLimiter({ clock: () => 10_000 });
  const emailKey = opaqueRateLimitKey('auth:login:email', 'Pessoa@Exemplo.com');
  const sameEmailKey = opaqueRateLimitKey('auth:login:email', ' pessoa@exemplo.com ');
  const ipKey = opaqueRateLimitKey('auth:login:ip', '127.0.0.1');
  assert.equal(emailKey, sameEmailKey);
  assert.notEqual(emailKey, ipKey);
  assert.doesNotMatch(emailKey, /pessoa|exemplo/i);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(limiter.consume({ key: emailKey, limit: 5, windowMs: 60_000 }).blocked, false);
  }
  assert.equal(limiter.consume({ key: emailKey, limit: 5, windowMs: 60_000 }).blocked, true);
  assert.equal(limiter.consume({ key: ipKey, limit: 20, windowMs: 60_000 }).blocked, false);
});

test('consulta e limpeza do limitador permitem exigir desafio após falhas', () => {
  const limiter = createSlidingWindowRateLimiter({ clock: () => 10_000 });
  const policy = { key: 'email:teste', limit: 2, windowMs: 60_000 };
  assert.equal(limiter.status(policy).remaining, 2);
  limiter.consume(policy);
  limiter.consume(policy);
  assert.equal(limiter.status(policy).blocked, true);
  limiter.reset({ key: policy.key });
  assert.equal(limiter.status(policy).blocked, false);
  assert.equal(limiter.status(policy).remaining, 2);
});
