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

test('exclusão de catálogos remove vínculos e preserva contatos sem autor', { timeout: 40_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-catalog-delete-'));
  const databasePath = join(directory, 'catalog-delete.db');
  const port = 55_000 + (process.pid % 1_000);
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

  const call = async (session, method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(session?.cookie ? { Cookie: session.cookie } : {}),
        ...(session?.csrf ? { 'X-CSRF-Token': session.csrf } : {}),
      },
    });
    return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers };
  };

  try {
    await waitForServer(baseUrl, state);
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'gestor@projetoaprendiz.local', password: 'Gestor@2026!' }),
    });
    const loginData = await loginResponse.json();
    assert.equal(loginResponse.status, 200, JSON.stringify(loginData));
    const manager = {
      cookie: String(loginResponse.headers.get('set-cookie')).split(';')[0],
      csrf: loginData.csrfToken,
    };

    const database = new DatabaseSync(databasePath);
    database.exec('PRAGMA foreign_keys=ON');
    const periodId = database.prepare('SELECT id FROM school_years WHERE active=1').get().id;
    const professor = database.prepare('SELECT id,home_location_id FROM professor_profiles WHERE active=1 ORDER BY id LIMIT 1').get();
    const studentId = database.prepare('SELECT id FROM students WHERE active=1 ORDER BY id LIMIT 1').get().id;
    const existingCourseId = database.prepare('SELECT id FROM courses WHERE active=1 ORDER BY id LIMIT 1').get().id;

    const courseId = Number(database.prepare("INSERT INTO courses (name) VALUES ('Curso removível com vínculos')").run().lastInsertRowid);
    const courseClassId = Number(database.prepare(`
      INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label)
      VALUES (?,?,?,?,?)
    `).run(periodId, courseId, professor.id, professor.home_location_id, 'Turma do curso removível').lastInsertRowid);
    database.prepare('INSERT INTO enrollments (student_id,class_id) VALUES (?,?)').run(studentId, courseClassId);

    const locationId = Number(database.prepare("INSERT INTO locations (name) VALUES ('Local removível com vínculos')").run().lastInsertRowid);
    const locationClassId = Number(database.prepare(`
      INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label)
      VALUES (?,?,?,?,?)
    `).run(periodId, existingCourseId, professor.id, locationId, 'Turma do local removível').lastInsertRowid);
    database.prepare('INSERT INTO enrollments (student_id,class_id) VALUES (?,?)').run(studentId, locationClassId);

    const removedUserId = Number(database.prepare(`
      INSERT INTO users (name,email,password_hash,role)
      VALUES ('Professor temporário','professor.removivel@example.test','hash-inutilizado','professor')
    `).run().lastInsertRowid);
    const removedProfessorId = Number(database.prepare(`
      INSERT INTO professor_profiles (user_id,name,email,home_location_id)
      VALUES (?,?,?,?)
    `).run(removedUserId, 'Professor temporário', 'professor.removivel@example.test', professor.home_location_id).lastInsertRowid);
    database.prepare(`
      INSERT INTO student_contacts (student_id,user_id,note,outcome)
      VALUES (?,?,?,'contatado')
    `).run(studentId, removedUserId, 'Contato que deve sobreviver à exclusão do autor');
    database.close();

    const deletedCourse = await call(manager, 'DELETE', `/api/catalogos/cursos/${courseId}`);
    assert.equal(deletedCourse.status, 200, JSON.stringify(deletedCourse.data));
    assert.deepEqual(deletedCourse.data.resumo, { turmas: 1, matriculas: 1 });

    const deletedLocation = await call(manager, 'DELETE', `/api/catalogos/locais/${locationId}`);
    assert.equal(deletedLocation.status, 200, JSON.stringify(deletedLocation.data));
    assert.deepEqual(deletedLocation.data.resumo, { turmas: 1, matriculas: 1 });

    const deletedProfessor = await call(manager, 'DELETE', `/professores/${removedProfessorId}`);
    assert.equal(deletedProfessor.status, 200, JSON.stringify(deletedProfessor.data));

    const contacts = await call(manager, 'GET', `/api/alunos/${studentId}/contatos`);
    assert.equal(contacts.status, 200, JSON.stringify(contacts.data));
    const retainedContact = contacts.data.find(contact => contact.note === 'Contato que deve sobreviver à exclusão do autor');
    assert.ok(retainedContact);
    assert.equal(retainedContact.registeredBy, 'Usuário removido');

    const verification = new DatabaseSync(databasePath);
    verification.exec('PRAGMA foreign_keys=ON');
    assert.equal(verification.prepare('SELECT COUNT(*) AS total FROM courses WHERE id=?').get(courseId).total, 0);
    assert.equal(verification.prepare('SELECT COUNT(*) AS total FROM locations WHERE id=?').get(locationId).total, 0);
    assert.equal(verification.prepare('SELECT COUNT(*) AS total FROM classes WHERE id IN (?,?)').get(courseClassId, locationClassId).total, 0);
    assert.equal(verification.prepare('SELECT COUNT(*) AS total FROM enrollments WHERE class_id IN (?,?)').get(courseClassId, locationClassId).total, 0);
    assert.equal(verification.prepare('SELECT user_id FROM student_contacts WHERE note=?').get('Contato que deve sobreviver à exclusão do autor').user_id, null);
    verification.close();
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
