const encoder = new TextEncoder();

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bytesToBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function concatenate(...values) {
  const arrays = values.map(value => value instanceof Uint8Array ? value : new Uint8Array(value));
  const result = new Uint8Array(arrays.reduce((total, value) => total + value.length, 0));
  let offset = 0;
  for (const value of arrays) { result.set(value, offset); offset += value.length; }
  return result;
}

async function hkdf(cryptoImpl, salt, input, info, length) {
  const key = await cryptoImpl.subtle.importKey('raw', input, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await cryptoImpl.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

async function generateVapidKeys(cryptoImpl) {
  const pair = await cryptoImpl.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = new Uint8Array(await cryptoImpl.subtle.exportKey('raw', pair.publicKey));
  const privateJwk = await cryptoImpl.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: bytesToBase64Url(publicKey), privateKey: privateJwk.d };
}

async function encryptPayload(cryptoImpl, subscription, payload) {
  const clientPublicBytes = base64UrlToBytes(subscription.p256dh);
  const authSecret = base64UrlToBytes(subscription.auth);
  if (clientPublicBytes.length !== 65 || clientPublicBytes[0] !== 4 || authSecret.length < 16) throw new Error('Chaves da assinatura push inválidas.');

  const clientPublicKey = await cryptoImpl.subtle.importKey('raw', clientPublicBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const serverKeys = await cryptoImpl.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicBytes = new Uint8Array(await cryptoImpl.subtle.exportKey('raw', serverKeys.publicKey));
  const sharedSecret = new Uint8Array(await cryptoImpl.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, serverKeys.privateKey, 256));
  const keyInfo = concatenate(encoder.encode('WebPush: info\0'), clientPublicBytes, serverPublicBytes);
  const inputKeyMaterial = await hkdf(cryptoImpl, authSecret, sharedSecret, keyInfo, 32);
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(cryptoImpl, salt, inputKeyMaterial, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(cryptoImpl, salt, inputKeyMaterial, encoder.encode('Content-Encoding: nonce\0'), 12);
  const plaintext = concatenate(encoder.encode(JSON.stringify(payload)), Uint8Array.of(2));
  const aesKey = await cryptoImpl.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(await cryptoImpl.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concatenate(salt, recordSize, Uint8Array.of(serverPublicBytes.length), serverPublicBytes, ciphertext);
}

async function vapidAuthorization(cryptoImpl, endpoint, keys, subject) {
  const audience = new URL(endpoint).origin;
  const publicBytes = base64UrlToBytes(keys.publicKey);
  const privateBytes = base64UrlToBytes(keys.privateKey);
  if (publicBytes.length !== 65 || privateBytes.length !== 32) throw new Error('Chaves VAPID inválidas.');
  const x = bytesToBase64Url(publicBytes.slice(1, 33));
  const y = bytesToBase64Url(publicBytes.slice(33, 65));
  const privateKey = await cryptoImpl.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x, y, d: keys.privateKey, ext: true, key_ops: ['sign'],
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToBase64Url(encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject })));
  const unsigned = `${header}.${claims}`;
  const signature = await cryptoImpl.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(unsigned));
  return `vapid t=${unsigned}.${bytesToBase64Url(signature)}, k=${keys.publicKey}`;
}

function validPushEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com'
      || host === 'updates.push.services.mozilla.com'
      || host === 'push.services.mozilla.com'
      || host === 'web.push.apple.com'
      || host.endsWith('.push.apple.com')
      || host.endsWith('.notify.windows.com');
  } catch { return false; }
}

export function normalizePushSubscription(value) {
  const endpoint = String(value?.endpoint || '').trim();
  const p256dh = String(value?.keys?.p256dh || '').trim();
  const auth = String(value?.keys?.auth || '').trim();
  if (!validPushEndpoint(endpoint) || endpoint.length > 2048) return { error: 'Assinatura de notificações inválida.' };
  try {
    const publicBytes = base64UrlToBytes(p256dh);
    const authBytes = base64UrlToBytes(auth);
    if (publicBytes.length !== 65 || publicBytes[0] !== 4 || authBytes.length < 16 || p256dh.length > 128 || auth.length > 64) throw new Error();
  } catch { return { error: 'Chaves da assinatura de notificações inválidas.' }; }
  return { endpoint, p256dh, auth };
}

export function createWebPushService({ db, env = {}, logger = console, fetchImpl = fetch, cryptoImpl = globalThis.crypto } = {}) {
  let keysPromise;
  async function keys() {
    if (!keysPromise) {
      keysPromise = env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? Promise.resolve({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY })
        : env.NODE_ENV === 'production' ? Promise.resolve(null) : generateVapidKeys(cryptoImpl);
    }
    return keysPromise;
  }

  async function configuration() {
    const vapidKeys = await keys();
    return { configured: Boolean(vapidKeys), publicKey: vapidKeys?.publicKey || '' };
  }

  async function sendSubscription(subscription, payload) {
    const vapidKeys = await keys();
    if (!vapidKeys) return { sent: false, reason: 'not_configured' };
    const body = await encryptPayload(cryptoImpl, subscription, payload);
    const authorization = await vapidAuthorization(cryptoImpl, subscription.endpoint, vapidKeys, env.VAPID_SUBJECT || 'mailto:naoresponda@aprendizicm.com.br');
    const response = await fetchImpl(subscription.endpoint, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
      body,
    });
    if (response.ok) return { sent: true };
    if ([404, 410].includes(response.status)) {
      await db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(subscription.id);
      return { sent: false, reason: 'expired' };
    }
    throw new Error(`Serviço push respondeu com status ${response.status}.`);
  }

  async function sendToUser(userId, payload) {
    if (!(await keys())) return { sent: false, reason: 'not_configured', delivered: 0 };
    const subscriptions = await db.prepare('SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=? ORDER BY id').all(userId);
    if (!subscriptions.length) return { sent: false, reason: 'not_subscribed', delivered: 0 };
    const settled = await Promise.allSettled(subscriptions.map(subscription => sendSubscription(subscription, payload)));
    let delivered = 0;
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.sent) delivered += 1;
      if (result.status === 'rejected') logger.error('push_notification_failed', result.reason, { userId, subscriptionId: subscriptions[index].id });
    });
    return { sent: delivered > 0, delivered, reason: delivered ? undefined : 'delivery_failed' };
  }

  return { configuration, sendToUser };
}

export const webPushInternals = { base64UrlToBytes, bytesToBase64Url, encryptPayload, generateVapidKeys, validPushEndpoint, vapidAuthorization };
