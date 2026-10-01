import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { startTestServer } from './test-support/server.mjs';

test('modelo acadêmico preserva igrejas, responsáveis, capacidade e transferências', { timeout: 40_000 }, async () => {
  const app = await startTestServer();
  const { databasePath, baseUrl, call } = app;
  let database;

  try {
    const login = await call(null, 'POST', '/api/auth/login', { email: 'gestor@projetoaprendiz.local', password: 'Gestor@2026!' });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    const manager = { cookie: String(login.headers.get('set-cookie')).split(';')[0], csrf: login.data.csrfToken };
    const professorLogin = await call(null, 'POST', '/api/auth/login', { email: 'professor@projetoaprendiz.local', password: 'Professor@2026!' });
    assert.equal(professorLogin.status, 200, JSON.stringify(professorLogin.data));
    const professorSession = { cookie: String(professorLogin.headers.get('set-cookie')).split(';')[0], csrf: professorLogin.data.csrfToken };

    const catalogs = await call(manager, 'GET', '/api/catalogos');
    assert.equal(catalogs.status, 200, JSON.stringify(catalogs.data));
    assert.ok(Array.isArray(catalogs.data.cursos));
    assert.ok(Array.isArray(catalogs.data.locais));

    const classes = await call(manager, 'GET', '/cursos');
    const offering = classes.data.cursos.find(item => item.professor === 'Marina Oliveira') || classes.data.cursos[0];
    assert.ok(offering);
    const professorsBeforeProfileEdit = await call(manager, 'GET', '/professores');
    const existingProfessor = professorsBeforeProfileEdit.data.professores.find(item => item.nome === offering.professor);
    assert.ok(existingProfessor);
    const existingClassesBeforeEdit = classes.data.cursos
      .filter(item => item.professor === existingProfessor.nome)
      .map(item => ({ id: item.id, local: item.local, status: item.status }));
    const profileUpdate = await call(manager, 'PUT', `/professores/${existingProfessor.id}`, {
      nome: existingProfessor.nome,
      contato: existingProfessor.contato,
      telefone: existingProfessor.telefone,
      local: 'ICM Federação',
    });
    assert.equal(profileUpdate.status, 200, JSON.stringify(profileUpdate.data));
    const professorsAfterProfileEdit = await call(manager, 'GET', '/professores');
    assert.equal(professorsAfterProfileEdit.data.professores.find(item => item.id === existingProfessor.id).local, 'Federação');
    const existingClassesAfterEdit = (await call(manager, 'GET', '/cursos')).data.cursos
      .filter(item => item.professor === existingProfessor.nome)
      .map(item => ({ id: item.id, local: item.local, status: item.status }));
    assert.deepEqual(existingClassesAfterEdit, existingClassesBeforeEdit);
    const newProfessor = await call(manager, 'POST', '/professores', {
      nome: 'Professor Sem Turma',
      contato: 'professor.sem.turma@example.com',
      telefone: '(71) 99999-7654',
      local: 'ICM Mirantes de Periperi',
    });
    assert.equal(newProfessor.status, 201, JSON.stringify(newProfessor.data));
    assert.equal((await call(manager, 'GET', '/cursos')).data.cursos.some(item => item.professor === 'Professor Sem Turma'), false);
    const virtualChurch = await call(manager, 'POST', '/professores', {
      nome: 'Professor Local Virtual',
      contato: 'professor.local.virtual@example.com',
      telefone: '(71) 99999-8765',
      local: 'EAD',
    });
    assert.equal(virtualChurch.status, 400);
    assert.match(virtualChurch.data.errors.local, /igreja física/i);
    const clarinetCatalog = await call(manager, 'POST', '/api/catalogos/cursos', { nome: 'Clarinete' });
    assert.equal(clarinetCatalog.status, 201, JSON.stringify(clarinetCatalog.data));
    const professorOptions = (await call(professorSession, 'GET', '/api/professores/me/turmas/opcoes')).data;
    const clarinetOption = professorOptions.cursos.find(item => item.nome === 'Clarinete');
    const eadOption = professorOptions.locais.find(item => item.nome === 'EAD');
    const customOffering = await call(professorSession, 'POST', '/api/professores/me/turmas', {
      courseId: clarinetOption.id,
      locationId: eadOption.id,
      horarios: [{ tipo: 'semanal', weekday: 'Domingo', start_time: '05:00' }],
    });
    assert.equal(customOffering.status, 201, JSON.stringify(customOffering.data));
    const createdOffering = (await call(manager, 'GET', '/cursos')).data.cursos.find(item => item.id === customOffering.data.id);
    assert.equal(createdOffering.nome, 'Clarinete');
    assert.equal(createdOffering.local, 'EAD');
    const catalogsAfterCreate = (await call(manager, 'GET', '/api/catalogos')).data;
    assert.equal(catalogsAfterCreate.cursos.some(item => item.nome === 'Clarinete' && item.ativo), true);
    assert.equal(catalogsAfterCreate.locais.some(item => item.nome === 'EAD' && item.ativo), true);
    const alternateCourse = professorOptions.cursos.find(item => item.id !== clarinetOption.id);
    const mirantesOption = professorOptions.locais.find(item => item.nome === 'Mirantes de Periperi');
    const forbiddenCourseUpdate = await call(professorSession, 'PUT', `/api/professores/me/turmas/${customOffering.data.id}`, {
      courseId: alternateCourse.id, locationId: mirantesOption.id,
      horarios: [{ tipo: 'semanal', weekday: 'Domingo', start_time: '05:00' }],
    });
    assert.equal(forbiddenCourseUpdate.status, 400);
    assert.match(forbiddenCourseUpdate.data.message, /não pode ser alterado/i);
    const customUpdate = await call(professorSession, 'PUT', `/api/professores/me/turmas/${customOffering.data.id}`, {
      courseId: clarinetOption.id, locationId: mirantesOption.id,
      horarios: [{ tipo: 'semanal', weekday: 'Domingo', start_time: '05:00' }],
    });
    assert.equal(customUpdate.status, 200, JSON.stringify(customUpdate.data));
    const updatedOffering = (await call(manager, 'GET', '/cursos')).data.cursos.find(item => item.id === customOffering.data.id);
    assert.equal(updatedOffering.nome, 'Clarinete');
    assert.equal(updatedOffering.local, 'Mirantes de Periperi');
    const church = await call(manager, 'POST', '/api/churches', { nome: 'Igreja Modelo Acadêmico' });
    assert.equal(church.status, 201, JSON.stringify(church.data));

    const studentPayload = (name, classId = offering.id) => ({
      nome: name,
      contato: `${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'')}@example.test`,
      telefone: '(71) 99999-1000',
      classe: 'Jovem',
      church_id: church.data.id,
      turmas: Array.isArray(classId) ? classId : [classId],
      instrumento: 'Não',
    });
    const missingEmail = await call(manager, 'POST', '/alunos', { ...studentPayload('Aluno Sem E-mail'), contato: '' });
    assert.equal(missingEmail.status, 400);
    assert.equal(missingEmail.data.errors.contato, 'O e-mail é obrigatório.');
    const first = await call(manager, 'POST', '/alunos', studentPayload('Aluno Sem Email Um'));
    const second = await call(manager, 'POST', '/alunos', studentPayload('Aluno Sem Email Dois'));
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(second.status, 201, JSON.stringify(second.data));
    assert.equal(first.data.invitation.sent, true, JSON.stringify(first.data));
    assert.equal(second.data.invitation.sent, true, JSON.stringify(second.data));
    const creationNotifications = await (await fetch(`${baseUrl}/dev-mail`)).text();
    assert.ok(creationNotifications.includes('Novo aluno em sua turma'));
    assert.ok(creationNotifications.includes('Seu acesso de aluno'));
    assert.ok(creationNotifications.includes('Aluno Sem Email Um'));
    assert.ok(creationNotifications.includes(offering.nome));
    assert.ok(creationNotifications.includes(offering.local));
    const customChurchStudent = await call(manager, 'POST', '/alunos', {
      ...studentPayload('Aluno de Igreja Digitada'),
      church_id: 'ICM Mirantes de Periperi',
    });
    assert.equal(customChurchStudent.status, 201, JSON.stringify(customChurchStudent.data));
    const churchesAfterCustomStudent = await call(manager, 'GET', '/api/churches');
    assert.equal(churchesAfterCustomStudent.data.some(item => item.nome === 'Mirantes de Periperi'), true);
    const customChurchDirectory = await call(manager, 'GET', '/alunos?search=Aluno%20de%20Igreja%20Digitada');
    assert.equal(customChurchDirectory.data.alunos[0].igreja, 'Mirantes de Periperi');

    const invalidTeen = await call(manager, 'POST', '/alunos', { ...studentPayload('Adolescente Sem Responsável'), classe: 'Adolescente' });
    assert.equal(invalidTeen.status, 400);
    assert.ok(invalidTeen.data.errors.guardian_name);
    assert.ok(invalidTeen.data.errors.guardian_phone);
    assert.ok(invalidTeen.data.errors.guardian_consent);
    const validTeen = await call(manager, 'POST', '/alunos', {
      ...studentPayload('Adolescente Com Responsável'),
      classe: 'Adolescente',
      guardian_name: 'Responsável Modelo',
      guardian_phone: '(71) 98888-7777',
      guardian_consent: true,
    });
    assert.equal(validTeen.status, 201, JSON.stringify(validTeen.data));

    const offeringCourseOption = professorOptions.cursos.find(item => item.nome === offering.nome);
    const offeringLocationOption = professorOptions.locais.find(item => item.nome === offering.local);
    const parallel = await call(professorSession, 'POST', '/api/professores/me/turmas', {
      courseId: offeringCourseOption.id, locationId: offeringLocationOption.id,
      horarios: [{ tipo: 'semanal', weekday: 'Domingo', start_time: '05:20' }],
    });
    assert.equal(parallel.status, 201, JSON.stringify(parallel.data));
    const parallelId = Number(parallel.data.id);
    const capacityDb = new DatabaseSync(databasePath);
    capacityDb.prepare('UPDATE classes SET capacity=1,label=? WHERE id=?').run('Turma B', parallelId);
    capacityDb.close();
    const fullStudent = await call(manager, 'POST', '/alunos', studentPayload('Aluno Ocupa Última Vaga', parallelId));
    assert.equal(fullStudent.status, 201, JSON.stringify(fullStudent.data));
    const rejected = await call(manager, 'POST', '/alunos', studentPayload('Aluno Excede Capacidade', parallelId));
    assert.equal(rejected.status, 400);
    assert.match(rejected.data.errors.curso, /capacidade máxima/i);

    const destination = await call(professorSession, 'POST', '/api/professores/me/turmas', {
      courseId: offeringCourseOption.id, locationId: offeringLocationOption.id,
      horarios: [{ tipo: 'semanal', weekday: 'Domingo', start_time: '05:40' }],
    });
    assert.equal(destination.status, 201, JSON.stringify(destination.data));
    const destinationDb = new DatabaseSync(databasePath);
    destinationDb.prepare('UPDATE classes SET capacity=10,label=? WHERE id=?').run('Turma C', destination.data.id);
    destinationDb.close();
    const updated = await call(manager, 'PUT', `/alunos/${first.data.id}`, studentPayload('Aluno Sem Email Um', destination.data.id));
    assert.equal(updated.status, 200, JSON.stringify(updated.data));
    const editNotifications = await (await fetch(`${baseUrl}/dev-mail`)).text();
    assert.match(editNotifications, /Turma C/i);
    assert.ok(editNotifications.includes(offering.local));
    const unchangedClassesUpdate = await call(manager, 'PUT', `/alunos/${first.data.id}`, studentPayload('Aluno Sem Email Um Atualizado', destination.data.id));
    assert.equal(unchangedClassesUpdate.status, 200, JSON.stringify(unchangedClassesUpdate.data));
    assert.equal(unchangedClassesUpdate.data.emailConfirmation.sent, true, JSON.stringify(unchangedClassesUpdate.data));
    assert.equal(unchangedClassesUpdate.data.emailConfirmation.kind, 'invitation');
    const unchangedUpdateNotifications = await (await fetch(`${baseUrl}/dev-mail`)).text();
    assert.ok(unchangedUpdateNotifications.includes('Aluno Sem Email Um Atualizado'));
    const secondaryOffering = classes.data.cursos.find(item => item.professor === 'Marina Oliveira' && item.id !== offering.id);
    assert.ok(secondaryOffering);
    const addedSecondary = await call(manager, 'PUT', `/alunos/${first.data.id}`, studentPayload('Aluno Sem Email Um Atualizado', [destination.data.id, secondaryOffering.id]));
    assert.equal(addedSecondary.status, 200, JSON.stringify(addedSecondary.data));
    const removedSecondary = await call(manager, 'PUT', `/alunos/${first.data.id}`, studentPayload('Aluno Sem Email Um Atualizado', destination.data.id));
    assert.equal(removedSecondary.status, 200, JSON.stringify(removedSecondary.data));
    const removalNotifications = await (await fetch(`${baseUrl}/dev-mail`)).text();
    assert.match(removalNotifications, /foi removida da turma/i);
    assert.ok(removalNotifications.includes(secondaryOffering.nome));

    const contact = await call(manager, 'POST', `/api/alunos/${second.data.id}/contatos`, { note: 'Responsável pediu retorno amanhã.', outcome: 'retorno_agendado' });
    assert.equal(contact.status, 201, JSON.stringify(contact.data));
    const deleted = await call(manager, 'DELETE', `/alunos/${second.data.id}`);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    assert.equal(deleted.data.anonymized, true);

    assert.equal((await call(manager, 'GET', '/api/audit-log?limit=50')).status, 404);
    assert.equal((await call(professorSession, 'GET', '/api/audit-log')).status, 404);
    const anonymousDropout = await call(manager, 'GET', '/api/relatorios/evasao?motivo=outro');
    assert.equal(anonymousDropout.status, 200, JSON.stringify(anonymousDropout.data));
    assert.ok(anonymousDropout.data.some(entry => entry.aluno === 'Aluno anonimizado' && entry.categoria === 'Outro'));

    database = new DatabaseSync(databasePath);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM audit_log WHERE action=?').get(`student_anonymized:${second.data.id}`).total, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM students WHERE active=1 AND email IS NULL').get().total, 0);
    assert.equal(database.prepare('SELECT church_id FROM students WHERE id=?').get(first.data.id).church_id, church.data.id);
    const teen = database.prepare('SELECT guardian_name,guardian_consent_at FROM students WHERE id=?').get(validTeen.data.id);
    assert.equal(teen.guardian_name, 'Responsável Modelo');
    assert.ok(teen.guardian_consent_at);
    const oldEnrollment = database.prepare('SELECT status,transferred_to_class_id FROM enrollments WHERE student_id=? AND class_id=?').get(first.data.id, offering.id);
    assert.equal(oldEnrollment.status, 'cancelada');
    assert.equal(oldEnrollment.transferred_to_class_id, destination.data.id);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE student_id=? AND class_id=? AND status='ativa'").get(first.data.id, destination.data.id).total, 1);
    const anonymized = database.prepare('SELECT * FROM students WHERE id=?').get(second.data.id);
    assert.equal(anonymized.name, `Aluno anonimizado #${second.data.id}`);
    for (const field of ['email','phone','guardian_name','guardian_phone','guardian_consent_at','church_id','age_group']) assert.equal(anonymized[field], null);
    assert.equal(anonymized.active, 0);
    assert.ok(anonymized.anonymized_at);
    assert.ok(anonymized.anonymized_by);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM student_contacts WHERE student_id=?').get(second.data.id).total, 0);
    assert.ok(database.prepare('SELECT COUNT(*) AS total FROM enrollments WHERE student_id=?').get(second.data.id).total > 0);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE student_id=? AND status='ativa'").get(second.data.id).total, 0);
    const dropout = database.prepare('SELECT reason,reason_category FROM dropout_events WHERE student_id=? ORDER BY id DESC LIMIT 1').get(second.data.id);
    assert.equal(dropout.reason, 'Dados anonimizados por solicitação');
    assert.equal(dropout.reason_category, 'outro');
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM audit_log WHERE action=?').get(`student_anonymized:${second.data.id}`).total, 1);
  } finally {
    database?.close();
    await app.close();
  }
});
