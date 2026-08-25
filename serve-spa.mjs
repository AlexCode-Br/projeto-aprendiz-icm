import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http.createServer(async (request, response) => {
  const requested = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
  let file = join(root, requested === '/' ? 'index.html' : requested);
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
  } catch {
    file = join(root, 'index.html');
  }
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(500);
    response.end('Erro ao carregar a prévia.');
  }
}).listen(4173, '127.0.0.1', () => {
  console.log('Projeto Aprendiz em http://127.0.0.1:4173/');
});
