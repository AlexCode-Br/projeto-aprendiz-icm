import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from './database.mjs';
import { initializeNodeApplication } from './node-startup.mjs';
import { startTestServer } from './test-support/server.mjs';
import { createNotificationOutbox } from './notification-outbox.mjs';
import { createNotificationService } from './notifications.mjs';

test('gestor recebe alerta separado após MFA e reconhece navegador', { timeout: 25_000 }, async () => {
  const app = await startTestServer({ env: { REQUIRE_MANAGER_MFA: 'true' } });
  const db = new DatabaseSync(app.databasePath);
  db.exec('PRAGMA busy_timeout=5000');
  const identity = { email: 'gestor@projetoaprendiz.local', password: 'Gestor@2026!' };
  const sessionCookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]);
  async function challenge(deviceCookie) {
    const result = await app.call(deviceCookie ? { cookie: deviceCookie } : null, 'POST', '/api/auth/login', identity);
    assert.equal(result.status, 202);
    assert.equal(result.data.mfaRequired, true, 'navegador reconhecido ainda exige MFA');
    const mail = db.prepare("SELECT body FROM dev_emails WHERE subject LIKE 'Código de verificação%' ORDER BY id DESC LIMIT 1").get();
    assert.doesNotMatch(mail.body, /Detalhes do acesso|Endereço IP|novo dispositivo/i);
    return { token: result.data.challengeToken, code: mail.body.match(/\b\d{6}\b/)[0] };
  }
  async function verify(challenge, deviceCookie, headers = {}) {
    const response = await fetch(app.baseUrl + '/api/auth/mfa/verify', {
      method: 'POST',
      headers: { Origin: app.baseUrl, 'Content-Type': 'application/json', ...(deviceCookie ? { Cookie: deviceCookie } : {}), ...headers },
      body: JSON.stringify({ challengeToken: challenge.token, code: challenge.code }),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  try {
    const first = await challenge();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notification_outbox').get().n, 0);
    assert.equal((await app.call(null, 'POST', '/api/auth/mfa/verify', { challengeToken: first.token, code: 'not-a-code' })).status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM manager_login_devices').get().n, 0);
    const connected = await verify(first, null, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' });
    assert.equal(connected.status, 200);
    const deviceCookie = sessionCookies(connected).find(value => value.startsWith('pa_device='));
    assert.ok(deviceCookie);
    assert.match(connected.headers.getSetCookie().find(value => value.startsWith('pa_device=')), /HttpOnly; SameSite=Strict; Max-Age=31536000/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM manager_login_devices').get().n, 1);
    const alert = db.prepare('SELECT * FROM notification_outbox').get();
    assert.match(alert.subject, /Novo dispositivo conectado/);
    assert.match(alert.body, /Sistema e navegador: Windows, Edge/);
    assert.match(alert.body, /Localização aproximada: Não disponível/);
    assert.doesNotMatch(alert.body, /código de verificação é/);
    assert.equal(alert.email_enabled, 1);
    assert.equal(alert.push_enabled, 0);
    assert.notEqual(db.prepare('SELECT token_hash FROM manager_login_devices').get().token_hash, deviceCookie.split('=')[1]);
    assert.equal((await verify(first, deviceCookie)).status, 400);
    assert.equal((await app.call({ cookie: deviceCookie }, 'GET', '/api/auth/me')).status, 401, 'cookie de dispositivo não autentica');

    const returning = await challenge(deviceCookie);
    const again = await verify(returning, deviceCookie, { 'X-Forwarded-For': '192.0.2.2', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/141.0.0.0 Safari/537.36' });
    assert.equal(again.status, 200);
    assert.equal(sessionCookies(again).find(value => value.startsWith('pa_device=')), deviceCookie);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notification_outbox').get().n, 1, 'troca de IP/UA não cria novo dispositivo');

    for (let attempt = 0; attempt < 100 && !db.prepare("SELECT id FROM dev_emails WHERE subject LIKE 'Novo dispositivo conectado%'").get(); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const delivered = db.prepare("SELECT body FROM dev_emails WHERE subject LIKE 'Novo dispositivo conectado%'").all();
    assert.equal(delivered.length, 1, 'alerta entregue em e-mail separado após concluir MFA');
    assert.doesNotMatch(delivered[0].body, /código de verificação é/);

    const other = await challenge();
    assert.equal((await verify(other)).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM manager_login_devices').get().n, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notification_outbox').get().n, 2);

    db.prepare("UPDATE manager_login_devices SET expires_at='2000-01-01T00:00:00.000Z'").run();
    assert.equal((await verify(await challenge(deviceCookie), deviceCookie)).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notification_outbox').get().n, 3, 'reconhecimento expirado gera novo alerta');

  } finally {
    db.close();
    await app.close();
  }
});

test('alerta obrigatório retenta falha de e-mail sem enviar push', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aprendiz-device-alert-'));
  const db = await createDatabase({ sqlitePath: join(directory, 'test.db') });
  try {
    await initializeNodeApplication({ db, env: { NODE_ENV: 'test', AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'false' } });
    const userId = (await db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES ('Gestor','gestor-alert@example.com','x','gestor')").run()).lastInsertRowid;
    await db.prepare('INSERT INTO user_settings(user_id,preferences_json) VALUES (?,?)').run(userId, '{"systemAlerts":false}');
    const delivered = [];
    let fail = true;
    const notificationService = createNotificationService({
      db, sendPush: () => { throw new Error('security push is forbidden'); },
      sendEmail: async (...args) => {
        if (fail) { fail = false; throw new Error('temporary delivery failure'); }
        delivered.push(args);
      },
    });
    const outbox = createNotificationOutbox({ db, notificationService, logger: { error() {} } });
    await outbox.enqueueMany([{ userId, preference: 'managerNewDevice', subject: 'Novo dispositivo conectado', body: 'Acesso concluído.', destination: '/configuracoes', idempotencyKey: 'device-test', channels: { email: true, push: false } }]);
    assert.deepEqual(await outbox.drain(), { processed: 1, delivered: 0 });
    assert.equal((await db.prepare('SELECT status FROM notification_outbox').get()).status, 'pending');
    await db.prepare("UPDATE notification_outbox SET available_at='2000-01-01T00:00:00.000Z'").run();
    assert.deepEqual(await outbox.drain(), { processed: 1, delivered: 1 });
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0][0], 'gestor-alert@example.com');
    const professorId = (await db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES ('Professor','professor-alert@example.com','x','professor')").run()).lastInsertRowid;
    await notificationService.notifySecurityAlert(professorId, 'Alerta', 'Não enviar', 'test-professor');
    assert.equal(delivered.length, 1, 'alerta exclusivo de gestor');
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('falha ao persistir alerta desfaz sessão e registro do dispositivo', { timeout: 15_000 }, async () => {
  const app = await startTestServer({ env: { REQUIRE_MANAGER_MFA: 'true' } });
  const db = new DatabaseSync(app.databasePath);
  try {
    const login = await app.call(null, 'POST', '/api/auth/login', { email: 'gestor@projetoaprendiz.local', password: 'Gestor@2026!' });
    const mail = db.prepare("SELECT body FROM dev_emails ORDER BY id DESC LIMIT 1").get();
    const code = mail.body.match(/\b\d{6}\b/)[0];
    db.exec("CREATE TRIGGER fail_security_alert BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT,'queue failure'); END;");
    const verified = await app.call(null, 'POST', '/api/auth/mfa/verify', { challengeToken: login.data.challengeToken, code });
    assert.equal(verified.status, 500);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM manager_login_devices').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM notification_outbox').get().n, 0);
  } finally {
    db.close();
    await app.close();
  }
});
