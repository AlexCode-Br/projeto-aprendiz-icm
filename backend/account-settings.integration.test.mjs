import assert from 'node:assert/strict';
import test from 'node:test';
import { startTestServer } from './test-support/server.mjs';

test('configurações salvam a nova preferência e excluem a conta com anonimização', { timeout: 20_000 }, async () => {
  const app = await startTestServer();
  const { call, login } = app;

  try {
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
    await app.close();
  }
});
