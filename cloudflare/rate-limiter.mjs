// The namespace is internal to the Worker; no public endpoint exposes buckets.
export class AuthRateLimiter {
  constructor(ctx) { this.ctx = ctx; }

  validate({ limit, windowMs }) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isFinite(windowMs) || windowMs < 1 || windowMs > 86400000) {
      throw new TypeError('Limite de acesso inválido.');
    }
  }

  async status({ limit, windowMs }) {
    this.validate({ limit, windowMs });
    const now = Date.now();
    const previous = await this.ctx.storage.get('attempts') || [];
    const timestamps = previous.filter(timestamp => now - timestamp < windowMs);
    if (timestamps.length !== previous.length) await this.ctx.storage.put('attempts', timestamps);
    const blocked = timestamps.length >= limit;
    return { blocked, remaining: Math.max(0, limit - timestamps.length), retryAfterMs: blocked ? Math.max(1, windowMs - (now - timestamps[0])) : 0 };
  }

  async consume({ limit, windowMs }) {
    this.validate({ limit, windowMs });
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
    const body = await request.json();
    if (body.action === 'status') return Response.json(await this.status(body));
    if (body.action === 'reset') {
      await this.ctx.storage.deleteAll();
      return Response.json({ success: true });
    }
    return Response.json(await this.consume(body));
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}

export function distributedAuthLimiter(namespace) {
  const call = async (key, body) => {
    if (!namespace) throw new Error('A proteção de acesso distribuída não está configurada.');
    const stub = namespace.get(namespace.idFromName(key));
    const response = await stub.fetch('https://auth-limiter.internal/consume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Não foi possível verificar o limite de acesso.');
    return response.json();
  };
  return {
    consume: ({ key, ...options }) => call(key, options),
    status: ({ key, ...options }) => call(key, { action: 'status', ...options }),
    reset: ({ key }) => call(key, { action: 'reset' }),
  };
}
