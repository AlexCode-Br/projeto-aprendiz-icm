import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationService, normalizeNotificationPreferences, notificationDestination } from './notifications.mjs';

test('preferências de notificação são restritas às opções suportadas', () => {
  assert.deepEqual(normalizeNotificationPreferences({ newStudent: false, newTicket: 'false', injected: true }), {
    newStudent: false,
    newTicket: true,
    courseUpdates: true,
    systemAlerts: true,
    systemNews: false,
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

test('destino da notificação acompanha o perfil e o tipo do aviso', () => {
  assert.equal(notificationDestination('newTicket', 'gestor'), '/gestor/suporte');
  assert.equal(notificationDestination('newTicket', 'professor'), '/professor/suporte');
  assert.equal(notificationDestination('newStudent', 'professor'), '/professor/alunos');
  assert.equal(notificationDestination('courseUpdates', 'gestor'), '/gestor/cursos');
  assert.equal(notificationDestination('systemAlerts', 'professor'), '/configuracoes');
  assert.equal(notificationDestination('systemNews', 'gestor'), '/configuracoes');
  assert.equal(notificationDestination('systemNews', 'aluno'), '/aluno/cursos');
});

test('uma falha no e-mail não impede a entrega da notificação push', async () => {
  const pushed = [];
  const db = {
    prepare(sql) {
      return {
        get: async () => sql.includes('preferences_json') ? { preferences_json: '{}' } : { id: 7, name: 'Ana', email: 'ana@example.com' },
      };
    },
  };
  const service = createNotificationService({
    db,
    sendEmail: async () => { throw new Error('indisponível'); },
    sendPush: async (...args) => { pushed.push(args); return { sent: true }; },
    logger: { error() {} },
  });
  const result = await service.notifyUser(7, 'systemAlerts', 'Aviso', 'Conteúdo', 'aviso/7');
  assert.equal(result.sent, true);
  assert.deepEqual(result.channels, { email: false, push: true });
  assert.equal(pushed[0][0], 7);
  assert.equal(pushed[0][1].title, 'Aviso');
  assert.equal(pushed[0][1].url, '/configuracoes');
});
