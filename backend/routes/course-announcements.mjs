import { communityClass } from './course-community.mjs';
import { COURSE_WALL_CATEGORIES, courseWallPermissions } from '../../shared/course-wall.mjs';
import { notifyCourseWallGroup } from '../course-wall-notifications.mjs';

export function createCourseAnnouncementRoutes(context){
  const {
    db,json,authorize,readJson,cleanText,sanitizeAnnouncementContent,requiredTextError,
    hasValidationErrors,invalid,normalizeAnnouncementAttachments,prepareStoredAttachments,
    insertAnnouncementAttachments,removeStoredAttachments,notificationService,notificationOutbox,logger,
  }=context;

  const postForProfessor=(classId,announcementId,userId)=>db.prepare(`SELECT a.id,a.scheduled_at
    FROM announcements a
    JOIN student_course_announcements sca ON sca.announcement_id=a.id
    JOIN classes c ON c.id=sca.class_id
    JOIN professor_profiles pp ON pp.id=c.professor_id AND pp.active=1
    JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
    WHERE sca.class_id=? AND a.id=? AND a.author_user_id=? AND a.active=1 AND c.active=1 AND pp.user_id=?`).get(classId,announcementId,userId,userId);

  const wallVersion=async classId=>{
    const row=await db.prepare(`SELECT COUNT(*) AS posts,MAX(a.updated_at) AS updated,
      (SELECT COUNT(*) FROM course_post_likes likes JOIN student_course_announcements linked ON linked.announcement_id=likes.announcement_id WHERE linked.class_id=?) AS likes,
      (SELECT COUNT(*) FROM course_post_comments comments JOIN student_course_announcements linked ON linked.announcement_id=comments.announcement_id WHERE linked.class_id=?) AS comments,
      (SELECT COUNT(*) FROM announcement_reads reads JOIN student_course_announcements linked ON linked.announcement_id=reads.announcement_id WHERE linked.class_id=?) AS reads
      FROM announcements a JOIN student_course_announcements sca ON sca.announcement_id=a.id
      WHERE sca.class_id=? AND a.active=1`).get(classId,classId,classId,classId);
    return [Number(row?.posts||0),row?.updated||'',Number(row?.likes||0),Number(row?.comments||0),Number(row?.reads||0)].join(':');
  };

  const listPosts=async(classId,userId,session,page,permissions)=>{
    const rows=await db.prepare(`SELECT a.id,a.title AS titulo,a.category AS categoria,a.content AS conteudo,
      a.scheduled_at AS data,a.pinned AS fixado,sca.requires_acknowledgement AS requer_confirmacao,
      a.author_user_id,u.name AS autor,u.role AS autor_role,avatar_photo.updated_at AS foto_versao,
      (SELECT COUNT(*) FROM course_post_likes cl WHERE cl.announcement_id=a.id) AS curtidas,
      EXISTS(SELECT 1 FROM course_post_likes cl WHERE cl.announcement_id=a.id AND cl.user_id=?) AS curtiu,
      EXISTS(SELECT 1 FROM announcement_reads ar WHERE ar.announcement_id=a.id AND ar.user_id=?) AS lido,
      (SELECT COUNT(*) FROM course_post_comments cc WHERE cc.announcement_id=a.id) AS comentarios
      FROM announcements a
      JOIN student_course_announcements sca ON sca.announcement_id=a.id
      JOIN users u ON u.id=a.author_user_id
      LEFT JOIN professor_profiles avatar_teacher ON avatar_teacher.user_id=u.id AND avatar_teacher.active=1 AND u.role='professor'
      LEFT JOIN student_accounts avatar_student ON avatar_student.user_id=u.id AND u.role='aluno'
      LEFT JOIN profile_photos avatar_photo ON
        (avatar_photo.owner_type='professor' AND avatar_photo.owner_id=avatar_teacher.id) OR
        (avatar_photo.owner_type='student' AND avatar_photo.owner_id=avatar_student.student_id)
      WHERE sca.class_id=? AND a.active=1
      ORDER BY a.pinned DESC,a.scheduled_at DESC,a.id DESC LIMIT ? OFFSET ?`).all(userId,userId,classId,page?5:100,page?(page-1)*5:0);
    if(!rows.length)return [];
    const ids=rows.map(row=>Number(row.id)),placeholders=ids.map(()=>'?').join(',');
    const attachments=await db.prepare(`SELECT id,announcement_id,filename,mime_type,size_bytes FROM announcement_attachments
      WHERE announcement_id IN (${placeholders}) ORDER BY id`).all(...ids);
    let readers=[],totalRow={total:0};
    if(session.role==='professor'){
      [readers,totalRow]=await Promise.all([
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
    }
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
      autor:row.autor,autorRole:row.autor_role,
      fotoUrl:row.foto_versao?`/api/turmas/${classId}/mural/${Number(row.id)}/foto?v=${encodeURIComponent(row.foto_versao)}`:'',
      curtidas:Number(row.curtidas),curtiu:Boolean(row.curtiu),comentarios:Number(row.comentarios),lido:Boolean(row.lido),
      podeEditar:Number(row.author_user_id)===Number(userId)&&(session.role==='professor'||permissions.publicar),
      podeExcluir:session.role==='professor'||Number(row.author_user_id)===Number(userId),
      totalAlunos:totalStudents,visualizacoes:session.role==='professor'?visualizacoes:undefined,
      anexos:attachments.filter(item=>Number(item.announcement_id)===Number(row.id)).map(item=>({
        id:Number(item.id),nome:item.filename,tipo:item.mime_type,tamanho:Number(item.size_bytes),
        url:session.role==='aluno'?`/api/aluno/informativos/${Number(row.id)}/anexos/${Number(item.id)}`:`/api/informativos/${Number(row.id)}/anexos/${Number(item.id)}`,
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
      categoria:COURSE_WALL_CATEGORIES.includes(body.categoria)?'':'Selecione uma categoria válida.',
      conteudo:requiredTextError(content.replace(/<[^>]+>/g,' '),'O conteúdo',10,5000),
      anexos:attachmentResult.error||'',
    };
    return {body,title,content,attachmentResult,errors};
  };

  return async(request,response,url,ip)=>{
    const shared=url.pathname.startsWith('/api/turmas/');
    const versionMatch=url.pathname.match(/^\/api\/turmas\/(\d+)\/mural\/versao$/);
    if(versionMatch&&request.method==='GET'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const classId=Number(versionMatch[1]),course=await communityClass(db,classId,session);
      if(!course)return json(response,404,{message:'Turma não encontrada.'});
      return json(response,200,{version:await wallVersion(classId)});
    }
    const match=url.pathname.match(/^\/api\/(?:professores\/me\/)?turmas\/(\d+)\/(?:mural|informativos)(?:\/(\d+))?$/);
    if(!match)return json(response,404,{message:'Rota não encontrada.'});
    const session=await authorize(request,response,shared?['gestor','professor','aluno']:['professor']);if(!session)return;
    const classId=Number(match[1]),announcementId=match[2]?Number(match[2]):0;
    const course=await communityClass(db,classId,session);
    if(!course)return json(response,404,{message:'Turma não encontrada.'});
    const permissions=courseWallPermissions(session.role,course.stream_mode);

    if(!announcementId&&request.method==='GET'){
      const page=shared?Math.max(1,Math.min(100000,parseInt(url.searchParams.get('page'),10)||1)):0;
      const total=await db.prepare('SELECT COUNT(*) AS total FROM announcements a JOIN student_course_announcements sca ON sca.announcement_id=a.id WHERE sca.class_id=? AND a.active=1').get(classId);
      return json(response,200,{items:await listPosts(classId,session.user_id,session,page,permissions),total:Number(total.total),permissoes:permissions,version:await wallVersion(classId)});
    }

    if(!announcementId&&request.method==='POST'){
      if(!permissions.publicar)return json(response,403,{message:'O professor configurou este mural somente para comentários ou visualização.'});
      const {body,title,content,attachmentResult,errors}=await normalizedBody(request);
      if(session.role==='aluno'){body.fixarNoTopo=false;body.solicitarConfirmacao=false;}
      if(hasValidationErrors(errors))return invalid(response,errors);
      let createdId=0,stored=[];
      try{
        const now=new Date().toISOString();
        const result=await db.transaction(async()=>{
          if(db.dialect==='postgres')await db.prepare('SELECT id FROM classes WHERE id=? FOR UPDATE').get(classId);
          const current=await communityClass(db,classId,session);if(!current)return null;
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
      try{await notifyCourseWallGroup({db,notificationService,notificationOutbox,logger,classId,courseName:course.nome,actorUserId:session.user_id,actorName:session.name,event:'post',eventId:createdId});}
      catch(error){logger.error('course_wall_post_notification_failed',error,{classId,announcementId:createdId});}
      return json(response,201,{id:createdId,message:'Publicação enviada ao mural da turma.'});
    }

    if(announcementId&&request.method==='PUT'){
      if(session.role==='aluno'&&!permissions.publicar)return json(response,403,{message:'A publicação de alunos está desativada nesta turma.'});
      const post=session.role==='professor'?await postForProfessor(classId,announcementId,session.user_id):await db.prepare('SELECT a.id FROM announcements a JOIN student_course_announcements sca ON sca.announcement_id=a.id WHERE a.id=? AND sca.class_id=? AND a.author_user_id=? AND a.active=1').get(announcementId,classId,session.user_id);
      if(!post)return json(response,404,{message:'Publicação não encontrada.'});
      const existingAttachments=new Map((await db.prepare('SELECT id,filename,mime_type,size_bytes,data_url,storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId)).map(row=>[Number(row.id),row]));
      const {body,title,content,attachmentResult,errors}=await normalizedBody(request,existingAttachments);
      if(session.role==='aluno'){body.fixarNoTopo=false;body.solicitarConfirmacao=false;}
      if(hasValidationErrors(errors))return invalid(response,errors);
      const retainedIds=attachmentResult.existingItems.map(item=>Number(item.id));
      const removed=[...existingAttachments.values()].filter(item=>!retainedIds.includes(Number(item.id)));
      let stored=[];
      try{
        stored=await prepareStoredAttachments(announcementId,attachmentResult.newItems);
        await db.transaction(async()=>{
          const current=await communityClass(db,classId,session);
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
      const own=await db.prepare(`SELECT a.id FROM announcements a JOIN student_course_announcements sca ON sca.announcement_id=a.id WHERE a.id=? AND sca.class_id=? AND a.active=1${session.role==='professor'?'':' AND a.author_user_id=?'}`).get(announcementId,classId,...(session.role==='professor'?[]:[session.user_id]));
      if(!own)return json(response,404,{message:'Publicação não encontrada.'});
      const attachments=await db.prepare('SELECT storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId);
      const deleted=await db.transaction(async()=>{
        const result=await db.prepare(`DELETE FROM announcements WHERE id=? AND EXISTS(
          SELECT 1 FROM student_course_announcements WHERE announcement_id=? AND class_id=?)${session.role==='professor'?'':' AND author_user_id=?'}`).run(announcementId,announcementId,classId,...(session.role==='professor'?[]:[session.user_id]));
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
