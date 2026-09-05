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

test('chamada exige a turma completa e permanece exclusiva do professor', { timeout: 40_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-attendance-'));
  const databasePath = join(directory, 'attendance.db');
  const port = 49_000 + (process.pid % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, SQLITE_PATH: databasePath, AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test', APP_TIMEZONE: 'UTC' },
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
    await waitForServer(baseUrl,state);
    const login=await call(null,'POST','/api/auth/login',{email:'professor@projetoaprendiz.local',password:'Professor@2026!'});
    assert.equal(login.status,200,JSON.stringify(login.data));
    const professor={cookie:String(login.headers.get('set-cookie')).split(';')[0],csrf:login.data.csrfToken};
    const managerLogin=await call(null,'POST','/api/auth/login',{email:'gestor@projetoaprendiz.local',password:'Gestor@2026!'});
    assert.equal(managerLogin.status,200,JSON.stringify(managerLogin.data));
    const manager={cookie:String(managerLogin.headers.get('set-cookie')).split(';')[0],csrf:managerLogin.data.csrfToken};
    const courses=await call(professor,'GET','/professores/meus-cursos');
    assert.equal(courses.status,200);
    const professorStudents=await call(professor,'GET','/api/professores/me/alunos');
    assert.equal(professorStudents.status,200,JSON.stringify(professorStudents.data));
    assert.ok(Array.isArray(professorStudents.data.alunos));
    assert.equal((await call(manager,'GET','/api/professores/me/alunos')).status,403);
    const classId=Number(courses.data[0].id);
    assert.equal((await call(manager,'GET',`/frequencia?curso_id=${classId}&data=2026-08-29`)).status,403);
    assert.equal((await call(professor,'GET',`/frequencia?curso_id=${classId}&data=2026-02-31`)).status,400);
    assert.equal((await call(professor,'POST','/frequencia',{curso_id:classId,data_aula:'2026-02-31',frequencias:[]})).status,400);
    const today=new Date().toISOString().slice(0,10);
    const database=new DatabaseSync(databasePath);
    const professorProfile=database.prepare("SELECT professor_profiles.id FROM professor_profiles JOIN users ON users.id=professor_profiles.user_id WHERE users.email=?").get('professor@projetoaprendiz.local');
    const enrolledStudents=database.prepare("SELECT DISTINCT students.id FROM students JOIN enrollments ON enrollments.student_id=students.id JOIN classes ON classes.id=enrollments.class_id WHERE classes.professor_id=? AND classes.active=1 AND enrollments.status='ativa' AND students.active=1 ORDER BY students.id LIMIT 2").all(professorProfile.id);
    assert.equal(enrolledStudents.length,2);
    database.prepare("UPDATE enrollments SET enrolled_at='2000-01-01' WHERE class_id IN (SELECT id FROM classes WHERE professor_id=?)").run(professorProfile.id);
    database.prepare("UPDATE enrollments SET enrolled_at='2026-08-01' WHERE student_id=? AND class_id IN (SELECT id FROM classes WHERE professor_id=?)").run(enrolledStudents[1].id,professorProfile.id);
    const recentStudents=await call(professor,'GET','/api/professores/me/alunos?limit=1&order=recent');
    assert.equal(recentStudents.status,200,JSON.stringify(recentStudents.data));
    assert.equal(recentStudents.data.alunos.length,1);
    assert.equal(recentStudents.data.alunos[0].id,enrolledStudents[1].id);

    const attendance=await call(professor,'GET',`/frequencia?curso_id=${classId}&data=${today}`);
    assert.equal(attendance.status,200,JSON.stringify(attendance.data));
    assert.equal(attendance.data.registrada,false);
    assert.ok(attendance.data.alunos.length>0);

    const incomplete=await call(professor,'POST','/frequencia',{curso_id:classId,data_aula:today,frequencias:[]});
    assert.equal(incomplete.status,400);
    assert.match(incomplete.data.message,/todos os alunos/i);
    const complete=await call(professor,'POST','/frequencia',{
      curso_id:classId,
      data_aula:today,
      frequencias:attendance.data.alunos.map((student,index)=>({aluno_id:student.id,status:index===0?'ausente':'presente'})),
    });
    assert.equal(complete.status,200,JSON.stringify(complete.data));

    const saved=await call(professor,'GET',`/frequencia?curso_id=${classId}&data=${today}`);
    assert.equal(saved.data.registrada,true);
    assert.equal(saved.data.alunos.filter(student=>student.status==='ausente').length,1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='attendance_saved'").get().total,1);
    database.close();
  } finally {
    if(server.exitCode===null)server.kill('SIGTERM');
    await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
