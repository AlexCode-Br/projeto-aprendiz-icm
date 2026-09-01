import { createHash } from 'node:crypto';

const DEFAULT_SWEEP_INTERVAL = 256;

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

