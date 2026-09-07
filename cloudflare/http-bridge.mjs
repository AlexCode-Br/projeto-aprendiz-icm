// Keep the existing API handlers and body-size validation at the Fetch boundary.
export async function invokeApi(request, handler) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers);
  const ip = headers['cf-connecting-ip'] || 'unknown';
  headers['x-forwarded-for'] = ip;
  const incoming = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    socket: { remoteAddress: ip },
    async *[Symbol.asyncIterator]() {
      if (!request.body) return;
      const reader = request.body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    },
  };
  const responseHeaders = new Headers();
  let status = 200;
  let body;
  let ended = false;
  let destroyed = false;
  const outgoing = {
    headersSent: false,
    writeHead(code, values = {}) {
      status = code;
      for (const [key, value] of Object.entries(values)) {
        for (const item of Array.isArray(value) ? value : [value]) responseHeaders.append(key, String(item));
      }
      this.headersSent = true;
      return this;
    },
    end(value) { body = value; ended = true; },
    destroy() { destroyed = true; },
  };
  await handler(incoming, outgoing, url);
  if (destroyed || !ended) throw new Error('A API não concluiu a resposta.');
  return new Response(request.method === 'HEAD' || [204, 205, 304].includes(status) ? null : body, { status, headers: responseHeaders });
}
