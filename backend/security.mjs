import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const DEFAULT_SWEEP_INTERVAL = 256;
const scrypt = promisify(scryptCallback);

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const strongPassword = value => typeof value === 'string' && value.length >= 10 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [, saltHex, hashHex] = String(encoded).split('$');
  if (!saltHex || !hashHex) return false;
  const derived = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export async function readJson(request, maxBytes = 32768) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      const error = new Error('PAYLOAD_TOO_LARGE');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try {
    const body = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('INVALID_JSON_OBJECT');
    return body;
  }
  catch {
    const error = new Error('INVALID_JSON');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

export function createHttpSecurity({ isProduction, appOrigin }) {
  function cookies(request) {
    const parsed = {};
    for (const rawCookie of String(request.headers.cookie || '').split(';')) {
      const separator = rawCookie.indexOf('=');
      if (separator < 1) continue;
      try {
        const name = decodeURIComponent(rawCookie.slice(0, separator).trim());
        const value = decodeURIComponent(rawCookie.slice(separator + 1).trim());
        if (name) parsed[name] = value;
      } catch {
        // Ignore only the malformed pair so one invalid cookie cannot break auth.
      }
    }
    return parsed;
  }

  function cookie(name, value, maxAge = 0) {
    return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`;
  }

  function securityHeaders(contentType = 'application/json; charset=utf-8') {
    const connectSources = ["'self'"];
    if (process.env.SUPABASE_URL) connectSources.push(new URL(process.env.SUPABASE_URL).origin);
    const headers = {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src ${connectSources.join(' ')}; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
      'Cache-Control': 'no-store',
    };
    if (isProduction) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    return headers;
  }

  function json(response, status, data, extra = {}) {
    response.writeHead(status, { ...securityHeaders(), ...extra });
    response.end(JSON.stringify(data));
  }

  function originAllowed(request) {
    const origin = request.headers.origin;
    return !origin || origin === appOrigin;
  }

  return { cookies, cookie, securityHeaders, json, originAllowed };
}

export function opaqueRateLimitKey(namespace, value) {
  const normalizedNamespace = String(namespace || 'request').trim().toLowerCase();
  const normalizedValue = String(value || 'unknown').trim().toLowerCase();
  const digest = createHash('sha256').update(normalizedValue).digest('hex');
  return `${normalizedNamespace}:${digest}`;
}

export function createSlidingWindowRateLimiter({ clock = () => Date.now(), sweepInterval = DEFAULT_SWEEP_INTERVAL } = {}) {
  const buckets = new Map();
  let operations = 0;

  function sweep(now) {
    for (const [key, bucket] of buckets) {
      const timestamps = bucket.timestamps.filter(timestamp => now - timestamp < bucket.windowMs);
      if (timestamps.length) buckets.set(key, { ...bucket, timestamps });
      else buckets.delete(key);
    }
  }

  function consume({ key, limit, windowMs }) {
    if (!key) throw new TypeError('A chave do limitador é obrigatória.');
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError('O limite deve ser um inteiro positivo.');
    if (!Number.isFinite(windowMs) || windowMs < 1) throw new TypeError('A janela deve ser positiva.');

    const now = clock();
    operations += 1;
    if (operations % sweepInterval === 0) sweep(now);

    const existing = buckets.get(key);
    const timestamps = (existing?.timestamps || []).filter(timestamp => now - timestamp < windowMs);
    const blocked = timestamps.length >= limit;
    if (!blocked) timestamps.push(now);
    buckets.set(key, { timestamps, windowMs });

    const retryAfterMs = blocked && timestamps.length
      ? Math.max(1, windowMs - (now - timestamps[0]))
      : 0;
    return {
      blocked,
      remaining: Math.max(0, limit - timestamps.length),
      retryAfterMs,
    };
  }

  return {
    consume,
    clear() {
      buckets.clear();
      operations = 0;
    },
    size() {
      return buckets.size;
    },
  };
}
