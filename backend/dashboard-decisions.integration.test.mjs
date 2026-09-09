import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot=join(dirname(fileURLToPath(import.meta.url)),'..');
const shiftDate=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86_400_000).toISOString().slice(0,10);

async function waitForServer(baseUrl,state){
  for(let attempt=0;attempt<60;attempt+=1){
    if(state.exitCode!==null)throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try{if((await fetch(`${baseUrl}/api/health`)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

test('dashboard do gestor mostra somente totais administrativos e alunos por turma',{timeout:40_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'projeto-aprendiz-dashboard-')),databasePath=join(directory,'dashboard.db'),port=51_000+(process.pid%1_000),baseUrl=`http://127.0.0.1:${port}`;
  let logs='';
  const server=spawn(process.execPath,['backend/server.mjs'],{cwd:projectRoot,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:baseUrl,SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',SEED_DEMO_DATA:'true',NODE_ENV:'test',APP_TIMEZONE:'UTC'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  const state={get exitCode(){return server.exitCode;},get logs(){return logs;}};
  const call=async(session,method,path,body)=>{
    const response=await fetch(`${baseUrl}${path}`,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(session?.cookie?{Cookie:session.cookie}:{}),...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return{status:response.status,data:await response.json().catch(()=>({})),headers:response.headers};
  };

  try{
    await waitForServer(baseUrl,state);
    const login=await call(null,'POST','/api/auth/login',{email:'gestor@projetoaprendiz.local',password:'Gestor@2026!'});
    assert.equal(login.status,200,JSON.stringify(login.data));
    const manager={cookie:String(login.headers.get('set-cookie')).split(';')[0],csrf:login.data.csrfToken};
    const professorLogin=await call(null,'POST','/api/auth/login',{email:'professor@projetoaprendiz.local',password:'Professor@2026!'});
    assert.equal(professorLogin.status,200,JSON.stringify(professorLogin.data));
    const professor={cookie:String(professorLogin.headers.get('set-cookie')).split(';')[0],csrf:professorLogin.data.csrfToken};
    const today=new Date().toISOString().slice(0,10),database=new DatabaseSync(databasePath);
    database.prepare("UPDATE school_years SET start_date=?,end_date=?,dates_confirmed=1 WHERE active=1").run(shiftDate(today,-180),shiftDate(today,180));
    database.exec("UPDATE enrollments SET enrolled_at='2000-01-01'; UPDATE dropout_events SET occurred_at='2000-01-01'; DELETE FROM attendance_records; DELETE FROM attendance_sessions;");
    const enrollmentIds=database.prepare('SELECT id,student_id FROM enrollments ORDER BY id LIMIT 3').all();
    assert.equal(enrollmentIds.length,3);
    database.prepare('UPDATE enrollments SET enrolled_at=? WHERE id=?').run(shiftDate(today,-1),enrollmentIds[0].id);
    database.prepare('UPDATE enrollments SET enrolled_at=? WHERE id=?').run(shiftDate(today,-2),enrollmentIds[1].id);
    database.prepare('UPDATE enrollments SET enrolled_at=? WHERE id=?').run(shiftDate(today,-35),enrollmentIds[2].id);
    const photoDataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    database.prepare("INSERT INTO profile_photos (owner_type,owner_id,mime_type,size_bytes,data_url) VALUES ('student',?,'image/png',?,?)").run(enrollmentIds[0].student_id,Buffer.from(photoDataUrl.split(',')[1],'base64').length,photoDataUrl);
    const classRow=database.prepare(`SELECT classes.id,professor_profiles.user_id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id JOIN enrollments ON enrollments.class_id=classes.id WHERE enrollments.status='ativa' AND professor_profiles.user_id IS NOT NULL GROUP BY classes.id,professor_profiles.user_id HAVING COUNT(enrollments.id)>=2 LIMIT 1`).get();
    assert.ok(classRow);
    database.prepare('UPDATE classes SET capacity=4 WHERE id=?').run(classRow.id);
    const students=database.prepare("SELECT student_id FROM enrollments WHERE class_id=? AND status='ativa' ORDER BY id LIMIT 2").all(classRow.id);
    const currentSession=database.prepare('INSERT INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?)').run(classRow.id,shiftDate(today,-7),classRow.user_id).lastInsertRowid;
    database.prepare("INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?)").run(currentSession,students[0].student_id,'presente');
    database.prepare("INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?)").run(currentSession,students[1].student_id,'ausente');
    const previousSession=database.prepare('INSERT INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?)').run(classRow.id,shiftDate(today,-35),classRow.user_id).lastInsertRowid;
    for(const student of students)database.prepare("INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?)").run(previousSession,student.student_id,'ausente');
    database.prepare("INSERT INTO dropout_events (student_id,class_id,reason,reason_category,occurred_at) VALUES (?,?,?,?,?)").run(students[0].student_id,classRow.id,'Mudança de cidade','mudanca',shiftDate(today,-3));
    database.close();

    const response=await call(manager,'GET','/api/dashboard/gestor');
    assert.equal(response.status,200,JSON.stringify(response.data));
    assert.equal(response.data.stats.totalAlunos>0,true);
    assert.equal(response.data.stats.cursosAtivos>0,true);
    assert.equal(Object.hasOwn(response.data.stats,'frequencia'),false);
    assert.equal(Object.hasOwn(response.data,'baixaFrequencia'),false);
    assert.equal(Object.hasOwn(response.data,'alunosRisco'),false);
    assert.equal(Object.hasOwn(response.data,'chamadasPendentes'),false);
    const classMetric=response.data.alunosPorTurma.find(item=>item.id===Number(classRow.id));
    assert.equal(classMetric.total,2);
    assert.equal(typeof classMetric.curso,'string');
    assert.equal(typeof classMetric.local,'string');
    assert.equal(Object.hasOwn(classMetric,'frequencia'),false);
    assert.equal(Object.hasOwn(classMetric,'frequenciaAtual'),false);
    assert.ok(Array.isArray(response.data.ultimasInscricoes));
    const recentStudentWithPhoto=response.data.ultimasInscricoes.find(item=>Number(item.id)===Number(enrollmentIds[0].student_id));
    assert.match(recentStudentWithPhoto?.foto_url||'',new RegExp(`^/api/alunos/${enrollmentIds[0].student_id}/foto\\?v=`));
    const photoResponse=await call(manager,'GET',recentStudentWithPhoto.foto_url);
    assert.equal(photoResponse.status,200);
    assert.equal(photoResponse.headers.get('cache-control'),'private, max-age=31536000, immutable');

    const professorDashboard=await call(professor,'GET','/api/dashboard/professor');
    assert.equal(professorDashboard.status,200,JSON.stringify(professorDashboard.data));
    assert.equal(professorDashboard.data.stats.turmasAtivas>0,true);
    assert.ok(Array.isArray(professorDashboard.data.proximasAulas));
    assert.ok(Array.isArray(professorDashboard.data.frequenciaPorTurma));
    const classFrequency=professorDashboard.data.frequenciaPorTurma.find(item=>item.id===Number(classRow.id));
    assert.deepEqual({aulas:classFrequency.aulas,registros:classFrequency.registros,frequencia:classFrequency.frequencia},{aulas:2,registros:4,frequencia:25});
    assert.equal(professorDashboard.data.conflitosHorario.length>0,true,'horários legados sobrepostos devem ser sinalizados');
  }finally{
    if(server.exitCode===null)server.kill('SIGTERM');
    await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
