export function createAnnouncementRoutes(context) {
  const {
    db,
    json,
    readJson,
    supabaseAdmin,
    authorize,
    cleanText,
    hasValidationErrors,
    invalid,
    announcementScheduledCondition,
    announcementScheduleParts,
    sanitizeAnnouncementContent,
    normalizeAnnouncementRecipients,
    normalizeAnnouncementAttachments,
    prepareStoredAttachments,
    insertAnnouncementAttachments,
    removeStoredAttachments,
    announcementStorageBucket,
    requiredTextError,
    securityHeaders,
    zonedScheduleIso,
    scheduleIsPast,
    logger,
  } = context;

  return async function announcementRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/api/informativos/nao-lidos'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const result=await db.prepare(`SELECT COUNT(*) AS total FROM announcements
          WHERE announcements.active=1
            AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor')
            AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)
            AND ${announcementScheduledCondition('announcements.scheduled_at')}
            AND NOT EXISTS (SELECT 1 FROM announcement_reads WHERE announcement_reads.announcement_id=announcements.id AND announcement_reads.user_id=?)
            AND (
              NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
              OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
                (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
                OR (ar.recipient_type='curso' AND ar.recipient_id IN (
                  SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id
                  WHERE pp.user_id=? AND pp.active=1 AND classes.active=1
                    AND EXISTS (SELECT 1 FROM school_years sy WHERE sy.id=classes.school_year_id AND sy.active=1 AND sy.closed_at IS NULL)
                ))
              ))
            )`).get(session.user_id,session.user_id,session.user_id);
        return json(response,200,{total:Number(result?.total||0)});
      }
    
      if(request.method==='GET'&&url.pathname==='/api/informativos'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const visibility=session.role==='professor' ? `
          AND ${announcementScheduledCondition('announcements.scheduled_at')}
          AND (
            NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
            OR EXISTS (
              SELECT 1 FROM announcement_recipients ar
              WHERE ar.announcement_id=announcements.id
                AND (
                  (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
                  OR (ar.recipient_type='curso' AND ar.recipient_id IN (
                    SELECT classes.course_id
                    FROM classes
                    JOIN professor_profiles pp ON pp.id=classes.professor_id
                    WHERE pp.user_id=? AND pp.active=1 AND classes.active=1
                      AND EXISTS (SELECT 1 FROM school_years sy WHERE sy.id=classes.school_year_id AND sy.active=1 AND sy.closed_at IS NULL)
                  ))
                )
            )
          )` : '';
        const rows=await db.prepare(`SELECT announcements.*,COUNT(read_users.id) AS read_count,MAX(CASE WHEN announcement_reads.user_id=? THEN 1 ELSE 0 END) AS has_read FROM announcements LEFT JOIN announcement_reads ON announcement_reads.announcement_id=announcements.id LEFT JOIN users read_users ON read_users.id=announcement_reads.user_id AND read_users.role='professor' WHERE announcements.active=1 AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor') AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)${visibility} GROUP BY announcements.id ORDER BY announcements.pinned DESC,announcements.scheduled_at DESC`).all(...(session.role==='professor' ? [session.user_id,session.user_id,session.user_id] : [session.user_id]));
        const attachmentsByAnnouncement = new Map();
        const recipientsByAnnouncement = new Map();
        if (rows.length) {
          const ids = rows.map(row => Number(row.id));
          const placeholders = ids.map(() => '?').join(',');
          const attachmentRows = await db.prepare(`SELECT id,announcement_id,filename,mime_type,size_bytes FROM announcement_attachments WHERE announcement_id IN (${placeholders}) ORDER BY id`).all(...ids);
          for (const attachment of attachmentRows) {
            const list = attachmentsByAnnouncement.get(Number(attachment.announcement_id)) || [];
            list.push({ id: Number(attachment.id), nome: attachment.filename, tipo: attachment.mime_type, tamanho: Number(attachment.size_bytes), url: `/api/informativos/${Number(attachment.announcement_id)}/anexos/${Number(attachment.id)}` });
            attachmentsByAnnouncement.set(Number(attachment.announcement_id), list);
          }
          const recipientRows = await db.prepare(`SELECT announcement_id,recipient_type,recipient_id FROM announcement_recipients WHERE announcement_id IN (${placeholders}) ORDER BY announcement_id,recipient_type,recipient_id`).all(...ids);
          for (const recipient of recipientRows) {
            const audience = recipientsByAnnouncement.get(Number(recipient.announcement_id)) || { todos: false, professores: [], cursos: [], turmas: [] };
            if (recipient.recipient_type === 'professor') audience.professores.push(Number(recipient.recipient_id));
            if (recipient.recipient_type === 'curso') audience.cursos.push(Number(recipient.recipient_id));
            recipientsByAnnouncement.set(Number(recipient.announcement_id), audience);
          }
          const classRows=await db.prepare(`SELECT announcement_id,class_id FROM student_announcement_classes WHERE announcement_id IN (${placeholders}) ORDER BY announcement_id,class_id`).all(...ids);
          for(const relation of classRows){
            const announcementId=Number(relation.announcement_id);
            const audience=recipientsByAnnouncement.get(announcementId)||{todos:false,professores:[],cursos:[],turmas:[]};
            audience.turmas.push(Number(relation.class_id));
            recipientsByAnnouncement.set(announcementId,audience);
          }
        }
        const mapped=rows.map(row=>{
          const schedule=announcementScheduleParts(row.scheduled_at);
          const isScheduled=Date.parse(row.scheduled_at)>Date.now();
          return {id:row.id,titulo:row.title,categoria:row.category,tipo:row.category==='Urgente'?'Urgente':row.category==='Eventos'?'Evento':'Comunicado',conteudo:sanitizeAnnouncementContent(row.content),data_publicacao:row.scheduled_at,agendado_em:row.scheduled_at,data:schedule.date.split('-').reverse().join('/'),hora:schedule.time,status:isScheduled?'Agendado':'Publicado',lido:Number(row.read_count||0),fixado:Boolean(row.pinned),hasRead:Boolean(row.has_read),anexos:attachmentsByAnnouncement.get(Number(row.id)) || [],destinatarios:recipientsByAnnouncement.get(Number(row.id)) || { todos: true, professores: [], cursos: [], turmas: [] }};
        });
        return json(response,200,mapped);
      }
      if(request.method==='GET'&&url.pathname==='/api/informativos/destinatarios'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const turmas=await db.prepare(`SELECT c.id,co.name AS curso,l.name AS local,pp.name AS professor,c.label
          FROM classes c
          JOIN professor_profiles pp ON pp.id=c.professor_id AND pp.active=1
          JOIN courses co ON co.id=c.course_id AND co.active=1
          JOIN locations l ON l.id=c.location_id AND l.active=1
          JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
          WHERE c.active=1 ORDER BY co.name,l.name,pp.name,c.id`).all();
        return json(response,200,{turmas:turmas.map(row=>({id:Number(row.id),curso:row.curso,local:row.local,professor:row.professor,label:row.label}))});
      }
      const attachmentMatch=url.pathname.match(/^\/api\/informativos\/(\d+)\/anexos\/(\d+)$/);
      if(attachmentMatch&&request.method==='GET'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const visibility=session.role==='professor' ? ` AND ${announcementScheduledCondition('announcements.scheduled_at')}
          AND (NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
            OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
              (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
              OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1 AND EXISTS (SELECT 1 FROM school_years sy WHERE sy.id=classes.school_year_id AND sy.active=1 AND sy.closed_at IS NULL)))
            )))` : '';
        const attachment=await db.prepare(`SELECT announcement_attachments.filename,announcement_attachments.mime_type,announcement_attachments.data_url,announcement_attachments.storage_path FROM announcement_attachments JOIN announcements ON announcements.id=announcement_attachments.announcement_id WHERE announcement_attachments.id=? AND announcement_attachments.announcement_id=? AND announcements.active=1${visibility}`).get(...([Number(attachmentMatch[2]),Number(attachmentMatch[1]),...(session.role==='professor' ? [session.user_id,session.user_id] : [])]));
        if(!attachment)return json(response,404,{message:'Anexo não encontrado.'});
        let buffer;
        if(attachment.storage_path){
          if(!supabaseAdmin)return json(response,503,{message:'O storage de anexos não está disponível.'});
          const {data,error}=await supabaseAdmin.storage.from(announcementStorageBucket).download(attachment.storage_path);
          if(error||!data)return json(response,502,{message:'Não foi possível carregar o anexo.'});
          buffer=Buffer.from(await data.arrayBuffer());
        }else{
          const base64=String(attachment.data_url||'').split(',')[1] || '';
          buffer=Buffer.from(base64,'base64');
        }
        const disposition=url.searchParams.get('download')==='1'?'attachment':'inline';
        response.writeHead(200,{...securityHeaders(attachment.mime_type),'Content-Disposition':`${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,'Content-Length':String(buffer.length),'Cache-Control':'private, max-age=300'});
        return response.end(buffer);
      }
      if(request.method==='POST'&&url.pathname==='/api/informativos'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const body=await readJson(request, 32 * 1024 * 1024),title=cleanText(body.titulo,120),content=sanitizeAnnouncementContent(body.conteudo),attachmentResult=normalizeAnnouncementAttachments(body.anexos),recipientResult=await normalizeAnnouncementRecipients(body.destinatarios);
        const scheduled=zonedScheduleIso(body.dataAgendamento,body.horaAgendamento);
        const errors={titulo:requiredTextError(title,'O título',3,120),categoria:['Geral','Inscrições','Eventos','Urgente'].includes(body.categoria)?'':'Selecione uma categoria válida.',conteudo:requiredTextError(content.replace(/<[^>]+>/g,' '),'O conteúdo',10,5000),dataAgendamento:/^\d{4}-\d{2}-\d{2}$/.test(body.dataAgendamento||'')?'':'Informe uma data válida.',horaAgendamento:/^([01]\d|2[0-3]):[0-5]\d$/.test(body.horaAgendamento||'')?'':'Informe uma hora válida.',anexos:attachmentResult.error || '',destinatarios:recipientResult.error || ''};
        if(scheduleIsPast(body.dataAgendamento, body.horaAgendamento))errors.dataAgendamento='A data e hora devem ser futuras.';
        if(hasValidationErrors(errors)||!scheduled||Number.isNaN(Date.parse(scheduled)))return invalid(response,errors);
        let result;
        let stored=[];
        try{
          await db.transaction(async () => {
            result=await db.prepare("INSERT INTO announcements (author_user_id,title,category,content,scheduled_at,published_at,pinned) VALUES (?,?,?,?,?,?,?)").run(session.user_id,title,body.categoria,content,scheduled,scheduled,body.fixarNoTopo?1:0);
            for (const recipient of recipientResult.items) await db.prepare('INSERT INTO announcement_recipients (announcement_id,recipient_type,recipient_id) VALUES (?,?,?)').run(result.lastInsertRowid,recipient.recipient_type,recipient.recipient_id);
            if(Array.isArray(recipientResult.audience.turmas)){
              await db.prepare('INSERT INTO student_announcement_audiences(announcement_id,all_students) VALUES (?,0)').run(result.lastInsertRowid);
              for(const classId of recipientResult.audience.turmas)await db.prepare('INSERT INTO student_announcement_classes(announcement_id,class_id) VALUES (?,?)').run(result.lastInsertRowid,classId);
            }
          });
          stored=await prepareStoredAttachments(Number(result.lastInsertRowid),attachmentResult.newItems);
          await db.transaction(async()=>{
            await insertAnnouncementAttachments(Number(result.lastInsertRowid),stored);
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_created',ip);
          });
        }catch(error){
          await removeStoredAttachments(stored.map(item=>item.storage_path)).catch(cleanupError=>logger.error('announcement_attachment_cleanup_failed',cleanupError,{announcementId:Number(result?.lastInsertRowid||0)}));
          if(result?.lastInsertRowid)await db.prepare('DELETE FROM announcements WHERE id=?').run(Number(result.lastInsertRowid)).catch(cleanupError=>logger.error('announcement_rollback_failed',cleanupError,{announcementId:Number(result.lastInsertRowid)}));
          logger.error('announcement_creation_failed',error,{announcementId:Number(result?.lastInsertRowid||0)});
          return json(response,502,{message:'Não foi possível armazenar os anexos. O informativo não foi publicado.'});
        }
        return json(response,201,{id:Number(result.lastInsertRowid),destinatarios:recipientResult.audience});
      }
      const announcementMatch=url.pathname.match(/^\/api\/informativos\/(\d+)$/);
      if(announcementMatch&&request.method==='PUT'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const announcementId=Number(announcementMatch[1]);
        const announcement=await db.prepare(`SELECT id,scheduled_at FROM announcements
          WHERE id=? AND active=1
            AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor')
            AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)`).get(announcementId);
        if(!announcement)return json(response,404,{message:'Informativo não encontrado.'});
        const existingAttachments=new Map((await db.prepare('SELECT id,filename,mime_type,size_bytes,data_url,storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId)).map(row => [Number(row.id), row]));
        const body=await readJson(request, 32 * 1024 * 1024),title=cleanText(body.titulo,120),content=sanitizeAnnouncementContent(body.conteudo),scheduled=zonedScheduleIso(body.dataAgendamento,body.horaAgendamento),attachmentResult=normalizeAnnouncementAttachments(body.anexos, existingAttachments),recipientResult=await normalizeAnnouncementRecipients(body.destinatarios);
        const errors={titulo:requiredTextError(title,'O título',3,120),categoria:['Geral','Inscrições','Eventos','Urgente'].includes(body.categoria)?'':'Selecione uma categoria válida.',conteudo:requiredTextError(content.replace(/<[^>]+>/g,' '),'O conteúdo',10,5000),dataAgendamento:/^\d{4}-\d{2}-\d{2}$/.test(body.dataAgendamento||'')?'':'Informe uma data válida.',horaAgendamento:/^([01]\d|2[0-3]):[0-5]\d$/.test(body.horaAgendamento||'')?'':'Informe uma hora válida.',anexos:attachmentResult.error || '',destinatarios:recipientResult.error || ''};
        if(scheduleIsPast(body.dataAgendamento, body.horaAgendamento) && scheduled!==new Date(announcement.scheduled_at).toISOString())errors.dataAgendamento='A data e hora devem ser futuras.';
        if(hasValidationErrors(errors)||!scheduled||Number.isNaN(Date.parse(scheduled)))return invalid(response,errors);
        const retainedIds=attachmentResult.existingItems.map(item=>Number(item.id));
        const removed=[...existingAttachments.values()].filter(item=>!retainedIds.includes(Number(item.id)));
        let stored=[];
        let result;
        try{
          stored=await prepareStoredAttachments(announcementId,attachmentResult.newItems);
          await db.transaction(async () => {
            result=await db.prepare(`UPDATE announcements SET title=?,category=?,content=?,scheduled_at=?,published_at=?,pinned=?,updated_at=CURRENT_TIMESTAMP
              WHERE id=? AND active=1
                AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor')
                AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)`).run(title,body.categoria,content,scheduled,scheduled,body.fixarNoTopo?1:0,announcementId);
            if(retainedIds.length)await db.prepare(`DELETE FROM announcement_attachments WHERE announcement_id=? AND id NOT IN (${retainedIds.map(()=>'?').join(',')})`).run(announcementId,...retainedIds);
            else await db.prepare('DELETE FROM announcement_attachments WHERE announcement_id=?').run(announcementId);
            await insertAnnouncementAttachments(announcementId,stored);
            await db.prepare('DELETE FROM announcement_recipients WHERE announcement_id=?').run(announcementId);
            for (const recipient of recipientResult.items) await db.prepare('INSERT INTO announcement_recipients (announcement_id,recipient_type,recipient_id) VALUES (?,?,?)').run(announcementId,recipient.recipient_type,recipient.recipient_id);
            if(Array.isArray(recipientResult.audience.turmas)){
              await db.prepare('DELETE FROM student_announcement_classes WHERE announcement_id=?').run(announcementId);
              await db.prepare('DELETE FROM student_announcement_audiences WHERE announcement_id=?').run(announcementId);
              await db.prepare('INSERT INTO student_announcement_audiences(announcement_id,all_students) VALUES (?,0)').run(announcementId);
              for(const classId of recipientResult.audience.turmas)await db.prepare('INSERT INTO student_announcement_classes(announcement_id,class_id) VALUES (?,?)').run(announcementId,classId);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_updated',ip);
          });
        }catch(error){
          await removeStoredAttachments(stored.map(item=>item.storage_path)).catch(cleanupError=>logger.error('announcement_attachment_cleanup_failed',cleanupError,{announcementId}));
          logger.error('announcement_update_failed',error,{announcementId});
          return json(response,502,{message:'Não foi possível atualizar os anexos. O informativo anterior foi preservado.'});
        }
        await removeStoredAttachments(removed.map(item=>item.storage_path)).catch(error=>logger.error('announcement_attachment_cleanup_failed',error,{announcementId}));
        return json(response,200,{success:true,destinatarios:recipientResult.audience});
      }
      if(announcementMatch&&request.method==='DELETE'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const announcementId=Number(announcementMatch[1]);
        const attachments=await db.prepare('SELECT storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId);
        const result=await db.transaction(async()=>{
          const deleted=await db.prepare(`DELETE FROM announcements WHERE id=?
            AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor')
            AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)`).run(announcementId);
          if(deleted.changes)await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_deleted',ip);
          return deleted;
        });
        if(!result.changes)return json(response,404,{message:'Informativo não encontrado.'});
        await removeStoredAttachments(attachments.map(item=>item.storage_path)).catch(error=>logger.error('announcement_attachment_cleanup_failed',error,{announcementId}));
        return json(response,200,{success:true});
      }
      const readMatch = url.pathname.match(/^\/api\/informativos\/(\d+)\/lida$/);
      if (readMatch && request.method === 'POST') {
        const session = await authorize(request, response, ['professor']); if (!session) return;
        const announcementId=Number(readMatch[1]);
        const visibility=`
          AND (NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
            OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
              (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
              OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1 AND EXISTS (SELECT 1 FROM school_years sy WHERE sy.id=classes.school_year_id AND sy.active=1 AND sy.closed_at IS NULL)))
            )))`;
        const announcement=await db.prepare(`SELECT announcements.id FROM announcements WHERE announcements.id=? AND announcements.active=1
          AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor')
          AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)
          AND ${announcementScheduledCondition('announcements.scheduled_at')}${visibility}`).get(announcementId,session.user_id,session.user_id);
        if(!announcement)return json(response,404,{message:'Informativo não encontrado.'});
        await db.prepare('INSERT INTO announcement_reads (announcement_id,user_id) VALUES (?,?) ON CONFLICT(announcement_id,user_id) DO UPDATE SET read_at=CURRENT_TIMESTAMP').run(announcementId,session.user_id);
        return json(response, 200, { success: true });
      }
    
      const readersMatch = url.pathname.match(/^\/api\/informativos\/(\d+)\/leituras$/);
      if (readersMatch && request.method === 'GET') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const announcement=await db.prepare(`SELECT announcements.id FROM announcements WHERE announcements.id=? AND announcements.active=1
          AND EXISTS (SELECT 1 FROM users announcement_author WHERE announcement_author.id=announcements.author_user_id AND announcement_author.role='gestor')
          AND NOT EXISTS (SELECT 1 FROM student_course_announcements sca WHERE sca.announcement_id=announcements.id)`).get(Number(readersMatch[1]));
        if(!announcement)return json(response,404,{message:'Informativo não encontrado.'});
        const rows = await db.prepare(`
          SELECT professor_profiles.id AS professor_id,COALESCE(professor_profiles.name,users.name) AS name,announcement_reads.read_at
          FROM announcement_reads
          JOIN users ON users.id = announcement_reads.user_id
          LEFT JOIN professor_profiles ON professor_profiles.user_id = users.id
          WHERE announcement_reads.announcement_id = ? AND users.role='professor'
          ORDER BY announcement_reads.read_at DESC
        `).all(Number(readersMatch[1]));
        return json(response, 200, rows);
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
