// The namespace is internal to the Worker; no public endpoint exposes buckets.
export class AuthRateLimiter {
  constructor(ctx) { this.ctx = ctx; }

  async consume({ limit, windowMs }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isFinite(windowMs) || windowMs < 1 || windowMs > 86400000) {
      throw new TypeError('Limite de acesso inválido.');
    }
    return this.ctx.storage.transaction(async storage => {
      const now = Date.now();
      const previous = await storage.get('attempts') || [];
      const timestamps = previous.filter(timestamp => now - timestamp < windowMs);
      const blocked = timestamps.length >= limit;
      if (!blocked) timestamps.push(now);
      await storage.put('attempts', timestamps);
      await storage.setAlarm(now + windowMs);
      return { blocked, remaining: Math.max(0, limit - timestamps.length), retryAfterMs: blocked ? Math.max(1, windowMs - (now - timestamps[0])) : 0 };
    });
  }

  async fetch(request) {
    return Response.json(await this.consume(await request.json()));
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}

export function distributedAuthLimiter(namespace) {
  return {
    async consume({ key, ...options }) {
      if (!namespace) throw new Error('A proteção de acesso distribuída não está configurada.');
      const stub = namespace.get(namespace.idFromName(key));
      const response = await stub.fetch('https://auth-limiter.internal/consume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options),
      });
      if (!response.ok) throw new Error('Não foi possível verificar o limite de acesso.');
      return response.json();
    },
  };
}
