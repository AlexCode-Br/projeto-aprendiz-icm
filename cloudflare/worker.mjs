import { createApplication, isApiPath } from '../backend/application.mjs';
import { createWorkerDatabase } from '../backend/worker-database.mjs';
import { createHttpSecurity } from '../backend/security.mjs';
import { createStructuredLogger } from '../backend/logger.mjs';
import { invokeApi } from './http-bridge.mjs';
import { distributedAuthLimiter } from './rate-limiter.mjs';
export { AuthRateLimiter } from './rate-limiter.mjs';

const logger = createStructuredLogger({ write: line => console.error(line), includeStack: false });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { securityHeaders } = createHttpSecurity({ isProduction: true, appOrigin: env.APP_URL, env });
    const json = (status, message) => new Response(JSON.stringify({ message }), { status, headers: securityHeaders() });
    if (!isApiPath(url.pathname) && url.pathname !== '/api') {
      if (!['GET', 'HEAD'].includes(request.method)) return json(405, 'Método não permitido.');
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { return json(400, 'Caminho inválido.'); }
      if (path.includes('\0') || path.includes('\\') || path.split('/').includes('..')) return json(400, 'Caminho inválido.');
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      const contentType = headers.get('Content-Type') || 'application/octet-stream';
      for (const [key, value] of Object.entries(securityHeaders(contentType))) headers.set(key, value);
      headers.set('Cache-Control', contentType.includes('text/html') ? 'no-store' : /^\/assets\//.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      return new Response(asset.body, { status: asset.status, headers });
    }
    if (url.pathname === '/api') return json(404, 'Rota não encontrada.');
    // GET routes elsewhere may also write (e.g. read receipts). While validating
    // against the live database, only the side-effect-free session lookup runs.
    if (env.READ_ONLY_PREVIEW === 'true' && !(request.method === 'GET' && url.pathname === '/api/auth/me')) {
      return json(403, 'Esta prévia está em validação. As operações ainda não foram liberadas.');
    }
    let db;
    try {
      db = createWorkerDatabase(env, { logger });
      const application = createApplication({ db, env, logger, authRateLimiter: distributedAuthLimiter(env.AUTH_RATE_LIMITER) });
      return await invokeApi(request, application.handler);
    } catch (error) {
      // Avoid reflecting provider errors, configuration or credentials to clients.
      logger.error('worker_request_failed', new Error('Falha ao processar requisição'), { code: error?.code, method: request.method, path: url.pathname });
      return json(503, 'Serviço temporariamente indisponível.');
    } finally {
      if (db) ctx.waitUntil(db.close().catch(() => { logger.error('worker_database_close_failed', new Error('Falha ao encerrar conexão')); }));
    }
  },
};
