import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot=join(dirname(fileURLToPath(import.meta.url)),'..');
const dataUrl=(mime,buffer)=>`data:${mime};base64,${buffer.toString('base64')}`;
const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.from('test-image')]);
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
const secondPdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n%%EOF');
const replacementPdf=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Version/1.7>>endobj\n%%EOF');

const passwordHash=password=>{
  const salt=randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password,salt,64).toString('hex')}`;
};

async function waitForServer(baseUrl,state){
  for(let attempt=0;attempt<60;attempt+=1){
    if(state.exitCode!==null)throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try{const response=await fetch(`${baseUrl}/api/health`);if(response.ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

function futureSchedule(){
  const future=new Date(Date.now()+24*60*60*1000);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(future).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return {dataAgendamento:`${parts.year}-${parts.month}-${parts.day}`,horaAgendamento:`${parts.hour}:${parts.minute}`};
}

test('informativos preservam agendamento, anexos, leitura individual e permissões',{timeout:40000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'projeto-aprendiz-announcements-'));
  const databasePath=join(directory,'announcements.db');
  const port=45000+(process.pid%1000);
  const baseUrl=`http://127.0.0.1:${port}`;
  let logs='';
  const server=spawn(process.execPath,['backend/server.mjs'],{
    cwd:projectRoot,
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:baseUrl,APP_TIMEZONE:'America/Sao_Paulo',SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',SEED_DEMO_DATA:'true',NODE_ENV:'test'},
    stdio:['ignore','pipe','pipe'],
  });
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  const state={get exitCode(){return server.exitCode;},get logs(){return logs;}};

  const call=async(session,method,path,body,{binary=false}={})=>{
    const response=await fetch(`${baseUrl}${path}`,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(session?.cookie?{Cookie:session.cookie}:{}),...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const data=binary?Buffer.from(await response.arrayBuffer()):await response.json().catch(()=>({}));
    return {status:response.status,data,headers:response.headers};
  };
  const login=async(email,password)=>{
    const result=await call(null,'POST','/api/auth/login',{email,password});
    assert.equal(result.status,200,JSON.stringify(result.data));
    return {cookie:String(result.headers.get('set-cookie')).split(';')[0],csrf:result.data.csrfToken};
  };

  try{
    await waitForServer(baseUrl,state);
    const directDatabase=new DatabaseSync(databasePath);
    directDatabase.exec('PRAGMA foreign_keys=ON;');
    const professorBUser=directDatabase.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'professor')").run('Professor Bruno','bruno.announcements@example.com',passwordHash('ProfessorB@2026!')).lastInsertRowid;
    directDatabase.prepare('INSERT INTO professor_profiles (user_id,name,email,active) VALUES (?,?,?,1)').run(professorBUser,'Professor Bruno','bruno.announcements@example.com');
    const professorAProfile=Number(directDatabase.prepare("SELECT professor_profiles.id FROM professor_profiles JOIN users ON users.id=professor_profiles.user_id WHERE users.email='professor@projetoaprendiz.local'").get().id);
    directDatabase.close();

    const gestor=await login('gestor@projetoaprendiz.local','Gestor@2026!');
    const professorA=await login('professor@projetoaprendiz.local','Professor@2026!');
    const professorB=await login('bruno.announcements@example.com','ProfessorB@2026!');
    const schedule=futureSchedule();
    const payload={
      titulo:'Regulamento e cronograma',categoria:'Geral',conteudo:'<p onclick="alert(1)"><strong>Leia os documentos</strong><script>alert(1)</script><a href="javascript:alert(1)">link inválido</a></p>',...schedule,fixarNoTopo:true,
      destinatarios:{todos:true,professores:[],cursos:[]},
      anexos:[
        {nome:'cronograma.png',tipo:'image/png',tamanho:png.length,dataUrl:dataUrl('image/png',png)},
        {nome:'regulamento.pdf',tipo:'application/pdf',tamanho:pdf.length,dataUrl:dataUrl('application/pdf',pdf)},
        {nome:'calendario.pdf',tipo:'application/pdf',tamanho:secondPdf.length,dataUrl:dataUrl('application/pdf',secondPdf)},
      ],
    };

    const invalidSchedule=await call(gestor,'POST','/api/informativos',{...payload,titulo:'Agendamento incompleto',modoEnvio:'agendar',dataAgendamento:'',horaAgendamento:'',anexos:[]});
    assert.equal(invalidSchedule.status,400);
    assert.ok(invalidSchedule.data.errors.dataAgendamento);
    assert.ok(invalidSchedule.data.errors.horaAgendamento);

    const immediate=await call(gestor,'POST','/api/informativos',{...payload,titulo:'Aviso enviado agora',modoEnvio:'agora',dataAgendamento:'',horaAgendamento:'',anexos:[]});
    assert.equal(immediate.status,201,JSON.stringify(immediate.data));
    const immediateManagerItem=(await call(gestor,'GET','/api/informativos')).data.find(item=>item.id===immediate.data.id);
    assert.equal(immediateManagerItem.status,'Publicado');
    assert.ok((await call(professorA,'GET','/api/informativos')).data.some(item=>item.id===immediate.data.id),'envio imediato deve aparecer sem data e hora preenchidas');

    assert.equal((await call(professorA,'POST','/api/informativos',payload)).status,403);
    const spoofed=await call(gestor,'POST','/api/informativos',{...payload,titulo:'Arquivo inválido',anexos:[{nome:'falso.pdf',tipo:'application/pdf',dataUrl:dataUrl('application/pdf',png)}]});
    assert.equal(spoofed.status,400);
    const oversizedPdf=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(10*1024*1024,0x20),Buffer.from('\n%%EOF')]);
    const oversized=await call(gestor,'POST','/api/informativos',{...payload,titulo:'Arquivo grande',anexos:[{nome:'grande.pdf',tipo:'application/pdf',dataUrl:dataUrl('application/pdf',oversizedPdf)}]});
    assert.equal(oversized.status,400);

    const created=await call(gestor,'POST','/api/informativos',payload);
    assert.equal(created.status,201,JSON.stringify(created.data));
    const announcementId=created.data.id;
    const managerScheduled=(await call(gestor,'GET','/api/informativos')).data.find(item=>item.id===announcementId);
    assert.equal(managerScheduled.data,schedule.dataAgendamento.split('-').reverse().join('/'));
    assert.equal(managerScheduled.hora,schedule.horaAgendamento);
    assert.equal(managerScheduled.status,'Agendado');
    assert.doesNotMatch(managerScheduled.conteudo,/onclick|<script|javascript:/i);
    assert.match(managerScheduled.conteudo,/<strong>Leia os documentos<\/strong>/);
    assert.equal((await call(professorA,'GET','/api/informativos')).data.some(item=>item.id===announcementId),false,'agendado não pode aparecer antes do horário');
    const initialUnread=Number((await call(professorA,'GET','/api/informativos/nao-lidos')).data.total);

    const publishDatabase=new DatabaseSync(databasePath);
    const publishedAt=new Date(Date.now()-2*60*1000);
    publishedAt.setUTCSeconds(0,0);
    publishDatabase.prepare('UPDATE announcements SET scheduled_at=?,published_at=? WHERE id=?').run(publishedAt.toISOString(),publishedAt.toISOString(),announcementId);
    publishDatabase.close();

    const listA=await call(professorA,'GET','/api/informativos');
    const itemA=listA.data.find(item=>item.id===announcementId);
    assert.ok(itemA);
    assert.equal(itemA.hasRead,false);
    assert.deepEqual(itemA.anexos.map(item=>item.tipo),['image/png','application/pdf','application/pdf']);
    const pagedA=await call(professorA,'GET','/api/informativos?page=1&limit=1&q=cronograma&read=nao-lidos');
    assert.equal(pagedA.status,200,JSON.stringify(pagedA.data));
    assert.equal(pagedA.data.items.length,1);
    assert.equal(pagedA.data.items[0].id,announcementId);
    assert.ok(pagedA.data.total>=1);
    const managerPaged=await call(gestor,'GET','/api/informativos?page=1&limit=1&status=Publicado');
    assert.equal(managerPaged.status,200,JSON.stringify(managerPaged.data));
    assert.equal(managerPaged.data.items.length,1);
    assert.ok(managerPaged.data.total>=1);
    assert.equal((await call(professorA,'GET','/api/informativos/nao-lidos')).data.total,initialUnread+1);
    assert.equal((await call(professorA,'POST',`/api/informativos/${announcementId}/lida`,{})).status,200);
    assert.equal((await call(professorA,'GET','/api/informativos/nao-lidos')).data.total,initialUnread);
    assert.equal((await call(professorB,'GET','/api/informativos')).data.find(item=>item.id===announcementId).hasRead,false,'leitura deve ser individual');
    const managerPublishedItem=(await call(gestor,'GET','/api/informativos')).data.find(item=>item.id===announcementId);
    assert.equal('lido' in managerPublishedItem,false,'o gestor não recebe contagem de visualizações');
    assert.equal((await call(gestor,'GET',`/api/informativos/${announcementId}/leituras`)).status,404,'a lista administrativa de leitores foi removida');

    const pdfAttachments=itemA.anexos.filter(item=>item.tipo==='application/pdf');
    const pdfAttachment=pdfAttachments[0];
    const openedPdf=await call(professorA,'GET',pdfAttachment.url,undefined,{binary:true});
    assert.equal(openedPdf.status,200);
    assert.equal(openedPdf.headers.get('content-type'),'application/pdf');
    assert.match(openedPdf.headers.get('content-disposition'),/^inline/);
    assert.deepEqual(openedPdf.data,pdf);

    const targeted=await call(gestor,'POST','/api/informativos',{...payload,titulo:'Somente professor A',destinatarios:{todos:false,professores:[professorAProfile],cursos:[]},anexos:[payload.anexos[1]]});
    assert.equal(targeted.status,201,JSON.stringify(targeted.data));
    const targetDatabase=new DatabaseSync(databasePath);
    targetDatabase.prepare('UPDATE announcements SET scheduled_at=?,published_at=? WHERE id=?').run(publishedAt.toISOString(),publishedAt.toISOString(),targeted.data.id);
    targetDatabase.close();
    const targetA=(await call(professorA,'GET','/api/informativos')).data.find(item=>item.id===targeted.data.id);
    assert.ok(targetA);
    assert.equal((await call(professorB,'GET','/api/informativos')).data.some(item=>item.id===targeted.data.id),false);
    assert.equal((await call(professorB,'GET',targetA.anexos[0].url,undefined,{binary:true})).status,404);
    assert.equal((await call(professorB,'POST',`/api/informativos/${targeted.data.id}/lida`,{})).status,404);

    const updated=await call(gestor,'PUT',`/api/informativos/${announcementId}`,{...payload,titulo:'Regulamento atualizado',anexos:[itemA.anexos[0],{nome:'regulamento-atualizado.pdf',tipo:'application/pdf',tamanho:replacementPdf.length,dataUrl:dataUrl('application/pdf',replacementPdf)}],dataAgendamento:itemA.data.split('/').reverse().join('-'),horaAgendamento:itemA.hora});
    assert.equal(updated.status,200,JSON.stringify(updated.data));
    const managerItem=(await call(gestor,'GET','/api/informativos')).data.find(item=>item.id===announcementId);
    assert.deepEqual(managerItem.anexos.map(item=>item.tipo),['image/png','application/pdf']);
    for(const oldPdf of pdfAttachments)assert.equal((await call(gestor,'GET',oldPdf.url,undefined,{binary:true})).status,404);
    const replacementAttachment=managerItem.anexos.find(item=>item.tipo==='application/pdf');
    assert.deepEqual((await call(professorA,'GET',replacementAttachment.url,undefined,{binary:true})).data,replacementPdf);

    assert.equal((await call(gestor,'DELETE',`/api/informativos/${announcementId}`)).status,200);
    assert.equal((await call(gestor,'GET','/api/informativos')).data.some(item=>item.id===announcementId),false);
    assert.equal((await call(gestor,'GET',managerItem.anexos[0].url,undefined,{binary:true})).status,404);

    const historicalDatabase=new DatabaseSync(databasePath);
    const professorCourse=historicalDatabase.prepare('SELECT classes.course_id FROM classes WHERE professor_id=? AND active=1 ORDER BY id LIMIT 1').get(professorAProfile);
    historicalDatabase.close();
    const courseTargeted=await call(gestor,'POST','/api/informativos',{...payload,titulo:'Aviso do curso no período atual',destinatarios:{todos:false,professores:[],cursos:[Number(professorCourse.course_id)]},anexos:[]});
    assert.equal(courseTargeted.status,201,JSON.stringify(courseTargeted.data));
    const periodDatabase=new DatabaseSync(databasePath);
    periodDatabase.prepare('UPDATE announcements SET scheduled_at=?,published_at=? WHERE id=?').run(publishedAt.toISOString(),publishedAt.toISOString(),courseTargeted.data.id);
    assert.equal((await call(professorA,'GET','/api/informativos')).data.some(item=>item.id===courseTargeted.data.id),true);
    periodDatabase.prepare('UPDATE school_years SET active=0,closed_at=CURRENT_TIMESTAMP WHERE active=1').run();
    periodDatabase.prepare("INSERT INTO school_years (label,start_date,end_date,active,dates_confirmed) VALUES ('Novo período','2027-01-01','2027-12-31',1,1)").run();
    periodDatabase.close();
    assert.equal((await call(professorA,'GET','/api/informativos')).data.some(item=>item.id===courseTargeted.data.id),false,'curso de período encerrado não concede acesso ao informativo');
    assert.equal((await call(professorA,'POST',`/api/informativos/${courseTargeted.data.id}/lida`,{})).status,404);
  }finally{
    if(server.exitCode===null)server.kill('SIGTERM');
    await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
