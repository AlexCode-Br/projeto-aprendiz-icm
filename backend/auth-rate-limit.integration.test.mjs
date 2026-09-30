import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const blockedMessage = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';

async function waitForServer(baseUrl, state) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (state.exitCode !== null) throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

test('rotas sensíveis bloqueiam por e-mail e IP e registram auditoria', { timeout: 40_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-rate-limit-'));
  const databasePath = join(directory, 'rate-limit.db');
  const port = 46_000 + (process.pid % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      APP_URL: baseUrl,
      SQLITE_PATH: databasePath,
      AUTH_PROVIDER: 'local',
      SEED_DEMO_DATA: 'true',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  const state = { get exitCode() { return server.exitCode; }, get logs() { return logs; } };

  const post = async (path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), retryAfter: response.headers.get('retry-after') };
  };

  try {
    await waitForServer(baseUrl, state);
    const database = new DatabaseSync(databasePath);
    const manager = database.prepare("SELECT id FROM users WHERE role='gestor' ORDER BY id LIMIT 1").get();
    const resetToken = 'reset-rate-limit-token';
    const invitationToken = 'invitation-rate-limit-token';
    const resetExpires = new Date(Date.now() + 60 * 60_000).toISOString();
    database.prepare('INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES (?,?,?)')
      .run(manager.id, digest(resetToken), resetExpires);
    const professor = database.prepare('INSERT INTO professor_profiles (name,email,active) VALUES (?,?,1)')
      .run('Professor Limite', 'limite@example.com');
    database.prepare('INSERT INTO professor_invites (professor_profile_id,email,token_hash,expires_at,created_by) VALUES (?,?,?,?,?)')
      .run(professor.lastInsertRowid, 'limite@example.com', digest(invitationToken), resetExpires, manager.id);
    database.close();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await post('/api/auth/login', { email: 'desconhecido@example.com', password: 'incorreta' })).status, 401);
    }
    const emailBlocked = await post('/api/auth/login', { email: 'desconhecido@example.com', password: 'incorreta' });
    assert.equal(emailBlocked.status, 429);
    assert.equal(emailBlocked.data.message, blockedMessage);
    assert.ok(Number(emailBlocked.retryAfter) > 0);

    for (let attempt = 0; attempt < 15; attempt += 1) {
      assert.equal((await post('/api/auth/login', { email: `pessoa-${attempt}@example.com`, password: 'incorreta' })).status, 401);
    }
    const ipBlocked = await post('/api/auth/login', { email: 'ultima-pessoa@example.com', password: 'incorreta' });
    assert.equal(ipBlocked.status, 429);
    assert.equal(ipBlocked.data.message, blockedMessage);

    for (const [path, body] of [
      ['/api/auth/forgot-password', { email: 'nao-existe@example.com' }],
      ['/api/auth/reset-password', { token: resetToken, password: 'fraca' }],
      ['/api/invitations/accept', { token: invitationToken, password: 'fraca' }],
    ]) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.notEqual((await post(path, body)).status, 429);
      }
      const blocked = await post(path, body);
      assert.equal(blocked.status, 429, path);
      assert.equal(blocked.data.message, blockedMessage);
    }

    const auditDatabase = new DatabaseSync(databasePath);
    const actions = auditDatabase.prepare("SELECT action FROM audit_log WHERE action LIKE 'auth_rate_limited:%' ORDER BY id").all().map(row => row.action);
    auditDatabase.close();
    assert.ok(actions.some(action => action.includes('login:email')));
    assert.ok(actions.some(action => action.includes('login:ip')));
    assert.ok(actions.some(action => action.includes('forgot_password:email')));
    assert.ok(actions.some(action => action.includes('reset_password:email')));
    assert.ok(actions.some(action => action.includes('invitation_accept:email')));
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

