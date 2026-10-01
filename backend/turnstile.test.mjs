import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyTurnstileToken } from './turnstile.mjs';

test('Turnstile valida no servidor, limita o token e confere o hostname', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json({ success: true, hostname: 'aprendizicm.com.br', action: 'login', challenge_ts: new Date().toISOString() });
  };
  const base = { ip: '192.0.2.10', secretKey: 'segredo', allowedHostnames: ['aprendizicm.com.br'], expectedAction: 'login', fetchImpl };
  assert.equal(await verifyTurnstileToken({ ...base, token: '' }), false);
  assert.equal(await verifyTurnstileToken({ ...base, token: 'x'.repeat(2049) }), false);
  assert.equal(await verifyTurnstileToken({ ...base, token: 'token-valido' }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.remoteip, '192.0.2.10');
  assert.equal(calls[0].body.response, 'token-valido');

  const validTime = new Date().toISOString();
  const wrongHost = async () => Response.json({ success: true, hostname: 'outro.example', action: 'login', challenge_ts: validTime });
  assert.equal(await verifyTurnstileToken({ ...base, token: 'token', fetchImpl: wrongHost }), false);
  const wrongAction = async () => Response.json({ success: true, hostname: 'aprendizicm.com.br', action: 'recovery', challenge_ts: validTime });
  assert.equal(await verifyTurnstileToken({ ...base, token: 'token', fetchImpl: wrongAction }), false);
  const rejected = async () => Response.json({ success: false, hostname: 'aprendizicm.com.br', action: 'login', challenge_ts: validTime });
  assert.equal(await verifyTurnstileToken({ ...base, token: 'token', fetchImpl: rejected }), false);
  const stale = async () => Response.json({ success: true, hostname: 'aprendizicm.com.br', action: 'login', challenge_ts: new Date(Date.now()-11*60_000).toISOString() });
  assert.equal(await verifyTurnstileToken({ ...base, token: 'token', fetchImpl: stale }), false);
});
