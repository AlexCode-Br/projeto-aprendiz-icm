import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { startTestServer } from './test-support/server.mjs';

test('chat preserva histórico, isola professores, deduplica envios e respeita o corte de leitura',async()=>{
  const server=await startTestServer();
  let db;
  try{
    db=new DatabaseSync(server.databasePath);
    db.exec('PRAGMA foreign_keys=ON; DELETE FROM support_ticket_events; DELETE FROM support_ticket_reads; DELETE FROM support_messages; DELETE FROM support_tickets;');
    const salt=randomBytes(16),password='Professor@2026!';
    const hash=`scrypt$${salt.toString('hex')}$${scryptSync(password,salt,64).toString('hex')}`;
    const b=Number(db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'professor')").run('Professor de teste','chat.test@example.com',hash).lastInsertRowid);
    const page=await fetch(`${server.baseUrl}/login`);
    assert.equal(page.headers.get('permissions-policy'),'camera=(), microphone=(self), geolocation=()');
    assert.match(page.headers.get('content-security-policy'),/media-src 'self' blob:/);
    const manager=(await server.login('gestor@projetoaprendiz.local','Gestor@2026!')).session;
    const teacherLogin=await server.login('professor@projetoaprendiz.local',password);
    const teacher=teacherLogin.session,a=Number(teacherLogin.response.data.user.id);
    const second=(await server.login('chat.test@example.com',password)).session;
    const route=id=>`/api/suporte/conversas/${id}`;
    const send=(session,id,text,key=randomBytes(18).toString('hex'))=>server.call(session,'POST',`${route(id)}/mensagens`,{mensagem:text,client_message_id:key});
    const detail=(session,id)=>server.call(session,'GET',route(id));
    const read=(session,id,cut)=>server.call(session,'POST',`${route(id)}/lido`,{last_message_id:cut});
    assert.equal((await server.call(null,'GET','/api/suporte/conversas')).status,401);
    assert.equal((await detail(teacher,b)).status,404);
    assert.equal((await send(teacher,b,'Não pode')).status,404);
    assert.equal((await read(teacher,b,1)).status,404);
    assert.deepEqual((await server.call(teacher,'GET','/api/suporte/conversas')).data.map(row=>row.id),[a]);
    assert.equal((await send(manager,b,'Oi')).status,201);
    assert.equal((await server.call(second,'GET','/api/suporte/conversas/nao-lidas')).data.total,1);

    const legacyIds=[];
    for(const status of ['Aberto','Resolvido']){
      const ticket=Number(db.prepare('INSERT INTO support_tickets (requester_user_id,subject,status) VALUES (?,?,?)').run(a,'Assunto anterior',status).lastInsertRowid);
      legacyIds.push(Number(db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body) VALUES (?,?,?)').run(ticket,a,`Histórico ${status}`).lastInsertRowid));
    }
    const history=await detail(manager,a);
    assert.deepEqual(history.data.messages.map(row=>row.id),legacyIds);
    assert.deepEqual(history.data.messages.map(row=>row.body),['Histórico Aberto','Histórico Resolvido']);
    assert.equal(history.data.viewer_user_id,Number(db.prepare("SELECT id FROM users WHERE role='gestor' LIMIT 1").get().id));
    const list=(await server.call(manager,'GET','/api/suporte/conversas')).data;
    assert.equal(list.filter(row=>row.id===a).length,1);
    assert.equal(list.find(row=>row.id===a).nao_lidas,2);
    assert.equal((await server.call(manager,'GET','/api/suporte/conversas/nao-lidas')).data.total,1);
    assert.equal((await read(manager,a,legacyIds.at(-1))).status,200);
    assert.ok((await detail(teacher,a)).data.messages.every(row=>row.read));
    const incoming=await send(teacher,a,'Mensagem chegou depois do corte');
    assert.equal(incoming.status,201);
    assert.equal((await read(manager,a,legacyIds[0])).status,200);
    assert.equal((await server.call(manager,'GET','/api/suporte/conversas')).data.find(row=>row.id===a).nao_lidas,1);
    assert.equal((await read(manager,b,incoming.data.id)).status,400);
    // Enviar uma resposta não marca como lido um histórico ainda não visualizado.
    const outgoing=await send(manager,a,'Pode conversar mesmo após um chamado resolvido');
    assert.equal(outgoing.status,201);
    assert.equal((await server.call(manager,'GET','/api/suporte/conversas')).data.find(row=>row.id===a).nao_lidas,1);
    assert.equal((await detail(manager,a)).data.messages.at(-1).read,false);
    assert.equal((await server.call(teacher,'GET','/api/dashboard/professor')).data.stats.conversasNaoLidas,1);
    await read(teacher,a,outgoing.data.id);
    assert.equal((await server.call(teacher,'GET','/api/dashboard/professor')).data.stats.conversasNaoLidas,0);
    assert.equal((await detail(manager,a)).data.messages.at(-1).read,true);

    const key='chat-concurrent-send-0001';
    const simultaneous=await Promise.all([send(manager,b,'Envio único',key),send(manager,b,'Envio único',key)]);
    assert.deepEqual(simultaneous.map(row=>row.status).sort(),[200,201]);
    assert.equal((await detail(second,b)).data.messages.filter(row=>row.body==='Envio único').length,1);
    assert.equal((await send(manager,a,'Identificador de outra conversa',key)).status,409);
    assert.equal((await send(manager,a,'x')).status,201);
    assert.equal((await send(manager,a,'x'.repeat(4001))).status,400);
    assert.equal((await server.call(manager,'POST',`${route(a)}/mensagens`,{mensagem:'Sem chave'})).status,400);
    db.prepare('UPDATE users SET active=0 WHERE id=?').run(b);
    assert.equal((await send(manager,b,'Conta inativa')).status,409);
    assert.equal((await detail(manager,b)).status,200);

    const emails=db.prepare('SELECT subject,body FROM dev_emails WHERE recipient=?').all('gestor@projetoaprendiz.local');
    assert.ok(emails.some(row=>row.subject==='Nova mensagem no suporte'));
    assert.ok(!emails.filter(row=>row.subject==='Nova mensagem no suporte').some(row=>row.body.includes('Histórico Resolvido')));
  }finally{db?.close();await server.close();}
});

test('anexos e áudios ficam privados, permitem range e não se duplicam no reenvio',async()=>{
  const server=await startTestServer();let db;
  try{
    db=new DatabaseSync(server.databasePath);
    const manager=(await server.login('gestor@projetoaprendiz.local','Gestor@2026!')).session;
    const login=await server.login('professor@projetoaprendiz.local','Professor@2026!'),teacher=login.session,id=login.response.data.user.id;
    const salt=randomBytes(16),hash=`scrypt$${salt.toString('hex')}$${scryptSync('Professor@2026!',salt,64).toString('hex')}`;
    db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'professor')").run('Outro professor','other.chat@example.com',hash);
    const other=(await server.login('other.chat@example.com','Professor@2026!')).session;
    const buffer=Buffer.alloc(16044);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(16000,40);
    const file={nome:'voz.wav',tipo:'audio/wav',dataUrl:`data:audio/wav;base64,${buffer.toString('base64')}`,audio_gravado:true};
    const payload={mensagem:'',client_message_id:'voice-chat-retry-000001',anexos:[file]};
    const route=`/api/suporte/conversas/${id}`;
    const sent=await server.call(teacher,'POST',`${route}/mensagens`,payload);
    assert.equal(sent.status,201,JSON.stringify(sent.data));
    assert.equal((await server.call(teacher,'POST',`${route}/mensagens`,payload)).data.duplicate,true);
    const detail=(await server.call(manager,'GET',route)).data;
    const message=detail.messages.find(row=>row.id===sent.data.id);
    assert.equal(message.body,'');assert.equal(message.anexos.length,1);assert.equal(message.anexos[0].audio_gravado,true);
    assert.equal(message.anexos[0].data_url,undefined);assert.equal(message.anexos[0].storage_path,undefined);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM support_attachments WHERE message_id=?').get(sent.data.id).total,1);
    const url=server.baseUrl+message.anexos[0].url;
    assert.equal((await fetch(url)).status,401);
    assert.equal((await fetch(url,{headers:{Cookie:other.cookie}})).status,404);
    const response=await fetch(url,{headers:{Cookie:manager.cookie,Range:'bytes=0-43'}});
    assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes 0-43/${buffer.length}`);
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),buffer.subarray(0,44));
    assert.equal((await fetch(url,{headers:{Cookie:manager.cookie,Range:'bytes=999999-'}})).status,416);
    const wrongPath=message.anexos[0].url.replace(`/conversas/${id}/`,`/conversas/999999/`);
    assert.equal((await server.call(manager,'GET',wrongPath)).status,404);
    const invalid=await server.call(teacher,'POST',`${route}/mensagens`,{...payload,client_message_id:'invalid-file-chat-0001',anexos:[{nome:'virus.exe',tipo:'application/x-msdownload',dataUrl:'data:application/x-msdownload;base64,YWJj'}]});
    assert.equal(invalid.status,400);
    const document={nome:'orientacao.txt',tipo:'text/plain',dataUrl:`data:text/plain;base64,${Buffer.from('Informações fictícias para teste').toString('base64')}`};
    const result=await server.call(manager,'POST',`${route}/mensagens`,{mensagem:'👍',client_message_id:'emoji-document-chat-001',anexos:[document]});assert.equal(result.status,201);
    const docs=(await server.call(teacher,'GET',route)).data.messages.find(row=>row.id===result.data.id).anexos;
    const download=await fetch(server.baseUrl+docs[0].url,{headers:{Cookie:teacher.cookie}});
    assert.equal(download.headers.get('content-type'),'application/octet-stream');assert.match(download.headers.get('content-disposition'),/^attachment;/);
    assert.equal(await download.text(),'Informações fictícias para teste');
  }finally{db?.close();await server.close();}
});

test('apagar mensagens isola contas, impede apagar autoria alheia e revoga anexos para todos',async()=>{
  const server=await startTestServer();let db;
  try{
    db=new DatabaseSync(server.databasePath);db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; DELETE FROM support_ticket_events; DELETE FROM support_ticket_reads; DELETE FROM support_messages; DELETE FROM support_tickets;');
    const managerLogin=await server.login('gestor@projetoaprendiz.local','Gestor@2026!'),manager=managerLogin.session;
    const teacherLogin=await server.login('professor@projetoaprendiz.local','Professor@2026!'),teacher=teacherLogin.session,id=teacherLogin.response.data.user.id;
    const salt=randomBytes(16),hash=`scrypt$${salt.toString('hex')}$${scryptSync('Gestor@2026!',salt,64).toString('hex')}`;
    db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'gestor')").run('Outra gestora','manager.chat.test@example.com',hash);
    const second=(await server.login('manager.chat.test@example.com','Gestor@2026!')).session;
    db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'professor')").run('Outro professor','isolated.chat.test@example.com',hash);
    const outsider=(await server.login('isolated.chat.test@example.com','Gestor@2026!')).session;
    const route=`/api/suporte/conversas/${id}`;
    const file={nome:'orientacao.txt',tipo:'text/plain',dataUrl:`data:text/plain;base64,${Buffer.from('Arquivo de teste').toString('base64')}`};
    const sent=await server.call(teacher,'POST',route+'/mensagens',{mensagem:'Mensagem privada de teste',client_message_id:'deletion-message-test-001',anexos:[file]});
    assert.equal(sent.status,201);const mid=sent.data.id;
    const remove=(session,scope)=>server.call(session,'POST',`${route}/mensagens/${mid}/apagar`,{scope});
    const detail=session=>server.call(session,'GET',route);
    const original=(await detail(manager)).data.messages[0],url=original.anexos[0].url;
    assert.equal((await remove(null,'me')).status,401);
    assert.equal((await remove(outsider,'me')).status,404);
    assert.equal((await remove(manager,'everyone')).status,403);
    assert.equal((await remove(second,'everyone')).status,403);
    assert.equal((await remove(teacher,'invalid')).status,400);
    assert.equal((await remove(manager,'me')).status,200);
    assert.equal((await remove(manager,'me')).status,200);
    assert.deepEqual((await detail(manager)).data.messages,[]);
    assert.equal((await detail(teacher)).data.messages[0].body,'Mensagem privada de teste');
    assert.equal((await detail(second)).data.messages[0].body,'Mensagem privada de teste');
    assert.equal((await server.call(manager,'GET',url)).status,404);
    assert.equal((await fetch(server.baseUrl+url,{headers:{Cookie:teacher.cookie}})).status,200);
    assert.equal((await server.call(manager,'GET','/api/suporte/conversas/nao-lidas')).data.total,0);
    const ticket=db.prepare('SELECT ticket_id FROM support_messages WHERE id=?').get(mid).ticket_id;
    assert.deepEqual((await server.call(manager,'GET',`/api/suporte/${ticket}`)).data.messages,[]);
    const revision=(await server.call(second,'GET','/api/suporte/conversas')).data.find(row=>row.id===id).revision;
    assert.equal((await remove(teacher,'everyone')).status,200);
    assert.equal((await remove(teacher,'everyone')).status,200);
    const deleted=(await detail(second)).data.messages[0];
    assert.equal(deleted.deleted,true);assert.equal(deleted.body,'');assert.deepEqual(deleted.anexos,[]);
    assert.equal((await server.call(second,'GET',url)).status,404);
    assert.equal((await server.call(teacher,'GET',url)).status,404);
    const list=(await server.call(second,'GET','/api/suporte/conversas')).data.find(row=>row.id===id);
    assert.notEqual(list.revision,revision);assert.equal(list.ultima_mensagem,'Mensagem apagada');assert.equal(list.nao_lidas,0);
    assert.equal((await server.call(second,'GET','/api/suporte/conversas/nao-lidas')).data.total,0);
    assert.equal((await server.call(teacher,'GET',`/api/suporte/${ticket}`)).data.messages[0].body,'Mensagem apagada');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM support_attachments WHERE message_id=?').get(mid).n,0);
    assert.equal(db.prepare('SELECT body,deleted_by_user_id FROM support_messages WHERE id=?').get(mid).deleted_by_user_id,id);
    const own=await server.call(manager,'POST',route+'/mensagens',{mensagem:'Mensagem da primeira gestão',client_message_id:'manager-delete-own-0001'});
    assert.equal((await server.call(second,'POST',`${route}/mensagens/${own.data.id}/apagar`,{scope:'everyone'})).status,403);
    assert.equal((await server.call(manager,'POST',`${route}/mensagens/${own.data.id}/apagar`,{scope:'everyone'})).status,200);
  }finally{db?.close();await server.close();}
});

test('apagar conversa usa corte pessoal monotônico e preserva mensagens novas e histórico alheio',async()=>{
  const server=await startTestServer();let db;
  try{
    db=new DatabaseSync(server.databasePath);db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; DELETE FROM support_ticket_events; DELETE FROM support_ticket_reads; DELETE FROM support_messages; DELETE FROM support_tickets;');
    const manager=(await server.login('gestor@projetoaprendiz.local','Gestor@2026!')).session;
    const login=await server.login('professor@projetoaprendiz.local','Professor@2026!'),teacher=login.session,id=login.response.data.user.id;
    const route=`/api/suporte/conversas/${id}`;
    const send=async(text,key)=>server.call(teacher,'POST',route+'/mensagens',{mensagem:text,client_message_id:key});
    const first=await send('Primeiro dia','conversation-first-001');
    db.prepare("UPDATE support_messages SET created_at='2026-10-02 13:00:00' WHERE id=?").run(first.data.id);
    const prior=(await server.call(manager,'GET',route)).data;
    const newest=await send('Mensagem chegou durante a confirmação','conversation-second-001');
    const hide=cut=>server.call(manager,'POST',route+'/apagar',{last_message_id:cut});
    assert.equal((await hide(999999)).status,400);
    assert.equal((await hide(prior.last_message_id)).status,200);
    let visible=(await server.call(manager,'GET',route)).data;
    assert.deepEqual(visible.messages.map(row=>row.id),[newest.data.id]);
    assert.equal((await server.call(teacher,'GET',route)).data.messages.length,2);
    assert.equal((await hide(newest.data.id)).status,200);
    assert.equal((await hide(first.data.id)).status,200);
    assert.equal((await server.call(manager,'GET',route)).data.messages.length,0);
    assert.equal((await server.call(manager,'GET','/api/suporte/conversas/nao-lidas')).data.total,0);
    let contact=(await server.call(manager,'GET','/api/suporte/conversas')).data.find(row=>row.id===id);
    assert.equal(contact.apagada,true);assert.equal(contact.ultima_mensagem,null);
    const fresh=await send('Nova conversa','conversation-third-001');
    visible=(await server.call(manager,'GET',route)).data;
    assert.deepEqual(visible.messages.map(row=>row.id),[fresh.data.id]);
    contact=(await server.call(manager,'GET','/api/suporte/conversas')).data.find(row=>row.id===id);
    assert.equal(contact.apagada,false);assert.equal(contact.nao_lidas,1);
    assert.equal((await server.call(teacher,'GET',route)).data.messages.length,3);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM support_messages').get().n,3);
    assert.equal((await server.call(teacher,'POST',route+'/apagar',{last_message_id:fresh.data.id})).status,200);
    assert.equal((await server.call(teacher,'GET',route)).data.messages.length,0);
    assert.equal((await server.call(manager,'GET',route)).data.messages.length,1);
  }finally{db?.close();await server.close();}
});

