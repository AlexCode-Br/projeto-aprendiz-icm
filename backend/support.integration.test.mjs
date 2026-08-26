import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot=join(dirname(fileURLToPath(import.meta.url)),'..');

const passwordHash=password=>{
  const salt=randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password,salt,64).toString('hex')}`;
};

async function waitForServer(baseUrl,processState){
  for(let attempt=0;attempt<60;attempt+=1){
    if(processState.exitCode!==null)throw new Error(`Servidor encerrou antes do teste: ${processState.logs}`);
    try{const response=await fetch(`${baseUrl}/api/health`);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Servidor não iniciou: ${processState.logs}`);
}

test('suporte mantém conversa bidirecional, isolamento, leitura, status e idempotência',{timeout:40000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'projeto-aprendiz-support-'));
  const databasePath=join(directory,'support.db');
  const port=44000+(process.pid%1000);
  const baseUrl=`http://127.0.0.1:${port}`;
  let logs='';
  const server=spawn(process.execPath,['backend/server.mjs'],{
    cwd:projectRoot,
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:baseUrl,SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',SEED_DEMO_DATA:'true',NODE_ENV:'test'},
    stdio:['ignore','pipe','pipe'],
  });
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  const state={get exitCode(){return server.exitCode;},get logs(){return logs;}};

  const call=async(session,method,path,body)=>{
    const response=await fetch(`${baseUrl}${path}`,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(session?.cookie?{Cookie:session.cookie}:{}),...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    return {status:response.status,data,headers:response.headers};
  };
  const login=async(email,password)=>{
    const result=await call(null,'POST','/api/auth/login',{email,password});
    assert.equal(result.status,200,JSON.stringify(result.data));
    return {cookie:String(result.headers.get('set-cookie')).split(';')[0],csrf:result.data.csrfToken,user:result.data.user};
  };
  const createTicket=async(session,subject,message,clientId)=>{
    const result=await call(session,'POST','/api/suporte',{assunto:subject,categoria:'Frequência',mensagem:message,client_message_id:clientId});
    assert.ok([200,201].includes(result.status),JSON.stringify(result.data));
    return result.data.id;
  };

  try{
    await waitForServer(baseUrl,state);
    const directDatabase=new DatabaseSync(databasePath);
    directDatabase.exec('PRAGMA foreign_keys=ON; DELETE FROM support_ticket_events; DELETE FROM support_ticket_reads; DELETE FROM support_messages; DELETE FROM support_tickets;');
    const insertUser=directDatabase.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'professor')");
    insertUser.run('Professor Bruno','bruno.support@example.com',passwordHash('ProfessorB@2026!'));
    insertUser.run('Professor Carla','carla.support@example.com',passwordHash('ProfessorC@2026!'));
    directDatabase.close();

    const gestor=await login('gestor@projetoaprendiz.local','Gestor@2026!');
    const professorA=await login('professor@projetoaprendiz.local','Professor@2026!');
    const professorB=await login('bruno.support@example.com','ProfessorB@2026!');
    const professorC=await login('carla.support@example.com','ProfessorC@2026!');

    const oversizedTicket=await call(professorA,'POST','/api/suporte',{assunto:'Mensagem grande',categoria:'Outro',mensagem:'a'.repeat(4001),client_message_id:'oversized-ticket-000001'});
    assert.equal(oversizedTicket.status,400);

    const ticketA=await createTicket(professorA,'Frequência da turma A','A frequência da turma A não salva.','ticket-a-000000000001');
    const duplicateTicket=await createTicket(professorA,'Frequência da turma A','A frequência da turma A não salva.','ticket-a-000000000001');
    assert.equal(duplicateTicket,ticketA);
    const ticketB=await createTicket(professorB,'Acesso do professor B','O professor B precisa revisar o acesso.','ticket-b-000000000001');
    const ticketC=await createTicket(professorC,'Relatório do professor C','O relatório do professor C não abre.','ticket-c-000000000001');

    const managerList=await call(gestor,'GET','/api/suporte');
    assert.equal(managerList.status,200);
    assert.equal(managerList.data.length,3);
    assert.deepEqual(new Set(managerList.data.map(ticket=>ticket.nome)),new Set(['Marina Oliveira','Professor Bruno','Professor Carla']));
    assert.equal((await call(gestor,'GET','/api/suporte/nao-lidos')).data.total,3);
    const searched=await call(gestor,'GET','/api/suporte?search=professor%20B');
    assert.deepEqual(searched.data.map(ticket=>ticket.id),[ticketB]);

    const initialDetail=await call(gestor,'GET',`/api/suporte/${ticketA}`);
    assert.equal(initialDetail.status,200);
    assert.deepEqual(initialDetail.data.messages.map(message=>message.body),['A frequência da turma A não salva.']);
    await call(gestor,'POST',`/api/suporte/${ticketA}/lido`,{last_message_id:initialDetail.data.messages.at(-1).id});

    const managerReplyId='manager-reply-00000001';
    assert.equal((await call(gestor,'POST',`/api/suporte/${ticketA}/responder`,{mensagem:'Verificamos o caso e ajustamos a configuração.',client_message_id:managerReplyId})).status,201);
    assert.equal((await call(gestor,'POST',`/api/suporte/${ticketA}/responder`,{mensagem:'Verificamos o caso e ajustamos a configuração.',client_message_id:managerReplyId})).data.duplicate,true);

    const professorView=await call(professorA,'GET',`/api/suporte/${ticketA}`);
    assert.equal(professorView.status,200);
    assert.equal(professorView.data.ticket.status,'Em atendimento');
    assert.deepEqual(professorView.data.messages.map(message=>message.body),['A frequência da turma A não salva.','Verificamos o caso e ajustamos a configuração.']);
    assert.equal((await call(professorA,'GET','/api/suporte/nao-lidos')).data.total,1);
    await call(professorA,'POST',`/api/suporte/${ticketA}/lido`,{last_message_id:professorView.data.messages.at(-1).id});
    assert.equal((await call(professorA,'GET','/api/suporte/nao-lidos')).data.total,0);
    assert.equal((await call(professorB,'POST',`/api/suporte/${ticketB}/lido`,{last_message_id:professorView.data.messages.at(-1).id})).status,400);

    assert.equal((await call(professorA,'POST',`/api/suporte/${ticketA}/responder`,{mensagem:'Funcionou parcialmente; ainda aparece um aviso.',client_message_id:'professor-a-reply-000001'})).status,201);
    const managerAfterReply=await call(gestor,'GET',`/api/suporte/${ticketA}`);
    assert.equal(managerAfterReply.data.messages.length,3);
    assert.equal(managerAfterReply.data.messages.at(-1).author_role,'professor');
    assert.deepEqual([...managerAfterReply.data.messages.map(message=>message.id)].sort((a,b)=>a-b),managerAfterReply.data.messages.map(message=>message.id));
    const managerUnread=await call(gestor,'GET','/api/suporte?unread=1');
    assert.ok(managerUnread.data.some(ticket=>ticket.id===ticketA&&ticket.aguardando==='Gestor'));

    assert.equal((await call(professorA,'GET',`/api/suporte/${ticketB}`)).status,404);
    assert.equal((await call(professorA,'POST',`/api/suporte/${ticketB}/responder`,{mensagem:'Tentativa indevida',client_message_id:'forbidden-message-0001'})).status,404);
    assert.equal((await call(professorA,'PUT',`/api/suporte/${ticketB}/status`,{status:'Resolvido'})).status,403);

    assert.equal((await call(gestor,'PUT',`/api/suporte/${ticketA}/status`,{status:'Resolvido'})).status,200);
    assert.equal((await call(professorA,'GET',`/api/suporte/${ticketA}`)).data.ticket.status,'Resolvido');
    const reopened=await call(professorA,'POST',`/api/suporte/${ticketA}/responder`,{mensagem:'O problema voltou depois de atualizar a página.',client_message_id:'professor-a-reopen-00001'});
    assert.equal(reopened.status,201);
    assert.equal(reopened.data.status,'Aberto');

    for(const [session,ticketId,foreignText] of [[professorB,ticketB,'turma A'],[professorC,ticketC,'professor B']]){
      const ownDetail=await call(session,'GET',`/api/suporte/${ticketId}`);
      assert.equal(ownDetail.status,200);
      assert.ok(ownDetail.data.messages.every(message=>!message.body.includes(foreignText)));
    }
    const finalDetail=await call(gestor,'GET',`/api/suporte/${ticketA}`);
    assert.equal(finalDetail.data.messages.filter(message=>message.body==='Verificamos o caso e ajustamos a configuração.').length,1);
    assert.ok(finalDetail.data.events.some(event=>event.to_status==='Resolvido'));
    assert.ok(finalDetail.data.events.some(event=>event.to_status==='Aberto'));
  }finally{
    if(server.exitCode===null)server.kill('SIGTERM');
    await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
