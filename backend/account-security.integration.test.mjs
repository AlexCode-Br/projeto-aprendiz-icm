import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function waitForServer(baseUrl, state) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (state.exitCode !== null) throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

test('troca de senha preserva a sessão atual e encerra as demais', { timeout: 20_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-password-'));
  const port = 53_000 + (process.pid % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, SQLITE_PATH: join(directory, 'password.db'), AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  const state = { get exitCode() { return server.exitCode; }, get logs() { return logs; } };
  const call = async (session, method, path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session?.cookie ? { Cookie: session.cookie } : {}),
        ...(session?.csrf ? { 'X-CSRF-Token': session.csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers };
  };
  const login = async password => {
    const response = await call(null, 'POST', '/api/auth/login', { email: 'gestor@projetoaprendiz.local', password });
    return { response, session: { cookie: String(response.headers.get('set-cookie')).split(';')[0], csrf: response.data.csrfToken } };
  };

  try {
    await waitForServer(baseUrl, state);
    const first = await login('Gestor@2026!');
    const second = await login('Gestor@2026!');
    assert.equal(first.response.status, 200);
    assert.equal(second.response.status, 200);

    const changed = await call(first.session, 'PUT', '/api/account/password', { currentPassword: 'Gestor@2026!', newPassword: 'NovaSenha@2026!' });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.equal((await call(first.session, 'GET', '/api/auth/me')).status, 200);
    assert.equal((await call(second.session, 'GET', '/api/auth/me')).status, 401);
    assert.equal((await login('Gestor@2026!')).response.status, 401);
    assert.equal((await login('NovaSenha@2026!')).response.status, 200);
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
