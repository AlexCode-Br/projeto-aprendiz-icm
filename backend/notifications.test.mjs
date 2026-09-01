import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationService, normalizeNotificationPreferences } from './notifications.mjs';

test('preferências de notificação são restritas às opções suportadas', () => {
  assert.deepEqual(normalizeNotificationPreferences({ newStudent: false, newTicket: 'false', injected: true }), {
    newStudent: false,
    newTicket: true,
    courseUpdates: true,
    systemAlerts: true,
  });
});

test('serviço respeita preferência desativada antes de enviar e-mail', async () => {
  const sent = [];
  const db = {
    prepare(sql) {
      return {
        async get() {
          if (sql.startsWith('SELECT id,name,email')) return { id: 1, name: 'Gestor', email: 'gestor@example.com' };
          if (sql.startsWith('SELECT preferences_json')) return { preferences_json: JSON.stringify({ newTicket: false }) };
          return null;
        },
      };
    },
  };
  const service = createNotificationService({ db, sendEmail: async (...args) => sent.push(args), logger: { error() {} } });
  assert.deepEqual(await service.notifyUser(1, 'newTicket', 'Assunto', 'Mensagem', 'ticket/1'), { sent: false, reason: 'disabled' });
  assert.equal(sent.length, 0);
  const delivered = await service.notifyUser(1, 'systemAlerts', 'Assunto', 'Mensagem', 'security/1');
  assert.equal(delivered.sent, true);
  assert.equal(sent.length, 1);
});
