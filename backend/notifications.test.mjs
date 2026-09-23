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
    wallPosts: true,
    wallComments: true,
    wallLikes: true,
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
  assert.equal(notificationDestination('systemNews', 'aluno'), '/aluno/dashboard');
  assert.equal(notificationDestination('wallPosts', 'aluno'), '/aluno/dashboard');
  assert.equal(notificationDestination('wallComments', 'professor'), '/professor/turmas');
  assert.equal(notificationDestination('wallLikes', 'gestor'), '/gestor/cursos');
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
  await service.notifyUser(7, 'courseUpdates', 'Mural', 'Conteúdo', 'mural/7', '/aluno/cursos/12?view=mural');
  assert.equal(pushed[1][1].url, '/aluno/cursos/12?view=mural');
});

test('mural pode usar somente push e uma tag estável para agrupar eventos',async()=>{
  const emails=[],pushes=[];
  const db={prepare(sql){return{get:async()=>sql.includes('preferences_json')?{preferences_json:'{}'}:{id:11,name:'Lia',email:'lia@example.com',role:'aluno'}};}};
  const service=createNotificationService({db,sendEmail:async(...args)=>emails.push(args),sendPush:async(...args)=>{pushes.push(args);return{sent:true};},logger:{error(){}}});
  const result=await service.notifyUser(11,'wallComments','Nova mensagem','Conteúdo','event/11',{destination:'/aluno/cursos/4?view=mural',tag:'course-wall/4',channels:{email:false,push:true}});
  assert.equal(result.sent,true);
  assert.equal(emails.length,0);
  assert.equal(pushes[0][1].tag,'course-wall/4');
  assert.equal(pushes[0][1].url,'/aluno/cursos/4?view=mural');
});
