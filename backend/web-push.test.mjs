import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebPushService, normalizePushSubscription, webPushInternals } from './web-push.mjs';

test('assinaturas push rejeitam endpoints capazes de acessar a rede interna', () => {
  assert.equal(normalizePushSubscription({ endpoint: 'https://127.0.0.1/push', keys: { p256dh: 'x', auth: 'y' } }).error, 'Assinatura de notificações inválida.');
});

test('serviço cifra e envia Web Push com autenticação VAPID', async () => {
  const clientKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clientPublic = new Uint8Array(await crypto.subtle.exportKey('raw', clientKeys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const subscription = {
    id: 9,
    endpoint: 'https://fcm.googleapis.com/fake-push-endpoint',
    p256dh: webPushInternals.bytesToBase64Url(clientPublic),
    auth: webPushInternals.bytesToBase64Url(auth),
  };
  let request;
  const db = {
    prepare() {
      return { all: async () => [subscription], run: async () => ({ changes: 1 }) };
    },
  };
  const service = createWebPushService({
    db,
    env: { NODE_ENV: 'development' },
    fetchImpl: async (url, options) => { request = { url, options }; return new Response(null, { status: 201 }); },
    logger: { error() {} },
  });
  const configuration = await service.configuration();
  const result = await service.sendToUser(4, { title: 'Teste', body: 'Tudo certo', url: '/' });
  assert.equal(configuration.configured, true);
  assert.equal(webPushInternals.base64UrlToBytes(configuration.publicKey).length, 65);
  assert.equal(result.sent, true);
  assert.equal(result.delivered, 1);
  assert.equal(request.url, subscription.endpoint);
  assert.match(request.options.headers.Authorization, /^vapid t=.+, k=.+$/);
  assert.equal(request.options.headers['Content-Encoding'], 'aes128gcm');
  assert.ok(request.options.body.byteLength > 100);
});
