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

test('duas faltas seguidas geram risco, contato auditável e justificativa encerra a sequência',{timeout:40_000},async()=>{
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
    const students=(await call(professor,'GET',`/frequencia?curso_id=${classId}&data=2026-08-29`)).data.alunos;
    assert.ok(students.length>0);
    const studentId=Number(students[0].id);
    await saveCall(professor,classId,'2026-08-29',studentId,'ausente');
    await saveCall(professor,classId,'2026-08-30',studentId,'ausente');

    const risk=await call(manager,'GET','/api/alunos/risco');
    assert.equal(risk.status,200);
    const atRisk=risk.data.alunos.find(student=>student.id===studentId);
    assert.equal(atRisk.faltasConsecutivas,2);
    assert.equal(atRisk.ultimoContato,null);

    const forbidden=await call(professor,'POST',`/api/alunos/${studentId}/contatos`,{note:'Tentativa indevida',outcome:'outro'});
    assert.equal(forbidden.status,403);
    const contact=await call(manager,'POST',`/api/alunos/${studentId}/contatos`,{note:'Responsável avisado e retorno combinado.',outcome:'retorno_agendado'});
    assert.equal(contact.status,201,JSON.stringify(contact.data));
    const history=await call(manager,'GET',`/api/alunos/${studentId}/contatos`);
    assert.equal(history.data[0].outcome,'retorno_agendado');
    assert.match(history.data[0].note,/Responsável avisado/);
    const refreshed=(await call(manager,'GET','/api/alunos/risco')).data.alunos.find(student=>student.id===studentId);
    assert.equal(refreshed.ultimoContato.outcome,'retorno_agendado');

    await saveCall(professor,classId,'2026-08-31',studentId,'justificado');
    const resolved=await call(manager,'GET','/api/alunos/risco');
    assert.equal(resolved.data.alunos.some(student=>student.id===studentId),false);
    const database=new DatabaseSync(databasePath);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM student_contacts WHERE student_id=?').get(studentId).total,1);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='student_contact_registered'").get().total,1);
    database.close();
  }finally{
    if(server.exitCode===null)server.kill('SIGTERM');
    await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
