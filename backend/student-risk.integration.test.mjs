import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot=join(dirname(fileURLToPath(import.meta.url)),'..');

async function waitForServer(baseUrl,state){
  for(let attempt=0;attempt<60;attempt+=1){
    if(state.exitCode!==null)throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try{if((await fetch(`${baseUrl}/api/health`)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

test('dados de frequência e risco permanecem indisponíveis ao gestor',{timeout:40_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'projeto-aprendiz-risk-')),databasePath=join(directory,'risk.db'),port=50_000+(process.pid%1_000),baseUrl=`http://127.0.0.1:${port}`;
  let logs='';
  const server=spawn(process.execPath,['backend/server.mjs'],{cwd:projectRoot,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:baseUrl,SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',SEED_DEMO_DATA:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  const state={get exitCode(){return server.exitCode;},get logs(){return logs;}};
  const call=async(session,method,path,body)=>{
    const response=await fetch(`${baseUrl}${path}`,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(session?.cookie?{Cookie:session.cookie}:{}),...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return{status:response.status,data:await response.json().catch(()=>({})),headers:response.headers};
  };
  const login=async(email,password)=>{const response=await call(null,'POST','/api/auth/login',{email,password});assert.equal(response.status,200,JSON.stringify(response.data));return{cookie:String(response.headers.get('set-cookie')).split(';')[0],csrf:response.data.csrfToken};};
  const saveCall=async(professor,classId,date,studentId,targetStatus)=>{
    const attendance=await call(professor,'GET',`/frequencia?curso_id=${classId}&data=${date}`);
    assert.equal(attendance.status,200,JSON.stringify(attendance.data));
    const result=await call(professor,'POST','/frequencia',{curso_id:classId,data_aula:date,frequencias:attendance.data.alunos.map(student=>({aluno_id:student.id,status:student.id===studentId?targetStatus:'presente'}))});
    assert.equal(result.status,200,JSON.stringify(result.data));
  };

  try{
    await waitForServer(baseUrl,state);
    const professor=await login('professor@projetoaprendiz.local','Professor@2026!'),manager=await login('gestor@projetoaprendiz.local','Gestor@2026!');
    const courses=await call(professor,'GET','/professores/meus-cursos'),classId=Number(courses.data[0].id);
    const setupDatabase=new DatabaseSync(databasePath);
    setupDatabase.prepare("UPDATE enrollments SET enrolled_at='2026-01-01' WHERE class_id=?").run(classId);
    setupDatabase.close();
    const students=(await call(professor,'GET',`/frequencia?curso_id=${classId}&data=2026-08-29`)).data.alunos;
    assert.ok(students.length>0);
    const studentId=Number(students[0].id);
    await saveCall(professor,classId,'2026-08-29',studentId,'ausente');
    await saveCall(professor,classId,'2026-08-30',studentId,'ausente');

    const risk=await call(manager,'GET','/api/alunos/risco');
    assert.equal(risk.status,404);
    const managerReport=await call(manager,'GET','/api/relatorios/frequencia');
    assert.equal(managerReport.status,403);
    const professorReport=await call(professor,'GET','/api/relatorios/frequencia');
    assert.equal(professorReport.status,200,JSON.stringify(professorReport.data));
    assert.ok(Array.isArray(professorReport.data));
    const detailedReport=await call(professor,'GET',`/api/relatorios/frequencia?detalhado=1&curso_id=${classId}`);
    assert.equal(detailedReport.status,200,JSON.stringify(detailedReport.data));
    assert.equal(detailedReport.data.resumo.turmas,1);
    assert.equal(detailedReport.data.resumo.chamadas,2);
    assert.equal(detailedReport.data.turmas[0].chamadas.length,2);
    const detailedStudent=detailedReport.data.turmas[0].alunos.find(student=>student.id===studentId);
    assert.equal(detailedStudent.ausentes,2);
    assert.equal(detailedStudent.frequencia,0);
    assert.equal(detailedStudent.frequencias.length,2);
    assert.deepEqual(detailedStudent.frequencias.map(item=>item.status),['ausente','ausente']);
    const database=new DatabaseSync(databasePath);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM attendance_records WHERE student_id=?').get(studentId).total,2);
    database.close();
  }finally{
    if(server.exitCode===null)server.kill('SIGTERM');
    await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
