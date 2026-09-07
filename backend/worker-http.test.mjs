import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeApi } from '../cloudflare/http-bridge.mjs';
import { AuthRateLimiter, distributedAuthLimiter } from '../cloudflare/rate-limiter.mjs';
import { readJson } from './security.mjs';

test('Fetch adapter preserves JSON, binary data, separate cookies and trusted client IP', async () => {
  const response = await invokeApi(new Request('https://example.com/api/photo?id=1', {
    method: 'POST', headers: { 'cf-connecting-ip': '192.0.2.1', 'x-forwarded-for': 'spoofed' }, body: JSON.stringify({ nome: 'João' }),
  }), async (request, response, url) => {
    assert.deepEqual(await readJson(request), { nome: 'João' });
    assert.equal(request.headers['x-forwarded-for'], '192.0.2.1');
    assert.equal(url.searchParams.get('id'), '1');
    response.writeHead(201, { 'Content-Type': 'image/png', 'Set-Cookie': ['session=a; HttpOnly', 'csrf=b; Secure'] });
    response.end(Buffer.from([0, 127, 128, 255]));
  });
  assert.equal(response.status, 201);
  assert.deepEqual(response.headers.getSetCookie(), ['session=a; HttpOnly', 'csrf=b; Secure']);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0, 127, 128, 255]));
  await assert.rejects(invokeApi(new Request('https://example.com/api/test', { method: 'POST', body: '{"value":"too long"}' }), request => readJson(request, 4)), { code: 'PAYLOAD_TOO_LARGE' });
  await assert.rejects(invokeApi(new Request('https://example.com/api/test'), async () => {}), /não concluiu/);
});

test('durable limiter survives instances, serializes simultaneous attempts and isolates keys', async () => {
  const stores = new Map();
  const namespace = {
    idFromName: key => key,
    get(key) {
      if (!stores.has(key)) {
        const data = new Map();
        let queue = Promise.resolve();
        const storage = {
          async get(key) { return data.get(key); },
          async put(key, value) { data.set(key, value); },
          async setAlarm() {},
          async deleteAll() { data.clear(); },
          transaction(callback) { const pending = queue.then(() => callback(storage)); queue = pending.catch(() => {}); return pending; },
        };
        stores.set(key, storage);
      }
      const object = new AuthRateLimiter({ storage: stores.get(key) });
      return { fetch: (url, init) => object.fetch(new Request(url, init)) };
    },
  };
  const first = distributedAuthLimiter(namespace);
  const options = { key: 'email:hash-one', limit: 5, windowMs: 60000 };
  const attempts = await Promise.all(Array.from({ length: 8 }, () => first.consume(options)));
  assert.equal(attempts.filter(item => !item.blocked).length, 5);
  const second = distributedAuthLimiter(namespace);
  assert.equal((await second.consume(options)).blocked, true);
  assert.equal((await second.consume({ ...options, key: 'email:hash-two' })).blocked, false);
  assert.ok(attempts.at(-1).retryAfterMs > 0);
  await assert.rejects(distributedAuthLimiter().consume(options), /não está configurada/);
});
