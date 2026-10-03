import { normalizeSupportAttachments } from '../support-media.mjs';

// A conversa reúne o histórico dos chamados, sem reescrever os dados legados.
export async function supportChatUnread(db, session) {
  const row = await db.prepare(`SELECT COUNT(DISTINCT t.requester_user_id) AS total
    FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
    JOIN users a ON a.id=m.author_user_id
    LEFT JOIN support_ticket_reads r ON r.ticket_id=t.id AND r.user_id=?
    WHERE a.role<>? AND m.id>COALESCE(r.last_read_message_id,0)
    ${session.role==='professor'?'AND t.requester_user_id=?':''}`)
    .get(session.user_id,session.role,...(session.role==='professor'?[session.user_id]:[]));
  return Number(row.total||0);
}

export function createSupportChatRoutes(context) {
  const {db,json,authorize,readJson,invalid,hasValidationErrors,securityHeaders,
    supportClientMessageIdError,consumeActionRateLimit,rateLimitResponse,notificationService,supportStorage} = context;
  // SQLite usa uma conexão; serializa apenas as gravações deste domínio.
  let writes = Promise.resolve();
  const transaction = callback => {
    if(db.dialect!=='sqlite')return db.transaction(callback);
    const result=writes.then(()=>db.transaction(callback));
    writes=result.catch(()=>{});
    return result;
  };
  const contact = (id,session) => db.prepare(`SELECT id,name,active FROM users
    WHERE id=? AND role='professor' ${session.role==='professor'?'AND id=?':''}`)
    .get(id,...(session.role==='professor'?[session.user_id]:[]));
  const messages = async (id,session) => {
    const attachments=await db.prepare(`SELECT a.id,a.message_id,a.filename,a.mime_type,a.size_bytes,a.voice_message
      FROM support_attachments a JOIN support_messages m ON m.id=a.message_id
      JOIN support_tickets t ON t.id=m.ticket_id WHERE t.requester_user_id=? ORDER BY a.id`).all(id);
    const byMessage=new Map();
    for(const item of attachments){const items=byMessage.get(Number(item.message_id))||[];
      items.push({id:Number(item.id),nome:item.filename,tipo:item.mime_type,tamanho:Number(item.size_bytes),
        audio_gravado:!!Number(item.voice_message),url:`/api/suporte/conversas/${id}/anexos/${item.id}`});byMessage.set(Number(item.message_id),items);}
    return db.prepare(`SELECT m.id,m.author_user_id,m.body,m.created_at,
    a.name AS author_name,a.role AS author_role,
    CASE WHEN EXISTS(SELECT 1 FROM support_ticket_reads r JOIN users reader ON reader.id=r.user_id
      WHERE r.ticket_id=m.ticket_id AND reader.role<>a.role AND r.last_read_message_id>=m.id)
      THEN 1 ELSE 0 END AS was_read
    FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id JOIN users a ON a.id=m.author_user_id
    WHERE t.requester_user_id=? ORDER BY m.created_at,m.id`).all(id).then(rows=>rows.map(row=>({
      ...row,id:Number(row.id),author_user_id:Number(row.author_user_id),read:!!Number(row.was_read),
      own:Number(row.author_user_id)===Number(session.user_id),
      anexos:byMessage.get(Number(row.id))||[],
    })));
  };
  const markRead = async (professorId,userId,cut) => {
    const tickets=await db.prepare(`SELECT t.id,MAX(m.id) AS cut FROM support_tickets t
      JOIN support_messages m ON m.ticket_id=t.id WHERE t.requester_user_id=? AND m.id<=?
      GROUP BY t.id`).all(professorId,cut);
    for(const ticket of tickets)await db.prepare(`INSERT INTO support_ticket_reads
      (ticket_id,user_id,last_read_message_id,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(ticket_id,user_id) DO UPDATE SET last_read_message_id=
      CASE WHEN COALESCE(support_ticket_reads.last_read_message_id,0)<excluded.last_read_message_id
        THEN excluded.last_read_message_id ELSE support_ticket_reads.last_read_message_id END,
      updated_at=CURRENT_TIMESTAMP`).run(ticket.id,userId,ticket.cut);
  };

  return async (request,response,url,ip) => {
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    if(url.pathname==='/api/suporte/conversas/nao-lidas'&&request.method==='GET')
      return json(response,200,{total:await supportChatUnread(db,session)});
    if(url.pathname==='/api/suporte/conversas'&&request.method==='GET'){
      const rows=await db.prepare(`SELECT * FROM (SELECT u.id,u.name AS nome,u.active,
        (SELECT COALESCE(NULLIF(m.body,''),'📎 Arquivo') FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
          WHERE t.requester_user_id=u.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS ultima_mensagem,
        (SELECT MAX(m.created_at) FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
          WHERE t.requester_user_id=u.id) AS ultima_mensagem_em,
        (SELECT COUNT(*) FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
          JOIN users a ON a.id=m.author_user_id LEFT JOIN support_ticket_reads r ON r.ticket_id=t.id AND r.user_id=?
          WHERE t.requester_user_id=u.id AND a.role<>? AND m.id>COALESCE(r.last_read_message_id,0)) AS nao_lidas,
        (SELECT COUNT(*) FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
          WHERE t.requester_user_id=u.id) AS message_count,
        (SELECT COALESCE(MAX(m.id),0) FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
          WHERE t.requester_user_id=u.id) AS last_id,
        (SELECT COALESCE(SUM(r.last_read_message_id),0) FROM support_ticket_reads r
          JOIN support_tickets t ON t.id=r.ticket_id JOIN users reader ON reader.id=r.user_id
          WHERE t.requester_user_id=u.id AND reader.role<>?) AS read_id
        FROM users u WHERE u.role='professor'
        ${session.role==='professor'?'AND u.id=?':"AND (u.active=1 OR EXISTS(SELECT 1 FROM support_tickets t WHERE t.requester_user_id=u.id))"}
        ) conversations ORDER BY CASE WHEN ultima_mensagem_em IS NULL THEN 1 ELSE 0 END,
        ultima_mensagem_em DESC,nome,id`).all(session.user_id,session.role,session.role,
          ...(session.role==='professor'?[session.user_id]:[]));
      return json(response,200,rows.map(row=>({id:Number(row.id),nome:row.nome,active:!!Number(row.active),
        ultima_mensagem:row.ultima_mensagem,ultima_mensagem_em:row.ultima_mensagem_em,nao_lidas:Number(row.nao_lidas),
        revision:`${row.message_count}/${row.last_id}/${row.read_id}`})));
    }
    const attachmentMatch=url.pathname.match(/^\/api\/suporte\/conversas\/([1-9]\d*)\/anexos\/([1-9]\d*)$/);
    if(attachmentMatch&&request.method==='GET'){
      const personId=Number(attachmentMatch[1]);
      if(!Number.isSafeInteger(personId)||!Number.isSafeInteger(Number(attachmentMatch[2]))||!await contact(personId,session))return json(response,404,{message:'Anexo não encontrado.'});
      const attachment=await db.prepare(`SELECT a.* FROM support_attachments a
        JOIN support_messages m ON m.id=a.message_id JOIN support_tickets t ON t.id=m.ticket_id
        WHERE a.id=? AND t.requester_user_id=?`).get(Number(attachmentMatch[2]),personId);
      if(!attachment)return json(response,404,{message:'Anexo não encontrado.'});
      let buffer;
      try{buffer=await supportStorage.download(attachment);}catch{return json(response,502,{message:'Não foi possível carregar o arquivo.'});}
      const media=/^(image|audio|video)\//.test(attachment.mime_type),download=url.searchParams.get('download')==='1'||!media;
      const headers={...securityHeaders(media?attachment.mime_type:'application/octet-stream'),
        'Content-Disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
        'Cache-Control':'private, no-store','Accept-Ranges':'bytes'};
      let start=0,end=buffer.length-1,status=200;
      const range=request.headers.range;
      if(range){
        const match=String(range).match(/^bytes=(\d*)-(\d*)$/);
        if(match&&(match[1]||match[2])){
          if(!match[1])start=Math.max(0,buffer.length-Number(match[2]));
          else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        }
        if(!match||!(match[1]||match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=buffer.length){
          response.writeHead(416,{...headers,'Content-Range':`bytes */${buffer.length}`});return response.end();
        }
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${buffer.length}`;
      }
      headers['Content-Length']=String(end-start+1);response.writeHead(status,headers);
      return response.end(buffer.subarray(start,end+1));
    }
    const match=url.pathname.match(/^\/api\/suporte\/conversas\/([1-9]\d*)(?:\/(mensagens|lido))?$/);
    if(!match||!Number.isSafeInteger(Number(match[1])))return json(response,404,{message:'Conversa não encontrada.'});
    const id=Number(match[1]),person=await contact(id,session);
    if(!person)return json(response,404,{message:'Conversa não encontrada.'});
    if(request.method==='GET'&&!match[2])return json(response,200,{
      contact:{id,nome:person.name,active:!!Number(person.active)},viewer_user_id:Number(session.user_id),
      messages:await messages(id,session),
    });
    if(request.method==='POST'&&match[2]==='lido'){
      const body=await readJson(request),cut=Number(body.last_message_id);
      if(!Number.isSafeInteger(cut)||cut<1||!await db.prepare(`SELECT m.id FROM support_messages m
        JOIN support_tickets t ON t.id=m.ticket_id WHERE t.requester_user_id=? AND m.id=?`).get(id,cut))
        return json(response,400,{message:'Mensagem de leitura inválida.'});
      await transaction(()=>markRead(id,session.user_id,cut));
      return json(response,200,{success:true});
    }
    if(request.method==='POST'&&match[2]==='mensagens'){
      if(!Number(person.active))return json(response,409,{message:'Este professor está inativo.'});
      const body=await readJson(request,32*1024*1024),message=String(body.mensagem||'').trim(),clientId=String(body.client_message_id||'').trim();
      const normalized=normalizeSupportAttachments(body.anexos);
      const errors={mensagem:message.length>4000?'A mensagem deve ter até 4000 caracteres.':!message&&!normalized.items?.length?'Escreva uma mensagem ou selecione um arquivo.':'',
        anexos:normalized.error||'',client_message_id:supportClientMessageIdError(clientId)};
      if(!clientId)errors.client_message_id='Identificador de envio obrigatório.';
      if(hasValidationErrors(errors))return invalid(response,errors);
      const limit=await consumeActionRateLimit({route:'support_reply',userId:session.user_id,ip,limit:30,windowMs:15*60_000});
      if(limit.blocked)return rateLimitResponse(response,limit);
      const findExisting=()=>db.prepare(`SELECT m.id,t.requester_user_id FROM support_messages m
        JOIN support_tickets t ON t.id=m.ticket_id WHERE m.author_user_id=? AND m.client_message_id=?`).get(session.user_id,clientId);
      const previous=await findExisting();
      if(previous)return Number(previous.requester_user_id)===id?json(response,200,{success:true,id:Number(previous.id),duplicate:true}):json(response,409,{message:'Este identificador de envio já foi utilizado em outra conversa.'});
      let stored;
      try{stored=await supportStorage.store(id,normalized.items);}catch{return json(response,502,{message:'Não foi possível armazenar os arquivos. A mensagem não foi enviada.'});}
      let result;
      try{result=await transaction(async()=>{
        if(db.dialect==='postgres')await db.prepare('SELECT id FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE').all(id,session.user_id);
        const existing=await db.prepare(`SELECT m.id,t.requester_user_id FROM support_messages m
          JOIN support_tickets t ON t.id=m.ticket_id WHERE m.author_user_id=? AND m.client_message_id=?`).get(session.user_id,clientId);
        if(existing)return {id:Number(existing.id),duplicate:true,conflict:Number(existing.requester_user_id)!==id};
        let ticket=await db.prepare('SELECT id FROM support_tickets WHERE requester_user_id=? ORDER BY id LIMIT 1').get(id);
        if(!ticket){const row=await db.prepare('INSERT INTO support_tickets (requester_user_id,subject,category) VALUES (?,?,?)').run(id,'Conversa de suporte','Outro');ticket={id:row.lastInsertRowid};}
        const row=await db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,client_message_id) VALUES (?,?,?,?)').run(ticket.id,session.user_id,message,clientId);
        for(const item of stored)await db.prepare(`INSERT INTO support_attachments
          (message_id,filename,mime_type,size_bytes,voice_message,data_url,storage_path) VALUES (?,?,?,?,?,?,?)`)
          .run(Number(row.lastInsertRowid),item.filename,item.mime_type,item.size_bytes,item.voice_message,item.data_url,item.storage_path);
        await db.prepare('UPDATE support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(ticket.id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`support_chat_message:${row.lastInsertRowid}`,ip);
        return {id:Number(row.lastInsertRowid)};
      });}catch(error){await supportStorage.cleanup(stored.map(item=>item.storage_path));throw error;}
      if(result.duplicate)await supportStorage.cleanup(stored.map(item=>item.storage_path));
      if(result.conflict)return json(response,409,{message:'Este identificador de envio já foi utilizado em outra conversa.'});
      if(!result.duplicate){
        const key=`support-chat/${result.id}`;
        if(session.role==='gestor')await notificationService.notifyUser(id,'newTicket','Nova mensagem no suporte','A equipe gestora enviou uma mensagem. Abra o suporte para conversar.',key);
        else await notificationService.notifyManagers('newTicket','Nova mensagem no suporte',`${session.name} enviou uma mensagem. Abra o suporte para conversar.`,key);
      }
      return json(response,result.duplicate?200:201,{success:true,...result});
    }
    return json(response,404,{message:'Rota não encontrada.'});
  };
}
