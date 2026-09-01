export function createSupportRoutes(context) {
  const {
    db,
    json,
    readJson,
    randomBytes,
    authorize,
    cleanText,
    hasValidationErrors,
    invalid,
    duplicateError,
    supportTicketForSession,
    markSupportTicketRead,
    listSupportTickets,
    supportTicketView,
    supportStatusToDatabase,
    validateSupportTicket,
    supportMessageError,
    supportClientMessageIdError,
    SUPPORT_STATUSES,
    supportStatusFromDatabase,
  } = context;

  return async function supportRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/api/suporte'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        return json(response,200,await listSupportTickets(session,url));
      }
      if(request.method==='GET'&&url.pathname==='/api/suporte/nao-lidos'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const ownership=session.role==='professor'?'AND support_tickets.requester_user_id=?':'';
        const params=[session.user_id,session.user_id,...(session.role==='professor'?[session.user_id]:[])];
        const result=await db.prepare(`
          SELECT COUNT(*) AS total FROM support_tickets
          LEFT JOIN support_ticket_reads ON support_ticket_reads.ticket_id=support_tickets.id AND support_ticket_reads.user_id=?
          WHERE EXISTS (
            SELECT 1 FROM support_messages
            WHERE support_messages.ticket_id=support_tickets.id
              AND support_messages.author_user_id<>?
              AND support_messages.id>COALESCE(support_ticket_reads.last_read_message_id,0)
          ) ${ownership}
        `).get(...params);
        return json(response,200,{total:Number(result.total||0)});
      }
      if(request.method==='POST'&&url.pathname==='/api/suporte'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const body=await readJson(request),rawSubject=String(body.assunto||''),rawMessage=String(body.mensagem||''),category=cleanText(body.categoria,40);
        const subject=cleanText(rawSubject,120),message=rawMessage.trim();
        const suppliedClientId=String(body.client_message_id||'').trim(),clientMessageId=suppliedClientId||`server_${randomBytes(18).toString('base64url')}`;
        const errors={...validateSupportTicket({assunto:rawSubject,mensagem:rawMessage,categoria:category}),client_message_id:suppliedClientId?supportClientMessageIdError(suppliedClientId):''};
        if(message.length>4000)errors.mensagem='A mensagem deve ter entre 10 e 4000 caracteres.';
        if(hasValidationErrors(errors))return invalid(response,errors);
        if(suppliedClientId){
          const existing=await db.prepare('SELECT ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
          if(existing)return json(response,200,{id:Number(existing.ticket_id),duplicate:true});
        }
        try{
          const created=await db.transaction(async()=>{
            const ticketResult=await db.prepare('INSERT INTO support_tickets (requester_user_id,subject,category) VALUES (?,?,?)').run(session.user_id,subject,category);
            const ticketId=Number(ticketResult.lastInsertRowid);
            const messageResult=await db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,client_message_id) VALUES (?,?,?,?)').run(ticketId,session.user_id,message,clientMessageId);
            await db.prepare('INSERT INTO support_ticket_reads (ticket_id,user_id,last_read_message_id) VALUES (?,?,?)').run(ticketId,session.user_id,Number(messageResult.lastInsertRowid));
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_created:${ticketId}`,ip);
            return ticketId;
          });
          return json(response,201,{id:created});
        }catch(error){
          if(duplicateError(error)&&suppliedClientId){
            const existing=await db.prepare('SELECT ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
            if(existing)return json(response,200,{id:Number(existing.ticket_id),duplicate:true});
          }
          throw error;
        }
      }
      const ticketDetailMatch=url.pathname.match(/^\/api\/suporte\/(\d+)$/);
      if(ticketDetailMatch&&request.method==='GET'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const ticketId=Number(ticketDetailMatch[1]),ticket=await supportTicketForSession(ticketId,session);
        if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
        const [messages,events]=await Promise.all([
          db.prepare(`
            SELECT support_messages.id,support_messages.author_user_id,support_messages.body,support_messages.created_at,
              users.name AS author_name,users.role AS author_role
            FROM support_messages JOIN users ON users.id=support_messages.author_user_id
            WHERE support_messages.ticket_id=?
            ORDER BY support_messages.created_at,support_messages.id
          `).all(ticketId),
          db.prepare(`
            SELECT support_ticket_events.id,support_ticket_events.event_type,support_ticket_events.from_status,
              support_ticket_events.to_status,support_ticket_events.created_at,users.name AS actor_name
            FROM support_ticket_events LEFT JOIN users ON users.id=support_ticket_events.actor_user_id
            WHERE support_ticket_events.ticket_id=?
            ORDER BY support_ticket_events.created_at,support_ticket_events.id
          `).all(ticketId),
        ]);
        return json(response,200,{
          ticket:{...supportTicketView({...ticket,last_message_at:ticket.updated_at}),status:supportStatusFromDatabase(ticket.status)},
          messages:messages.map(item=>({id:Number(item.id),author_user_id:Number(item.author_user_id),author_name:item.author_name,author_role:item.author_role,body:item.body,created_at:item.created_at})),
          events:events.map(item=>({...item,id:Number(item.id),from_status:supportStatusFromDatabase(item.from_status),to_status:supportStatusFromDatabase(item.to_status)})),
        });
      }
      if(ticketDetailMatch&&request.method==='DELETE'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const ticketId=Number(ticketDetailMatch[1]);
        const ticket=await supportTicketForSession(ticketId,session);
        if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
        await db.transaction(async()=>{
          await db.prepare('DELETE FROM support_tickets WHERE id=?').run(ticketId);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_deleted:${ticketId}`,ip);
        });
        return json(response,200,{success:true});
      }
      const ticketReadMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/lido$/);
      if(ticketReadMatch&&request.method==='POST'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const ticketId=Number(ticketReadMatch[1]),ticket=await supportTicketForSession(ticketId,session);
        if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
        const body=await readJson(request),lastMessageId=Number(body.last_message_id||0);
        if(body.last_message_id!==undefined&&(!Number.isInteger(lastMessageId)||lastMessageId<1))return json(response,400,{message:'Mensagem de leitura inválida.'});
        if(lastMessageId&&!(await db.prepare('SELECT id FROM support_messages WHERE ticket_id=? AND id=?').get(ticketId,lastMessageId)))return json(response,400,{message:'Mensagem de leitura não pertence a este chamado.'});
        await markSupportTicketRead(ticketId,session.user_id,lastMessageId);
        return json(response,200,{success:true});
      }
      const replyMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/responder$/);
      if(replyMatch&&request.method==='POST'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const ticketId=Number(replyMatch[1]),ticket=await supportTicketForSession(ticketId,session);
        if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
        if(ticket.status==='Resolvido'&&session.role==='gestor')return json(response,409,{message:'Reabra o chamado antes de responder.'});
        const body=await readJson(request),message=String(body.mensagem||'').trim(),suppliedClientId=String(body.client_message_id||'').trim();
        const clientMessageId=suppliedClientId||`server_${randomBytes(18).toString('base64url')}`;
        const errors={mensagem:supportMessageError(message,'A resposta'),client_message_id:suppliedClientId?supportClientMessageIdError(suppliedClientId):''};
        if(message.length>4000)errors.mensagem='A resposta deve ter entre 2 e 4000 caracteres.';
        if(hasValidationErrors(errors))return invalid(response,errors);
        if(suppliedClientId){
          const existing=await db.prepare('SELECT id,ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
          if(existing)return Number(existing.ticket_id)===ticketId?json(response,200,{success:true,id:Number(existing.id),duplicate:true}):json(response,409,{message:'Este identificador de envio já foi utilizado.'});
        }
        const nextStatus=session.role==='gestor'?'Pendente':'Aberto';
        try{
          const messageId=await db.transaction(async()=>{
            const inserted=await db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,client_message_id) VALUES (?,?,?,?)').run(ticketId,session.user_id,message,clientMessageId);
            const id=Number(inserted.lastInsertRowid);
            await db.prepare(`INSERT INTO support_ticket_reads (ticket_id,user_id,last_read_message_id,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
              ON CONFLICT(ticket_id,user_id) DO UPDATE SET last_read_message_id=excluded.last_read_message_id,updated_at=CURRENT_TIMESTAMP`).run(ticketId,session.user_id,id);
            await db.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(nextStatus,ticketId);
            if(ticket.status!==nextStatus)await db.prepare('INSERT INTO support_ticket_events (ticket_id,actor_user_id,event_type,from_status,to_status) VALUES (?,?,\'status_changed\',?,?)').run(ticketId,session.user_id,ticket.status,nextStatus);
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_replied:${ticketId}`,ip);
            return id;
          });
          return json(response,201,{success:true,id:messageId,status:supportStatusFromDatabase(nextStatus)});
        }catch(error){
          if(duplicateError(error)&&suppliedClientId){
            const existing=await db.prepare('SELECT id,ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
            if(existing&&Number(existing.ticket_id)===ticketId)return json(response,200,{success:true,id:Number(existing.id),duplicate:true});
          }
          throw error;
        }
      }
      const ticketStatusMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/status$/);
      if(ticketStatusMatch&&request.method==='PUT'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const ticketId=Number(ticketStatusMatch[1]),body=await readJson(request),requestedStatus=cleanText(body.status,30);
        if(!SUPPORT_STATUSES.includes(requestedStatus))return json(response,400,{message:'Status inválido.'});
        const ticket=await supportTicketForSession(ticketId,session);if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
        const nextStatus=supportStatusToDatabase(requestedStatus);
        if(ticket.status!==nextStatus)await db.transaction(async()=>{
          await db.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(nextStatus,ticketId);
          await db.prepare('INSERT INTO support_ticket_events (ticket_id,actor_user_id,event_type,from_status,to_status) VALUES (?,?,\'status_changed\',?,?)').run(ticketId,session.user_id,ticket.status,nextStatus);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_status_changed:${ticketId}`,ip);
        });
        return json(response,200,{success:true,status:requestedStatus});
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}

