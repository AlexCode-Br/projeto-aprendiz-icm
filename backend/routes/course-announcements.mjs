const WALL_CATEGORIES=['Aviso','Material de aula','Alteração de horário','Evento ou ensaio','Atividade'];

export function createCourseAnnouncementRoutes(context){
  const {
    db,json,authorize,readJson,cleanText,sanitizeAnnouncementContent,requiredTextError,
    hasValidationErrors,invalid,normalizeAnnouncementAttachments,prepareStoredAttachments,
    insertAnnouncementAttachments,removeStoredAttachments,logger,
  }=context;

  const ownedClass=(classId,userId)=>db.prepare(`SELECT c.id,c.professor_id,co.name AS course_name,l.name AS location_name
    FROM classes c
    JOIN professor_profiles pp ON pp.id=c.professor_id AND pp.active=1
    JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
    JOIN courses co ON co.id=c.course_id
    JOIN locations l ON l.id=c.location_id
    WHERE c.id=? AND c.active=1 AND pp.user_id=?`).get(classId,userId);

  const postForProfessor=(classId,announcementId,userId)=>db.prepare(`SELECT a.id,a.scheduled_at
    FROM announcements a
    JOIN student_course_announcements sca ON sca.announcement_id=a.id
    JOIN classes c ON c.id=sca.class_id
    JOIN professor_profiles pp ON pp.id=c.professor_id AND pp.active=1
    JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
    WHERE sca.class_id=? AND a.id=? AND a.author_user_id=? AND a.active=1 AND c.active=1 AND pp.user_id=?`).get(classId,announcementId,userId,userId);

  const listPosts=async(classId,userId)=>{
    const rows=await db.prepare(`SELECT a.id,a.title AS titulo,a.category AS categoria,a.content AS conteudo,
      a.scheduled_at AS data,a.pinned AS fixado,sca.requires_acknowledgement AS requer_confirmacao
      FROM announcements a
      JOIN student_course_announcements sca ON sca.announcement_id=a.id
      WHERE sca.class_id=? AND a.author_user_id=? AND a.active=1
      ORDER BY a.pinned DESC,a.scheduled_at DESC,a.id DESC LIMIT 100`).all(classId,userId);
    if(!rows.length)return [];
    const ids=rows.map(row=>Number(row.id)),placeholders=ids.map(()=>'?').join(',');
    const [attachments,readers,totalRow]=await Promise.all([
      db.prepare(`SELECT id,announcement_id,filename,mime_type,size_bytes FROM announcement_attachments
        WHERE announcement_id IN (${placeholders}) ORDER BY id`).all(...ids),
      db.prepare(`SELECT ar.announcement_id,s.id AS student_id,s.name AS student_name,ar.read_at
        FROM announcement_reads ar
        JOIN student_accounts sa ON sa.user_id=ar.user_id
        JOIN enrollments e ON e.student_id=sa.student_id AND e.class_id=? AND e.status='ativa'
        JOIN students s ON s.id=sa.student_id AND s.active=1
        JOIN users u ON u.id=sa.user_id AND u.active=1 AND u.role='aluno'
        WHERE ar.announcement_id IN (${placeholders})
        ORDER BY ar.read_at DESC,s.name`).all(classId,...ids),
      db.prepare(`SELECT COUNT(DISTINCT sa.user_id) AS total FROM enrollments e
        JOIN students s ON s.id=e.student_id AND s.active=1
        JOIN student_accounts sa ON sa.student_id=s.id
        JOIN users u ON u.id=sa.user_id AND u.active=1 AND u.role='aluno'
        WHERE e.class_id=? AND e.status='ativa'`).get(classId),
    ]);
    const readersByAnnouncement=new Map();
    for(const reader of readers){
      const announcementId=Number(reader.announcement_id);
      const current=readersByAnnouncement.get(announcementId)||[];
      current.push({alunoId:Number(reader.student_id),nome:reader.student_name,data:reader.read_at});
      readersByAnnouncement.set(announcementId,current);
    }
    const totalStudents=Number(totalRow?.total||0);
    return rows.map(row=>{
      const visualizacoes=readersByAnnouncement.get(Number(row.id))||[];
      return {
      id:Number(row.id),titulo:row.titulo,categoria:row.categoria,
      conteudo:sanitizeAnnouncementContent(row.conteudo),data:row.data,fixado:Boolean(row.fixado),
      requerConfirmacao:Boolean(row.requer_confirmacao),confirmacoes:visualizacoes.length,
      totalAlunos:totalStudents,visualizacoes,
      anexos:attachments.filter(item=>Number(item.announcement_id)===Number(row.id)).map(item=>({
        id:Number(item.id),nome:item.filename,tipo:item.mime_type,tamanho:Number(item.size_bytes),
        url:`/api/informativos/${Number(row.id)}/anexos/${Number(item.id)}`,
      })),
    };});
  };

  const normalizedBody=async(request,existingAttachments=new Map())=>{
    const body=await readJson(request,32*1024*1024);
    if(!body.categoria)body.categoria='Aviso';
    const title=cleanText(body.titulo,121),content=sanitizeAnnouncementContent(body.conteudo);
    const attachmentResult=normalizeAnnouncementAttachments(body.anexos,existingAttachments);
    const errors={
      titulo:requiredTextError(title,'O título',3,120),
      categoria:WALL_CATEGORIES.includes(body.categoria)?'':'Selecione uma categoria válida.',
      conteudo:requiredTextError(content.replace(/<[^>]+>/g,' '),'O conteúdo',10,5000),
      anexos:attachmentResult.error||'',
    };
    return {body,title,content,attachmentResult,errors};
  };

  return async(request,response,url,ip)=>{
    const match=url.pathname.match(/^\/api\/professores\/me\/turmas\/(\d+)\/(?:mural|informativos)(?:\/(\d+))?$/);
    if(!match)return json(response,404,{message:'Rota não encontrada.'});
    const session=await authorize(request,response,['professor']);if(!session)return;
    const classId=Number(match[1]),announcementId=match[2]?Number(match[2]):0;
    const course=await ownedClass(classId,session.user_id);
    if(!course)return json(response,404,{message:'Turma não encontrada.'});

    if(!announcementId&&request.method==='GET')return json(response,200,{items:await listPosts(classId,session.user_id)});

    if(!announcementId&&request.method==='POST'){
      const {body,title,content,attachmentResult,errors}=await normalizedBody(request);
      if(hasValidationErrors(errors))return invalid(response,errors);
      let createdId=0,stored=[];
      try{
        const now=new Date().toISOString();
        const result=await db.transaction(async()=>{
          if(db.dialect==='postgres')await db.prepare('SELECT id FROM classes WHERE id=? FOR UPDATE').get(classId);
          const current=await ownedClass(classId,session.user_id);if(!current)return null;
          const created=await db.prepare(`INSERT INTO announcements(author_user_id,title,category,content,scheduled_at,published_at,pinned)
            VALUES (?,?,?,?,?,?,?)`).run(session.user_id,title,body.categoria,content,now,now,body.fixarNoTopo?1:0);
          const id=Number(created.lastInsertRowid);
          await db.prepare("INSERT INTO announcement_recipients(announcement_id,recipient_type,recipient_id) VALUES (?,'professor',?)").run(id,current.professor_id);
          await db.prepare('INSERT INTO student_course_announcements(announcement_id,class_id,requires_acknowledgement) VALUES (?,?,?)').run(id,classId,body.solicitarConfirmacao?1:0);
          await db.prepare('INSERT INTO student_announcement_audiences(announcement_id,all_students) VALUES (?,0)').run(id);
          await db.prepare('INSERT INTO student_announcement_classes(announcement_id,class_id) VALUES (?,?)').run(id,classId);
          return id;
        });
        if(!result)return json(response,404,{message:'Turma não encontrada.'});
        createdId=result;
        stored=await prepareStoredAttachments(createdId,attachmentResult.newItems);
        await db.transaction(async()=>{
          await insertAnnouncementAttachments(createdId,stored);
          await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`course_wall_post_created:${classId}:${createdId}`,ip);
        });
      }catch(error){
        await removeStoredAttachments(stored.map(item=>item.storage_path)).catch(cleanupError=>logger.error('course_wall_attachment_cleanup_failed',cleanupError,{announcementId:createdId}));
        if(createdId)await db.prepare('DELETE FROM announcements WHERE id=?').run(createdId).catch(cleanupError=>logger.error('course_wall_rollback_failed',cleanupError,{announcementId:createdId}));
        logger.error('course_wall_creation_failed',error,{classId,announcementId:createdId});
        return json(response,502,{message:'Não foi possível publicar no mural. Nenhuma publicação foi criada.'});
      }
      return json(response,201,{id:createdId,message:'Publicação enviada ao mural da turma.'});
    }

    if(announcementId&&request.method==='PUT'){
      const post=await postForProfessor(classId,announcementId,session.user_id);
      if(!post)return json(response,404,{message:'Publicação não encontrada.'});
      const existingAttachments=new Map((await db.prepare('SELECT id,filename,mime_type,size_bytes,data_url,storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId)).map(row=>[Number(row.id),row]));
      const {body,title,content,attachmentResult,errors}=await normalizedBody(request,existingAttachments);
      if(hasValidationErrors(errors))return invalid(response,errors);
      const retainedIds=attachmentResult.existingItems.map(item=>Number(item.id));
      const removed=[...existingAttachments.values()].filter(item=>!retainedIds.includes(Number(item.id)));
      let stored=[];
      try{
        stored=await prepareStoredAttachments(announcementId,attachmentResult.newItems);
        await db.transaction(async()=>{
          const current=await postForProfessor(classId,announcementId,session.user_id);
          if(!current)throw new Error('course_wall_post_not_found');
          await db.prepare(`UPDATE announcements SET title=?,category=?,content=?,pinned=?,updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND author_user_id=? AND active=1`).run(title,body.categoria,content,body.fixarNoTopo?1:0,announcementId,session.user_id);
          await db.prepare('UPDATE student_course_announcements SET requires_acknowledgement=? WHERE announcement_id=? AND class_id=?').run(body.solicitarConfirmacao?1:0,announcementId,classId);
          if(retainedIds.length)await db.prepare(`DELETE FROM announcement_attachments WHERE announcement_id=? AND id NOT IN (${retainedIds.map(()=>'?').join(',')})`).run(announcementId,...retainedIds);
          else await db.prepare('DELETE FROM announcement_attachments WHERE announcement_id=?').run(announcementId);
          await insertAnnouncementAttachments(announcementId,stored);
          await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`course_wall_post_updated:${classId}:${announcementId}`,ip);
        });
      }catch(error){
        await removeStoredAttachments(stored.map(item=>item.storage_path)).catch(cleanupError=>logger.error('course_wall_attachment_cleanup_failed',cleanupError,{announcementId}));
        logger.error('course_wall_update_failed',error,{classId,announcementId});
        return json(response,502,{message:'Não foi possível atualizar a publicação. A versão anterior foi preservada.'});
      }
      await removeStoredAttachments(removed.map(item=>item.storage_path)).catch(error=>logger.error('course_wall_attachment_cleanup_failed',error,{announcementId}));
      return json(response,200,{message:'Publicação atualizada.'});
    }

    if(announcementId&&request.method==='DELETE'){
      if(!await postForProfessor(classId,announcementId,session.user_id))return json(response,404,{message:'Publicação não encontrada.'});
      const attachments=await db.prepare('SELECT storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId);
      const deleted=await db.transaction(async()=>{
        const result=await db.prepare(`DELETE FROM announcements WHERE id=? AND author_user_id=? AND EXISTS(
          SELECT 1 FROM student_course_announcements WHERE announcement_id=? AND class_id=?)`).run(announcementId,session.user_id,announcementId,classId);
        if(result.changes)await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`course_wall_post_deleted:${classId}:${announcementId}`,ip);
        return result;
      });
      if(!deleted.changes)return json(response,404,{message:'Publicação não encontrada.'});
      await removeStoredAttachments(attachments.map(item=>item.storage_path)).catch(error=>logger.error('course_wall_attachment_cleanup_failed',error,{announcementId}));
      return json(response,200,{message:'Publicação excluída do mural.'});
    }

    return json(response,405,{message:'Método não permitido.'});
  };
}
