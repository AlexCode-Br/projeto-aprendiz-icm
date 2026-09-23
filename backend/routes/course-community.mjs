import { randomUUID } from 'node:crypto';
import { normalizeProfilePhoto } from '../profile-photos.mjs';
import { googleMapsLink } from '../../shared/google-maps-link.mjs';
import { COURSE_WALL_MODES, courseWallPermissions, normalizeCourseWallMode } from '../../shared/course-wall.mjs';
import { notifyCourseWallGroup, notifyCourseWallLike } from '../course-wall-notifications.mjs';

export async function communityClass(db,id,session){
  const row=await db.prepare(`SELECT c.id,c.professor_id,pp.user_id AS teacher_user_id,co.name AS nome,l.name AS local,
    COALESCE(cp.stream_mode,'post_and_comment') AS stream_mode
    FROM classes c JOIN professor_profiles pp ON pp.id=c.professor_id AND pp.active=1
    JOIN courses co ON co.id=c.course_id JOIN locations l ON l.id=c.location_id
    JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
    LEFT JOIN class_presentation cp ON cp.class_id=c.id
    WHERE c.id=? AND c.active=1`).get(id);
  if(!row)return null;
  if(session.role==='gestor')return row;
  if(session.role==='professor')return Number(row.teacher_user_id)===Number(session.user_id)?row:null;
  if(session.role!=='aluno')return null;
  const enrollment=await db.prepare(`SELECT e.id FROM enrollments e JOIN students s ON s.id=e.student_id AND s.active=1
    WHERE e.class_id=? AND e.student_id=? AND e.status='ativa'`).get(id,session.student_id);
  return enrollment?row:null;
}

export function createCommunityRoutes(context){
  const {db,json,authorize,readJson,cleanText,securityHeaders,profilePhotoStorage,notificationService,notificationOutbox,logger}=context;
  return async(request,response,url)=>{
    const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
    if(url.pathname==='/api/turmas/configuracao-pendente'&&request.method==='GET'){
      if(session.role!=='professor')return json(response,403,{message:'Acesso restrito ao professor.'});
      const items=await db.prepare(`SELECT c.id,co.name AS nome,l.name AS local FROM classes c
        JOIN professor_profiles pp ON pp.id=c.professor_id JOIN courses co ON co.id=c.course_id JOIN locations l ON l.id=c.location_id
        JOIN school_years sy ON sy.id=c.school_year_id AND sy.active=1 AND sy.closed_at IS NULL
        LEFT JOIN class_presentation cp ON cp.class_id=c.id
        WHERE c.active=1 AND pp.active=1 AND pp.user_id=? AND (cp.class_id IS NULL OR cp.configured_by<>pp.user_id OR cp.configured_by IS NULL)
        ORDER BY c.id`).all(session.user_id);
      return json(response,200,{items});
    }
    const match=url.pathname.match(/^\/api\/turmas\/(\d+)\/(configuracao|banner|mural\/\d+\/(?:foto|curtida|comentarios(?:\/[a-f0-9-]+(?:\/foto)?)?))$/);
    if(!match)return json(response,404,{message:'Rota não encontrada.'});
    const id=Number(match[1]),course=await communityClass(db,id,session);
    if(!course)return json(response,404,{message:'Turma não encontrada.'});
    const action=match[2];
    if(action==='configuracao'||action==='banner'){
      const current=await db.prepare('SELECT * FROM class_presentation WHERE class_id=?').get(id);
      if(action==='banner'&&request.method==='GET'){
        if(!current?.banner_data)return json(response,404,{message:'Banner não cadastrado.'});
        const bytes=Buffer.from(current.banner_data.split(',')[1],'base64');
        response.writeHead(200,{...securityHeaders(current.banner_mime),'Cache-Control':'private, no-store','Content-Length':String(bytes.length)});return response.end(bytes);
      }
      if(action==='configuracao'&&request.method==='GET')return json(response,200,{id:course.id,nome:course.nome,local:course.local,endereco:current?.address||'',mapsUrl:googleMapsLink(current?.address),configurada:Boolean(current),banner:current?.banner_data?`/api/turmas/${id}/banner?v=${encodeURIComponent(current.updated_at)}`:'',x:current?.banner_x??50,y:current?.banner_y??50,zoom:current?.banner_zoom??100,permissaoMural:normalizeCourseWallMode(current?.stream_mode)});
      if(action==='configuracao'&&request.method==='PUT'){
        if(session.role!=='professor')return json(response,403,{message:'Somente o professor pode configurar a turma.'});
        const body=await readJson(request,2*1024*1024);
        let address=current?.address||'';
        if(body.mapsUrl!==undefined){
          if(typeof body.mapsUrl!=='string')return json(response,400,{message:'Informe um link válido do Google Maps.'});
          address=body.mapsUrl.trim()?googleMapsLink(body.mapsUrl):'';
          if(body.mapsUrl.trim()&&!address)return json(response,400,{message:'Cole um link HTTPS do Google Maps, usando a opção Compartilhar no mapa.'});
        }else if(body.endereco!==undefined){
          address=cleanText(body.endereco,401);
          if(address.length>400)return json(response,400,{message:'Use até 400 caracteres no endereço.'});
        }
        const wallMode=body.permissaoMural===undefined?normalizeCourseWallMode(current?.stream_mode):body.permissaoMural;
        if(!COURSE_WALL_MODES.includes(wallMode))return json(response,400,{message:'Selecione uma permissão válida para o mural.'});
        const x=Number(body.x??current?.banner_x??50),y=Number(body.y??current?.banner_y??50),zoom=Number(body.zoom??current?.banner_zoom??100);
        if(![x,y,zoom].every(Number.isInteger)||x<0||x>100||y<0||y>100||zoom<100||zoom>250)return json(response,400,{message:'Recorte inválido.'});
        let banner=current?.banner_data||null,mime=current?.banner_mime||null;
        if(body.banner===null){banner=null;mime=null;}
        else if(body.banner!==undefined){const photo=normalizeProfilePhoto(body.banner);if(photo.error||photo.sizeBytes>1024*1024)return json(response,400,{message:photo.error||'O banner deve ter até 1 MB após otimização.'});banner=photo.dataUrl;mime=photo.mimeType;}
        await db.prepare(`INSERT INTO class_presentation(class_id,address,banner_data,banner_mime,banner_x,banner_y,banner_zoom,stream_mode,configured_by,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(class_id) DO UPDATE SET address=excluded.address,banner_data=excluded.banner_data,banner_mime=excluded.banner_mime,banner_x=excluded.banner_x,banner_y=excluded.banner_y,banner_zoom=excluded.banner_zoom,stream_mode=excluded.stream_mode,configured_by=excluded.configured_by,updated_at=excluded.updated_at`).run(id,address,banner,mime,x,y,zoom,wallMode,session.user_id,new Date().toISOString());
        return json(response,200,{message:'Turma configurada.'});
      }
      return json(response,405,{message:'Método não permitido.'});
    }
    const [,postId,kind,commentId]=action.split('/');
    const permissions=courseWallPermissions(session.role,course.stream_mode);
    const post=await db.prepare('SELECT a.id,a.author_user_id,u.role AS author_role FROM announcements a JOIN users u ON u.id=a.author_user_id JOIN student_course_announcements sca ON sca.announcement_id=a.id WHERE a.id=? AND sca.class_id=? AND a.active=1').get(Number(postId),id);
    if(!post)return json(response,404,{message:'Publicação não encontrada.'});
    if(request.method==='GET'&&(kind==='foto'||kind==='comentarios'&&commentId&&action.endsWith('/foto'))){
      const author=kind==='foto'
        ?await db.prepare('SELECT author_user_id AS user_id FROM announcements WHERE id=? AND active=1').get(post.id)
        :await db.prepare('SELECT user_id FROM course_post_comments WHERE id=? AND announcement_id=?').get(commentId,post.id);
      if(!author)return json(response,404,{message:'Foto não encontrada.'});
      const owner=await db.prepare(`SELECT u.role,pp.id AS professor_id,sa.student_id,
        EXISTS(SELECT 1 FROM enrollments e JOIN students s ON s.id=e.student_id AND s.active=1
          WHERE e.class_id=? AND e.student_id=sa.student_id AND e.status='ativa') AS enrolled
        FROM users u
        LEFT JOIN professor_profiles pp ON pp.user_id=u.id AND pp.active=1
        LEFT JOIN student_accounts sa ON sa.user_id=u.id
        WHERE u.id=? AND u.active=1`).get(id,author.user_id);
      const ownerType=owner?.role==='professor'&&Number(owner.professor_id)===Number(course.professor_id)?'professor':owner?.role==='aluno'&&owner.enrolled?'student':'';
      const ownerId=ownerType==='professor'?owner.professor_id:ownerType==='student'?owner.student_id:0;
      if(!ownerId)return json(response,404,{message:'Foto não encontrada.'});
      try{
        const photo=await profilePhotoStorage.load(ownerType,ownerId);
        if(!photo)return json(response,404,{message:'Foto não encontrada.'});
        response.writeHead(200,{...securityHeaders(photo.mime_type),'Cache-Control':'private, no-store','Content-Length':String(photo.buffer.length),'Content-Disposition':'inline'});
        return response.end(photo.buffer);
      }catch(error){logger.error('course_wall_photo_load_failed',error,{classId:id,postId:post.id});return json(response,502,{message:'Não foi possível carregar a foto.'});}
    }
    if(kind==='curtida'&&['PUT','DELETE'].includes(request.method)){
      if(!permissions.reagir)return json(response,403,{message:'As interações dos alunos estão desativadas nesta turma.'});
      if(request.method==='PUT'){
        const result=await db.prepare('INSERT INTO course_post_likes(announcement_id,user_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(post.id,session.user_id);
        if(result.changes)try{await notifyCourseWallLike({notificationService,notificationOutbox,classId:id,courseName:course.nome,postId:post.id,ownerUserId:post.author_user_id,ownerRole:post.author_role,actorUserId:session.user_id,actorName:session.name});}
        catch(error){logger.error('course_wall_like_notification_failed',error,{classId:id,postId:post.id});}
      }else await db.prepare('DELETE FROM course_post_likes WHERE announcement_id=? AND user_id=?').run(post.id,session.user_id);
      return json(response,200,{success:true});
    }
    if(kind==='comentarios'&&!commentId&&request.method==='GET'){
      const page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1));
      const rows=await db.prepare(`SELECT cc.id,cc.content AS conteudo,cc.created_at AS data,u.name AS autor,u.role,cc.user_id,avatar_photo.updated_at AS foto_versao
        FROM course_post_comments cc JOIN users u ON u.id=cc.user_id
        LEFT JOIN professor_profiles avatar_teacher ON avatar_teacher.user_id=u.id AND avatar_teacher.active=1 AND u.role='professor'
        LEFT JOIN student_accounts avatar_student ON avatar_student.user_id=u.id AND u.role='aluno'
        LEFT JOIN profile_photos avatar_photo ON
          (avatar_photo.owner_type='professor' AND avatar_photo.owner_id=avatar_teacher.id) OR
          (avatar_photo.owner_type='student' AND avatar_photo.owner_id=avatar_student.student_id)
        WHERE cc.announcement_id=? ORDER BY cc.created_at DESC,cc.id DESC LIMIT 20 OFFSET ?`).all(post.id,(Math.floor(page)-1)*20);
      const total=await db.prepare('SELECT COUNT(*) AS total FROM course_post_comments WHERE announcement_id=?').get(post.id);
      return json(response,200,{total:Number(total.total),podeComentar:permissions.comentar,items:rows.reverse().map(({user_id,foto_versao,...row})=>({...row,
        fotoUrl:foto_versao?`/api/turmas/${id}/mural/${post.id}/comentarios/${row.id}/foto?v=${encodeURIComponent(foto_versao)}`:'',
        podeExcluir:session.role==='professor'||Number(user_id)===Number(session.user_id)}))});
    }
    if(kind==='comentarios'&&!commentId&&request.method==='POST'){
      if(!permissions.comentar)return json(response,403,{message:'Os comentários dos alunos estão desativados nesta turma.'});
      const body=await readJson(request),content=cleanText(body.conteudo,2001);
      if(!content||content.length>2000)return json(response,400,{message:'Escreva um comentário de até 2000 caracteres.'});
      const createdId=randomUUID();
      await db.prepare('INSERT INTO course_post_comments(id,announcement_id,user_id,content,created_at) VALUES (?,?,?,?,?)').run(createdId,post.id,session.user_id,content,new Date().toISOString());
      try{await notifyCourseWallGroup({db,notificationService,notificationOutbox,logger,classId:id,courseName:course.nome,actorUserId:session.user_id,actorName:session.name,event:'comment',eventId:createdId});}
      catch(error){logger.error('course_wall_comment_notification_failed',error,{classId:id,postId:post.id,commentId:createdId});}
      return json(response,201,{success:true});
    }
    if(kind==='comentarios'&&commentId&&request.method==='DELETE'){
      const result=await db.prepare(`DELETE FROM course_post_comments WHERE id=? AND announcement_id=?${session.role==='professor'?'':' AND user_id=?'}`).run(commentId,post.id,...(session.role==='professor'?[]:[session.user_id]));
      return json(response,result.changes?200:404,{success:Boolean(result.changes)});
    }
    return json(response,405,{message:'Método não permitido.'});
  };
}
