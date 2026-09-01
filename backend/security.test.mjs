import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlidingWindowRateLimiter, opaqueRateLimitKey } from './security.mjs';

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

