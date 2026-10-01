export function createProfilePhotoRoutes(context) {
  const { db, json, readJson, authorize, invalid, profilePhotoStorage, normalizeProfilePhoto, securityHeaders, logger } = context;
  return async function route(request, response, url, ip) {
    const accountPhoto=url.pathname==='/api/profile-photo';
    const professorPhoto=url.pathname.match(/^\/api\/professores\/(\d+)\/foto$/);
    const studentPhoto=url.pathname.match(/^\/api\/alunos\/(\d+)\/foto$/);
    if(accountPhoto||professorPhoto||studentPhoto){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      let ownerType='user',ownerId=Number(session.user_id);
      if(session.role==='aluno'&&!accountPhoto)return json(response,403,{message:'Acesse apenas sua própria foto pelo perfil.'});
      if(accountPhoto&&session.role==='aluno'){ownerType='student';ownerId=session.student_id;}
      if(accountPhoto&&session.role==='professor'){
        const profile=await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
        if(!profile)return json(response,404,{message:'Perfil de professor não encontrado.'});
        ownerType='professor';ownerId=Number(profile.id);
      }else if(professorPhoto){
        ownerType='professor';ownerId=Number(professorPhoto[1]);
        const profile=await db.prepare('SELECT id,user_id FROM professor_profiles WHERE id=? AND active=1').get(ownerId);
        if(!profile)return json(response,404,{message:'Professor não encontrado.'});
        if(session.role!=='gestor'&&Number(profile.user_id)!==Number(session.user_id))return json(response,403,{message:'Você não tem permissão para acessar esta foto.'});
      }else if(studentPhoto){
        ownerType='student';ownerId=Number(studentPhoto[1]);
        const student=await db.prepare('SELECT id FROM students WHERE id=? AND active=1').get(ownerId);
        if(!student)return json(response,404,{message:'Aluno não encontrado.'});
        if(session.role==='professor'){
          const allowed=await db.prepare(`SELECT students.id FROM students
            JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa'
            JOIN classes ON classes.id=enrollments.class_id AND classes.active=1
            JOIN school_years ON school_years.id=classes.school_year_id AND school_years.active=1 AND school_years.closed_at IS NULL
            JOIN professor_profiles ON professor_profiles.id=classes.professor_id AND professor_profiles.active=1
            WHERE students.id=? AND students.active=1 AND professor_profiles.user_id=? LIMIT 1`).get(ownerId,session.user_id);
          if(!allowed)return json(response,403,{message:'Você não tem permissão para acessar esta foto.'});
        }
      }
      if(['PUT','DELETE'].includes(request.method)&&!accountPhoto&&session.role!=='gestor')return json(response,403,{message:'Somente o gestor pode alterar esta foto.'});
      if(request.method==='GET'){
        try{
          const photo=await profilePhotoStorage.load(ownerType,ownerId);
          if(!photo)return json(response,404,{message:'Foto não cadastrada.'});
          const versioned=url.searchParams.has('v');
          response.writeHead(200,{
            ...securityHeaders(photo.mime_type),
            'Content-Length':String(photo.buffer.length),
            'Cache-Control':versioned?'private, max-age=31536000, immutable':'private, no-cache',
            'Content-Disposition':'inline',
          });
          return response.end(photo.buffer);
        }catch(error){logger.error('profile_photo_load_failed',error,{ownerType,ownerId});return json(response,502,{message:'Não foi possível carregar a foto.'});}
      }
      if(request.method==='PUT'){
        const body=await readJson(request,8*1024*1024),normalized=normalizeProfilePhoto(body.dataUrl);
        if(normalized.error)return invalid(response,{foto:normalized.error});
        try{
          const saved=await profilePhotoStorage.save(ownerType,ownerId,normalized);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`profile_photo_updated:${ownerType}:${ownerId}`,ip);
          return json(response,200,{success:true,updatedAt:saved?.updated_at,url:accountPhoto?'/api/profile-photo':`/api/${ownerType==='student'?'alunos':'professores'}/${ownerId}/foto`});
        }catch(error){logger.error('profile_photo_save_failed',error,{ownerType,ownerId});return json(response,502,{message:'Não foi possível salvar a foto. Tente novamente.'});}
      }
      if(request.method==='DELETE'){
        await profilePhotoStorage.remove(ownerType,ownerId);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`profile_photo_deleted:${ownerType}:${ownerId}`,ip);
        return json(response,200,{success:true});
      }
    }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
