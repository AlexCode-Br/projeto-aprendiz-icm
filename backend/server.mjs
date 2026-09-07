import http from 'node:http';
import { mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.mjs';
import { createApplication } from './application.mjs';
import { initializeNodeApplication } from './node-startup.mjs';
import { createStructuredLogger } from './logger.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const distRoot = join(projectRoot, 'dist');
const resolvedDistRoot = resolve(distRoot);
const dataRoot = join(here, 'data');
const sqlitePath = process.env.SQLITE_PATH || join(dataRoot, 'projeto-aprendiz.db');
const port = Number(process.env.PORT || 4180);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const baseUrl = process.env.APP_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://127.0.0.1:${port}`);
const isProduction = process.env.NODE_ENV === 'production';
const logger = createStructuredLogger();
await mkdir(dataRoot, { recursive: true });
const db = await createDatabase({ sqlitePath, logger });
await initializeNodeApplication({ db });
const { handler, isApiPath, securityHeaders, json, handleError } = createApplication({ db, logger });

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
}

async function serve(request, response, url) {
  if (!isProduction && request.method === 'GET' && url.pathname === '/dev-mail') {
    const emails = await db.prepare('SELECT * FROM dev_emails ORDER BY id DESC LIMIT 20').all();
    const cards = emails.map(email => {
      const body = escapeHtml(email.body).replace(/(http:\/\/127\.0\.0\.1:\d+\/(?:reset-password|accept-invite)\?token=[A-Za-z0-9_%.-]+)/g, '<a href="$1">$1</a>');
      return `<article><h2>${escapeHtml(email.subject)}</h2><p><strong>Para:</strong> ${escapeHtml(email.recipient)}</p><pre>${body}</pre></article>`;
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>Caixa de e-mail de testes</title><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px;background:#f5f5f5}article{background:white;padding:24px;margin:20px 0;border-radius:12px;box-shadow:0 2px 10px #0001}pre{white-space:pre-wrap;line-height:1.5}</style><h1>Caixa de e-mail de testes</h1><p>Mensagens geradas apenas neste ambiente local.</p>${cards || '<p>Nenhuma mensagem.</p>'}`;
    response.writeHead(200, securityHeaders('text/html; charset=utf-8'));
    return response.end(html);
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    return json(response, 405, { message: 'Método não permitido.' }, { Allow: 'GET, HEAD' });
  }
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); }
  catch { return json(response, 400, { message: 'Caminho inválido.' }); }
  if (decodedPath.includes('\0') || decodedPath.includes('\\') || decodedPath.split('/').includes('..')) {
    return json(response, 400, { message: 'Caminho inválido.' });
  }
  const requested = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const candidate = resolve(resolvedDistRoot, requested);
  const candidateRelative = relative(resolvedDistRoot, candidate);
  if (candidateRelative.startsWith('..') || isAbsolute(candidateRelative)) {
    return json(response, 400, { message: 'Caminho inválido.' });
  }
  let file = candidate;
  try {
    const actualFile = await realpath(candidate);
    const actualRelative = relative(resolvedDistRoot, actualFile);
    if (actualRelative.startsWith('..') || isAbsolute(actualRelative) || !(await stat(actualFile)).isFile()) throw new Error('UNSAFE_STATIC_PATH');
    file = actualFile;
  } catch { file = join(resolvedDistRoot, 'index.html'); }
  try {
    const content = await readFile(file);
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.txt':'text/plain; charset=utf-8' };
    response.writeHead(200, { ...securityHeaders(types[extname(file)] || 'application/octet-stream'), 'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable', 'Content-Length': String(content.length) });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { json(response, 503, { message: 'Frontend ainda não compilado.' }); }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, baseUrl);
    if (isApiPath(url.pathname)) return await handler(request, response, url);
    return await serve(request, response, url);
  } catch (error) {
    handleError(request, response, error);
  }
});

server.listen(port, host, () => {
  console.log(`Projeto Aprendiz Aprimorado em ${baseUrl}`);
  if (!isProduction) console.log('Caixa de e-mail de testes em /dev-mail');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Encerrando servidor após ${signal}...`);
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async () => {
    try { await db.close(); }
    finally { process.exit(0); }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
