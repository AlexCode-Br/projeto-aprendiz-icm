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

    const classes = await call(manager, 'GET', '/cursos');
    const offering = classes.data.cursos[0];
    assert.ok(offering);
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

    const invalidTeen = await call(manager, 'POST', '/alunos', { ...studentPayload('Adolescente Sem Responsável'), classe: 'Adolescente' });
    assert.equal(invalidTeen.status, 400);
    assert.ok(invalidTeen.data.errors.guardian_name);
    assert.ok(invalidTeen.data.errors.guardian_phone);
    const validTeen = await call(manager, 'POST', '/alunos', {
      ...studentPayload('Adolescente Com Responsável'),
      classe: 'Adolescente',
      guardian_name: 'Responsável Modelo',
      guardian_phone: '(71) 98888-7777',
    });
    assert.equal(validTeen.status, 201, JSON.stringify(validTeen.data));

    const parallel = await call(manager, 'POST', '/cursos', {
      nome: offering.nome,
      local: offering.local,
      professor: offering.professor,
      label: 'Turma B',
      capacity: 1,
      weekday: 'Terça-feira',
      start_time: '19:00',
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
      weekday: 'Quarta-feira',
      start_time: '19:00',
    });
    assert.equal(destination.status, 201, JSON.stringify(destination.data));
    const updated = await call(manager, 'PUT', `/alunos/${first.data.id}`, studentPayload('Aluno Sem Email Um', destination.data.id));
    assert.equal(updated.status, 200, JSON.stringify(updated.data));

    const deleted = await call(manager, 'DELETE', `/alunos/${second.data.id}`);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));

    const database = new DatabaseSync(databasePath);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM students WHERE email IS NULL').get().total >= 3, true);
    assert.equal(database.prepare('SELECT church_id FROM students WHERE id=?').get(first.data.id).church_id, church.data.id);
    assert.equal(database.prepare('SELECT guardian_name FROM students WHERE id=?').get(validTeen.data.id).guardian_name, 'Responsável Modelo');
    const oldEnrollment = database.prepare('SELECT status,transferred_to_class_id FROM enrollments WHERE student_id=? AND class_id=?').get(first.data.id, offering.id);
    assert.equal(oldEnrollment.status, 'cancelada');
    assert.equal(oldEnrollment.transferred_to_class_id, destination.data.id);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE student_id=? AND class_id=? AND status='ativa'").get(first.data.id, destination.data.id).total, 1);
    assert.equal(database.prepare('SELECT reason_category FROM dropout_events WHERE student_id=? ORDER BY id DESC LIMIT 1').get(second.data.id).reason_category, 'outro');
    database.close();
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
