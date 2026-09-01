export function createProfessorRoutes(context) {
  const {
    db,
    json,
    usesSupabaseAuth,
    readJson,
    cleanEmail,
    isProduction,
    issueProfessorInvite,
    supabaseAdmin,
    authorize,
    cleanText,
    hasValidationErrors,
    invalid,
    duplicateError,
    selectedSchoolYear,
    professorDeletionImpact,
    validateProfessor,
  } = context;

  return async function professorRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/professores'){
        if(!await authorize(request,response,['gestor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const rows=(await db.prepare(`
          SELECT professor_profiles.id,professor_profiles.name AS nome,professor_profiles.email AS contato,
            professor_profiles.phone AS telefone,locations.name AS local,
            CASE professor_profiles.active WHEN 1 THEN 'Ativo' ELSE 'Inativo' END AS status,
            users.active AS user_active,
            MAX(CASE WHEN professor_invites.accepted_at IS NULL AND professor_invites.expires_at>CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS has_valid_invite,
            GROUP_CONCAT(DISTINCT courses.name) AS course_names
          FROM professor_profiles
          LEFT JOIN locations ON locations.id=professor_profiles.home_location_id
          LEFT JOIN users ON users.id=professor_profiles.user_id
          LEFT JOIN professor_invites ON professor_invites.professor_profile_id=professor_profiles.id
          LEFT JOIN classes ON classes.professor_id=professor_profiles.id AND classes.active=1 AND classes.school_year_id=?
          LEFT JOIN courses ON courses.id=classes.course_id
          GROUP BY professor_profiles.id,locations.name,users.active
          ORDER BY professor_profiles.name
        `).all(period.id)).map(row=>({
          ...row,
          cursos:row.course_names?row.course_names.split(','):[],
          acesso:row.status==='Inativo'?'Desativado':row.user_active===1?'Ativo':row.has_valid_invite===1?'Convite pendente':'Envio pendente',
        }));
        const cursos=(await db.prepare('SELECT name FROM courses WHERE active=1 ORDER BY name').all()).map(row=>row.name);
        const locais=(await db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all()).map(row=>row.name);
        return json(response,200,{professores:rows,cursos,locais});
      }
    
      if(request.method==='POST'&&url.pathname==='/professores'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body=await readJson(request),name=cleanText(body.nome,100),email=cleanEmail(body.contato),phone=cleanText(body.telefone,30);
        const locationName=cleanText(body.local,100),courseNames=[...new Set((Array.isArray(body.cursos)?body.cursos:[]).map(value=>cleanText(value,100)).filter(Boolean))];
        const errors=validateProfessor({...body,nome:name,contato:email,telefone:phone,local:locationName,cursos:courseNames});
        if(hasValidationErrors(errors))return invalid(response,errors);
        const location=await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
        if(!location)return invalid(response,{local:'Selecione uma igreja ativa cadastrada em Cursos e igrejas.'});
        const catalogCourses=[];
        for(const courseName of courseNames){
          const course=await db.prepare('SELECT id,name FROM courses WHERE name=? AND active=1').get(courseName);
          if(!course)return invalid(response,{cursos:`O curso “${courseName}” não está cadastrado ou está inativo.`});
          catalogCourses.push(course);
        }
        const existing=await db.prepare('SELECT id,user_id,active FROM professor_profiles WHERE email=?').get(email);
        if(existing?.active!==undefined&&existing.active!==1)return json(response,409,{message:'Este professor está desativado. Reative o cadastro existente em vez de criar outro.'});
        if(existing?.user_id)return json(response,409,{message:'Este professor já possui uma conta ativa.'});
        try{
          const professorId=await db.transaction(async()=>{
            let targetProfessorId=existing?.id;
            if(targetProfessorId){
              await db.prepare('UPDATE professor_profiles SET name=?,phone=?,home_location_id=?,active=1 WHERE id=?').run(name,phone,location.id,targetProfessorId);
            }else{
              const result=await db.prepare('INSERT INTO professor_profiles (name,email,phone,home_location_id) VALUES (?,?,?,?)').run(name,email,phone,location.id);
              targetProfessorId=Number(result.lastInsertRowid);
            }
            for(const course of catalogCourses){
              await db.prepare('INSERT OR IGNORE INTO classes (school_year_id,course_id,professor_id,location_id,label) VALUES (?,?,?,?,?)').run(period.id,course.id,targetProfessorId,location.id,`${course.name} — ${locationName}`);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,existing?'professor_registration_resumed':'professor_created',ip);
            return targetProfessorId;
          });
          const invitation=await issueProfessorInvite({professorId,name,email,createdBy:session.user_id,ip,auditAction:existing?'professor_invite_reissued':'professor_invite_created'});
          return json(response,existing?200:201,{
            id:professorId,
            inviteSent:invitation.inviteSent,
            message:invitation.inviteSent
              ? (existing?'Cadastro existente atualizado e novo convite enviado.':'Professor cadastrado e convite enviado.')
              : 'Professor cadastrado, mas o convite não pôde ser enviado. Use “Reenviar convite” após revisar o remetente de e-mail.',
            devMailbox:isProduction?null:'/dev-mail',
          });
        }catch(error){
          if(error.code === '23505' || String(error).includes('UNIQUE'))return json(response,409,{message:'Já existe um professor com este e-mail.'});
          throw error;
        }
      }
    
      const professorInviteMatch=url.pathname.match(/^\/professores\/(\d+)\/reenviar-convite$/);
      if(professorInviteMatch&&request.method==='POST'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const id=Number(professorInviteMatch[1]);
        const professor=await db.prepare('SELECT id,name,email,user_id,active FROM professor_profiles WHERE id=?').get(id);
        if(!professor||professor.active!==1)return json(response,404,{message:'Professor ativo não encontrado.'});
        if(professor.user_id)return json(response,409,{message:'Este professor já ativou a conta.'});
        const invitation=await issueProfessorInvite({professorId:id,name:professor.name,email:professor.email,createdBy:session.user_id,ip,auditAction:'professor_invite_reissued'});
        if(!invitation.inviteSent)return json(response,502,{message:'O convite foi renovado, mas o provedor de e-mail recusou o envio. Revise o remetente configurado e tente novamente.'});
        return json(response,200,{message:'Novo convite enviado com sucesso.',expiresAt:invitation.expiresAt});
      }
    
      const professorImpactMatch=url.pathname.match(/^\/professores\/(\d+)\/impacto-exclusao$/);
      if(professorImpactMatch&&request.method==='GET'){
        if(!await authorize(request,response,['gestor']))return;
        const impact=await professorDeletionImpact(Number(professorImpactMatch[1]));
        if(!impact)return json(response,404,{message:'Professor não encontrado.'});
        return json(response,200,impact);
      }
    
      const professorMatch=url.pathname.match(/^\/professores\/(\d+)$/);
      if(professorMatch&&request.method==='PUT'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const id=Number(professorMatch[1]),body=await readJson(request);
        const name=cleanText(body.nome,100),email=cleanEmail(body.contato),phone=cleanText(body.telefone,30),locationName=cleanText(body.local,100);
        const courseNames=[...new Set((Array.isArray(body.cursos)?body.cursos:[]).map(value=>cleanText(value,100)).filter(Boolean))];
        const errors=validateProfessor({...body,nome:name,contato:email,telefone:phone,local:locationName,cursos:courseNames});
        if(hasValidationErrors(errors))return invalid(response,errors);
        const current=await db.prepare('SELECT id FROM professor_profiles WHERE id=? AND active=1').get(id);
        if(!current)return json(response,404,{message:'Professor ativo não encontrado.'});
        const location=await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
        if(!location)return invalid(response,{local:'Selecione uma igreja ativa cadastrada em Cursos e igrejas.'});
        const catalogCourses=[];
        for(const courseName of courseNames){
          const course=await db.prepare('SELECT id,name FROM courses WHERE name=? AND active=1').get(courseName);
          if(!course)return invalid(response,{cursos:`O curso “${courseName}” não está cadastrado ou está inativo.`});
          catalogCourses.push(course);
        }
        try{
          await db.transaction(async()=>{
            await db.prepare('UPDATE professor_profiles SET name=?,email=?,phone=?,home_location_id=? WHERE id=?').run(name,email,phone,location.id,id);
            const selectedCourseIds=catalogCourses.map(course=>Number(course.id));
            if(selectedCourseIds.length){
              await db.prepare(`UPDATE classes SET active=0 WHERE professor_id=? AND school_year_id=? AND course_id NOT IN (${selectedCourseIds.map(()=>'?').join(',')})`).run(id,period.id,...selectedCourseIds);
            }else{
              await db.prepare('UPDATE classes SET active=0 WHERE professor_id=? AND school_year_id=?').run(id,period.id);
            }
            for(const course of catalogCourses){
              const existingClass=await db.prepare('SELECT id FROM classes WHERE school_year_id=? AND course_id=? AND professor_id=? ORDER BY active DESC,id LIMIT 1').get(period.id,course.id,id);
              if(existingClass)await db.prepare('UPDATE classes SET active=1 WHERE id=?').run(existingClass.id);
              else await db.prepare('INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label,active) VALUES (?,?,?,?,?,1)').run(period.id,course.id,id,location.id,`${course.name} — ${locationName}`);
            }
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_updated',ip);
          });
          return json(response,200,{success:true});
        }catch(error){
          if(duplicateError(error))return json(response,409,{message:'Já existe um professor com este e-mail.'});
          throw error;
        }
      }
      if(professorMatch&&request.method==='DELETE'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const id=Number(professorMatch[1]);
        const historicalLink=await db.prepare('SELECT classes.id FROM classes JOIN school_years ON school_years.id=classes.school_year_id WHERE classes.professor_id=? AND school_years.closed_at IS NOT NULL LIMIT 1').get(id);
        if(historicalLink)return json(response,409,{message:'Este professor possui histórico em um período encerrado e não pode ser apagado sem violar a integridade do histórico letivo.'});
        const professor=await db.prepare(`
          SELECT professor_profiles.id,professor_profiles.user_id,users.auth_user_id
          FROM professor_profiles LEFT JOIN users ON users.id=professor_profiles.user_id
          WHERE professor_profiles.id=?
        `).get(id);
        if(!professor)return json(response,404,{message:'Professor não encontrado.'});
        const impact=await professorDeletionImpact(id);
    
        if(professor.auth_user_id&&usesSupabaseAuth&&!supabaseAdmin){
          return json(response,503,{message:'A exclusão definitiva não está disponível porque a chave administrativa do Supabase não foi configurada.'});
        }
        if(professor.auth_user_id&&supabaseAdmin){
          const { error }=await supabaseAdmin.auth.admin.deleteUser(professor.auth_user_id,false);
          const authAlreadyAbsent=error&&(error.status===404||/not found|does not exist/i.test(error.message || ''));
          if(error&&!authAlreadyAbsent){
            console.error('Não foi possível excluir definitivamente o usuário do Supabase:',error.message);
            return json(response,502,{message:'Não foi possível apagar a conta de autenticação. Nenhum dado local foi excluído; tente novamente.'});
          }
        }
    
        await db.transaction(async()=>{
          if(professor.user_id){
            await db.prepare(`DELETE FROM attendance_records WHERE session_id IN (
              SELECT attendance_sessions.id FROM attendance_sessions
              LEFT JOIN classes ON classes.id=attendance_sessions.class_id
              WHERE classes.professor_id=? OR attendance_sessions.recorded_by=?
            )`).run(id,professor.user_id);
            await db.prepare(`DELETE FROM attendance_sessions WHERE class_id IN (
              SELECT id FROM classes WHERE professor_id=?
            ) OR recorded_by=?`).run(id,professor.user_id);
            await db.prepare(`DELETE FROM announcement_reads WHERE announcement_id IN (
              SELECT id FROM announcements WHERE author_user_id=?
            ) OR user_id=?`).run(professor.user_id,professor.user_id);
            await db.prepare('DELETE FROM announcements WHERE author_user_id=?').run(professor.user_id);
            await db.prepare(`DELETE FROM support_messages WHERE ticket_id IN (
              SELECT id FROM support_tickets WHERE requester_user_id=?
            ) OR author_user_id=?`).run(professor.user_id,professor.user_id);
            await db.prepare('DELETE FROM support_tickets WHERE requester_user_id=?').run(professor.user_id);
            await db.prepare('DELETE FROM sessions WHERE user_id=?').run(professor.user_id);
            await db.prepare('DELETE FROM password_resets WHERE user_id=?').run(professor.user_id);
            await db.prepare('DELETE FROM user_settings WHERE user_id=?').run(professor.user_id);
            await db.prepare('DELETE FROM audit_log WHERE user_id=?').run(professor.user_id);
          }
          await db.prepare(`DELETE FROM attendance_records WHERE session_id IN (
            SELECT attendance_sessions.id FROM attendance_sessions
            JOIN classes ON classes.id=attendance_sessions.class_id
            WHERE classes.professor_id=?
          )`).run(id);
          await db.prepare(`DELETE FROM attendance_sessions WHERE class_id IN (
            SELECT id FROM classes WHERE professor_id=?
          )`).run(id);
          await db.prepare(`DELETE FROM dropout_events WHERE class_id IN (
            SELECT id FROM classes WHERE professor_id=?
          )`).run(id);
          await db.prepare(`DELETE FROM enrollments WHERE class_id IN (
            SELECT id FROM classes WHERE professor_id=?
          )`).run(id);
          await db.prepare('DELETE FROM classes WHERE professor_id=?').run(id);
          await db.prepare('DELETE FROM professor_invites WHERE professor_profile_id=?').run(id);
          await db.prepare('DELETE FROM dev_emails WHERE recipient=(SELECT email FROM professor_profiles WHERE id=?)').run(id);
          await db.prepare('DELETE FROM professor_profiles WHERE id=?').run(id);
          if(professor.user_id)await db.prepare('DELETE FROM users WHERE id=?').run(professor.user_id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_permanently_deleted',ip);
        });
        return json(response,200,{
          success:true,
          permanentlyDeleted:true,
          authAccountRemoved:true,
          resumo:impact?.resumo,
          message:'Professor e todos os dados vinculados foram excluídos definitivamente.',
        });
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}

