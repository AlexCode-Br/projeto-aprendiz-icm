import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function waitForServer(baseUrl, server, logs) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Servidor encerrou antes do teste: ${logs()}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou: ${logs()}`);
}

test('configurações salvam a nova preferência e excluem a conta com anonimização', { timeout: 20_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-account-settings-'));
  const port = 55_000 + (process.pid % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, SQLITE_PATH: join(directory, 'account.db'), AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });

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
  const login = async (email, password) => {
    const response = await call(null, 'POST', '/api/auth/login', { email, password, remember: true });
    return { response, session: { cookie: String(response.headers.get('set-cookie')).split(';')[0], csrf: response.data.csrfToken } };
  };

  try {
    await waitForServer(baseUrl, server, () => output);
    const manager = await login('gestor@projetoaprendiz.local', 'Gestor@2026!');
    assert.equal(manager.response.status, 200);
    const managerDeletion = await call(manager.session, 'POST', '/api/account/delete', { confirmation: 'gestor@projetoaprendiz.local', currentPassword: 'Gestor@2026!' });
    assert.equal(managerDeletion.status, 409);

    const professor = await login('professor@projetoaprendiz.local', 'Professor@2026!');
    assert.equal(professor.response.status, 200);
    const secondProfessorLogin = await login('professor@projetoaprendiz.local', 'Professor@2026!');
    assert.equal(secondProfessorLogin.response.status, 200);
    const sessionInventory = await call(professor.session, 'GET', '/api/account/sessions');
    assert.equal(sessionInventory.status, 200);
    assert.equal(sessionInventory.data.items.filter(item => item.current).length, 1);
    assert.equal(sessionInventory.data.items.length >= 2, true);
    const otherSession = sessionInventory.data.items.find(item => !item.current);
    const revokedSession = await call(professor.session, 'DELETE', `/api/account/sessions/${otherSession.id}`);
    assert.equal(revokedSession.status, 200);
    assert.equal((await call(secondProfessorLogin.session, 'GET', '/api/auth/me')).status, 401);
    const preferences = await call(professor.session, 'PUT', '/api/account/preferences', { preferences: { systemNews: true } });
    assert.equal(preferences.status, 200);
    assert.equal(preferences.data.preferences.systemNews, true);
    assert.equal(preferences.data.preferences.newStudent, true);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await call(professor.session, 'POST', '/api/account/preferences/test', {})).status, 200);
    }
    const limitedTestNotification = await call(professor.session, 'POST', '/api/account/preferences/test', {});
    assert.equal(limitedTestNotification.status, 429);
    assert.match(limitedTestNotification.data.message, /tentativas/i);

    const wrongConfirmation = await call(professor.session, 'POST', '/api/account/delete', { confirmation: 'outro@example.com', currentPassword: 'Professor@2026!' });
    assert.equal(wrongConfirmation.status, 400);
    const deleted = await call(professor.session, 'POST', '/api/account/delete', { confirmation: 'professor@projetoaprendiz.local', currentPassword: 'Professor@2026!' });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    assert.match(String(deleted.headers.get('set-cookie')), /Max-Age=0/);
    assert.equal((await call(professor.session, 'GET', '/api/auth/me')).status, 401);
    assert.equal((await login('professor@projetoaprendiz.local', 'Professor@2026!')).response.status, 401);
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
