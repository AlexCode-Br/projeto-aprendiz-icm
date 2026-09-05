import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function waitForServer(baseUrl, state) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (state.exitCode !== null) throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

test('modelo acadêmico preserva igrejas, responsáveis, capacidade e transferências', { timeout: 40_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-academic-'));
  const databasePath = join(directory, 'academic.db');
  const port = 48_000 + (process.pid % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, SQLITE_PATH: databasePath, AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test' },
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

  try {
    await waitForServer(baseUrl, state);
    const login = await call(null, 'POST', '/api/auth/login', { email: 'gestor@projetoaprendiz.local', password: 'Gestor@2026!' });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    const manager = { cookie: String(login.headers.get('set-cookie')).split(';')[0], csrf: login.data.csrfToken };

    const catalogs = await call(manager, 'GET', '/api/catalogos');
    assert.equal(catalogs.status, 200, JSON.stringify(catalogs.data));
    assert.ok(Array.isArray(catalogs.data.cursos));
    assert.ok(Array.isArray(catalogs.data.locais));

    const classes = await call(manager, 'GET', '/cursos');
    const offering = classes.data.cursos[0];
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
    assert.equal(professorsAfterProfileEdit.data.professores.find(item => item.id === existingProfessor.id).local, 'ICM Federação');
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
    const customOffering = await call(manager, 'POST', '/cursos', {
      nome: 'Clarinete',
      local: 'EAD',
      professor: offering.professor,
    });
    assert.equal(customOffering.status, 201, JSON.stringify(customOffering.data));
    const createdOffering = (await call(manager, 'GET', '/cursos')).data.cursos.find(item => item.id === customOffering.data.id);
    assert.equal(createdOffering.nome, 'Clarinete');
    assert.equal(createdOffering.local, 'EAD');
    const catalogsAfterCreate = (await call(manager, 'GET', '/api/catalogos')).data;
    assert.equal(catalogsAfterCreate.cursos.some(item => item.nome === 'Clarinete' && item.ativo), true);
    assert.equal(catalogsAfterCreate.locais.some(item => item.nome === 'EAD' && item.ativo), true);
    const customUpdate = await call(manager, 'PUT', `/cursos/${customOffering.data.id}`, {
      nome: 'Oboé',
      local: 'Mirantes de Periperi',
      professor: offering.professor,
    });
    assert.equal(customUpdate.status, 200, JSON.stringify(customUpdate.data));
    const updatedOffering = (await call(manager, 'GET', '/cursos')).data.cursos.find(item => item.id === customOffering.data.id);
    assert.equal(updatedOffering.nome, 'Oboé');
    assert.equal(updatedOffering.local, 'Mirantes de Periperi');
    const church = await call(manager, 'POST', '/api/churches', { nome: 'Igreja Modelo Acadêmico' });
    assert.equal(church.status, 201, JSON.stringify(church.data));

    const studentPayload = (name, classId = offering.id) => ({
      nome: name,
      contato: '',
      telefone: '(71) 99999-1000',
      classe: 'Jovem',
      church_id: church.data.id,
      turmas: [classId],
      instrumento: 'Não',
    });
    const first = await call(manager, 'POST', '/alunos', studentPayload('Aluno Sem Email Um'));
    const second = await call(manager, 'POST', '/alunos', studentPayload('Aluno Sem Email Dois'));
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(second.status, 201, JSON.stringify(second.data));
    const customChurchStudent = await call(manager, 'POST', '/alunos', {
      ...studentPayload('Aluno de Igreja Digitada'),
      church_id: 'ICM Mirantes de Periperi',
    });
    assert.equal(customChurchStudent.status, 201, JSON.stringify(customChurchStudent.data));
    const churchesAfterCustomStudent = await call(manager, 'GET', '/api/churches');
    assert.equal(churchesAfterCustomStudent.data.some(item => item.nome === 'ICM Mirantes de Periperi'), true);
    const customChurchDirectory = await call(manager, 'GET', '/alunos?search=Aluno%20de%20Igreja%20Digitada');
    assert.equal(customChurchDirectory.data.alunos[0].igreja, 'ICM Mirantes de Periperi');

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

    const parallel = await call(manager, 'POST', '/cursos', {
      nome: offering.nome,
      local: offering.local,
      professor: offering.professor,
      label: 'Turma B',
      capacity: 1,
    });
    assert.equal(parallel.status, 201, JSON.stringify(parallel.data));
    const parallelId = Number(parallel.data.id);
    const fullStudent = await call(manager, 'POST', '/alunos', studentPayload('Aluno Ocupa Última Vaga', parallelId));
    assert.equal(fullStudent.status, 201, JSON.stringify(fullStudent.data));
    const rejected = await call(manager, 'POST', '/alunos', studentPayload('Aluno Excede Capacidade', parallelId));
    assert.equal(rejected.status, 400);
    assert.match(rejected.data.errors.curso, /capacidade máxima/i);

    const destination = await call(manager, 'POST', '/cursos', {
      nome: offering.nome,
      local: offering.local,
      professor: offering.professor,
      label: 'Turma C',
      capacity: 10,
    });
    assert.equal(destination.status, 201, JSON.stringify(destination.data));
    const updated = await call(manager, 'PUT', `/alunos/${first.data.id}`, studentPayload('Aluno Sem Email Um', destination.data.id));
    assert.equal(updated.status, 200, JSON.stringify(updated.data));

    const contact = await call(manager, 'POST', `/api/alunos/${second.data.id}/contatos`, { note: 'Responsável pediu retorno amanhã.', outcome: 'retorno_agendado' });
    assert.equal(contact.status, 201, JSON.stringify(contact.data));
    const deleted = await call(manager, 'DELETE', `/alunos/${second.data.id}`);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    assert.equal(deleted.data.anonymized, true);

    assert.equal((await call(manager, 'GET', '/api/audit-log?limit=50')).status, 404);
    const professorLogin = await call(null, 'POST', '/api/auth/login', { email: 'professor@projetoaprendiz.local', password: 'Professor@2026!' });
    assert.equal(professorLogin.status, 200, JSON.stringify(professorLogin.data));
    const professorSession = { cookie: String(professorLogin.headers.get('set-cookie')).split(';')[0], csrf: professorLogin.data.csrfToken };
    assert.equal((await call(professorSession, 'GET', '/api/audit-log')).status, 404);
    const anonymousDropout = await call(manager, 'GET', '/api/relatorios/evasao?motivo=outro');
    assert.equal(anonymousDropout.status, 200, JSON.stringify(anonymousDropout.data));
    assert.ok(anonymousDropout.data.some(entry => entry.aluno === 'Aluno anonimizado' && entry.categoria === 'Outro'));

    const database = new DatabaseSync(databasePath);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM audit_log WHERE action=?').get(`student_anonymized:${second.data.id}`).total, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM students WHERE email IS NULL').get().total >= 3, true);
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
    database.close();
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
