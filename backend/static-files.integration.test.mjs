import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function waitForServer(port, state) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (state.exitCode !== null) throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

function rawRequest(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path, method }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('servidor estático bloqueia traversal e métodos de escrita antes de acessar o disco', { timeout: 20_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-static-'));
  const port = 52_000 + (process.pid % 1_000);
  let logs = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      APP_URL: `http://127.0.0.1:${port}`,
      SQLITE_PATH: join(directory, 'static.db'),
      AUTH_PROVIDER: 'local',
      SEED_DEMO_DATA: 'false',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  const state = { get exitCode() { return server.exitCode; }, get logs() { return logs; } };

  try {
    await waitForServer(port, state);
    for (const path of ['/..%2fpackage.json', '/%2e%2e%2f.env', '/..%5cbackend%5cserver.mjs']) {
      const response = await rawRequest(port, path);
      assert.equal(response.status, 400, `${path}: ${response.body}`);
      assert.doesNotMatch(response.body, /projeto-aprendiz-aprimorado|DATABASE_URL|createServer/);
    }
    const writeAttempt = await rawRequest(port, '/login', 'POST');
    assert.equal(writeAttempt.status, 405);
    assert.equal(writeAttempt.headers.allow, 'GET, HEAD');
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
