import { createAuthRoutes } from './auth.mjs';
import { createAnnouncementRoutes } from './announcements.mjs';
import { createAttendanceRoutes } from './attendance.mjs';
import { createClassRoutes } from './classes.mjs';
import { createDashboardRoutes } from './dashboard.mjs';
import { createProfessorRoutes } from './professors.mjs';
import { createReportRoutes } from './reports.mjs';
import { createStudentRoutes } from './students.mjs';
import { createSupportRoutes } from './support.mjs';

export function createApiHandler(context) {
  const {
    db,
    originAllowed,
    json,
    usesSupabaseAuth,
    readJson,
    cleanEmail,
    verifyPassword,
    publicUser,
    strongPassword,
    hashPassword,
    authorize,
    cleanText,
    personNameError,
    emailError,
    hasValidationErrors,
    invalid,
    validateSchoolYear,
    schoolYearView,
    duplicateError,
  } = context;
  const authRoutes = createAuthRoutes(context);
  const announcementRoutes = createAnnouncementRoutes(context);
  const attendanceRoutes = createAttendanceRoutes(context);
  const classRoutes = createClassRoutes(context);
  const dashboardRoutes = createDashboardRoutes(context);
  const professorRoutes = createProfessorRoutes(context);
  const reportRoutes = createReportRoutes(context);
  const studentRoutes = createStudentRoutes(context);
  const supportRoutes = createSupportRoutes(context);

  return async function api(request, response, url) {
    const ip = String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'local').split(',')[0].trim();
    if (['POST','PUT','PATCH','DELETE'].includes(request.method) && !originAllowed(request)) {
      return json(response, 403, { message: 'Origem não autorizada.' });
    }
  
    if (request.method === 'GET' && url.pathname === '/api/health') {
      await db.prepare('SELECT 1 AS ready').get();
      return json(response, 200, { status: 'ok', database: db.dialect });
    }
  
    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/invitations/')) {
      return authRoutes(request, response, url, ip);
    }
  
    if(request.method==='GET'&&url.pathname==='/api/account'){
      const session=await authorize(request,response,['gestor','professor']);if(!session)return;
      const row=await db.prepare('SELECT preferences_json FROM user_settings WHERE user_id=?').get(session.user_id);
      let preferences={};try{preferences=JSON.parse(row?.preferences_json||'{}')}catch{}
      return json(response,200,{user:publicUser({id:session.user_id,...session}),preferences});
    }
    if(request.method==='PUT'&&url.pathname==='/api/account/profile'){
      const session=await authorize(request,response,['gestor','professor']);if(!session)return;
      const body=await readJson(request),name=cleanText(body.nome,100),email=cleanEmail(body.email);
      const errors={nome:personNameError(name,'nome completo'),email:emailError(email)};
      if(hasValidationErrors(errors))return invalid(response,errors);
      try{
        await db.transaction(async () => {
          await db.prepare('UPDATE users SET name=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,email,session.user_id);
          if(session.role==='professor')await db.prepare('UPDATE professor_profiles SET name=?,email=? WHERE user_id=?').run(name,email,session.user_id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'profile_updated',ip);
        });
      }catch(error){if(String(error).includes('UNIQUE'))return json(response,409,{message:'Este e-mail já está em uso.'});throw error;}
      return json(response,200,{user:{id:session.user_id,nome:name,email,role:session.role}});
    }
    if(request.method==='PUT'&&url.pathname==='/api/account/password'){
      const session=await authorize(request,response,['gestor','professor']);if(!session)return;
      if(usesSupabaseAuth)return json(response,409,{message:'A senha desta conta é gerenciada pelo Supabase.'});
      const body=await readJson(request),user=await db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
      if(!(await verifyPassword(body.currentPassword,user.password_hash)))return json(response,400,{message:'A senha atual está incorreta.'});
      if(!strongPassword(body.newPassword))return json(response,400,{message:'A nova senha não atende aos requisitos de segurança.'});
      await db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(await hashPassword(body.newPassword),session.user_id);
      await db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').run(session.user_id,session.id);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'password_changed',ip);
      return json(response,200,{message:'Senha alterada com sucesso.'});
    }
    if(request.method==='PUT'&&url.pathname==='/api/account/preferences'){
      const session=await authorize(request,response,['gestor','professor']);if(!session)return;
      const body=await readJson(request),preferences=body.preferences&&typeof body.preferences==='object'?body.preferences:{};
      await db.prepare(`INSERT INTO user_settings (user_id,preferences_json) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,updated_at=CURRENT_TIMESTAMP`).run(session.user_id,JSON.stringify(preferences));
      return json(response,200,{preferences});
    }

    if(request.method==='GET'&&url.pathname==='/api/school-years'){
      if(!await authorize(request,response,['gestor','professor']))return;
      const periods=await db.prepare('SELECT * FROM school_years ORDER BY active DESC,start_date DESC,id DESC').all();
      return json(response,200,{periods:periods.map(schoolYearView),activeId:Number(periods.find(period=>period.active===1)?.id||0)});
    }
  
    if(request.method==='POST'&&url.pathname==='/api/school-years'){
      const session=await authorize(request,response,['gestor']);if(!session)return;
      const body=await readJson(request);
      const values={label:cleanText(body.label,40),start_date:cleanText(body.start_date||body.startDate,10),end_date:cleanText(body.end_date||body.endDate,10)};
      const errors=validateSchoolYear(values);
      if(hasValidationErrors(errors))return invalid(response,errors);
      const activate=body.ativar===true||body.active===true;
      try{
        const id=await db.transaction(async()=>{
          if(activate)await db.prepare('UPDATE school_years SET active=0,closed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE active=1').run();
          const result=await db.prepare('INSERT INTO school_years (label,start_date,end_date,active,dates_confirmed) VALUES (?,?,?,?,1)')
            .run(values.label,values.start_date,values.end_date,activate?1:0);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,activate?'school_year_created_and_activated':'school_year_created',ip);
          return Number(result.lastInsertRowid);
        });
        return json(response,201,{id,message:activate?'Período criado e ativado.':'Período criado. Ative-o quando o período vigente terminar.'});
      }catch(error){
        if(duplicateError(error))return json(response,409,{message:'Já existe um período com este nome ou outro período está ativo.'});
        throw error;
      }
    }
  
    const schoolYearMatch=url.pathname.match(/^\/api\/school-years\/(\d+)$/);
    if(schoolYearMatch&&request.method==='PUT'){
      const session=await authorize(request,response,['gestor']);if(!session)return;
      const id=Number(schoolYearMatch[1]),current=await db.prepare('SELECT * FROM school_years WHERE id=?').get(id);
      if(!current)return json(response,404,{message:'Período letivo não encontrado.'});
      if(current.closed_at)return json(response,409,{message:'Períodos encerrados são históricos imutáveis e não podem ser alterados.'});
      const body=await readJson(request);
      const values={label:cleanText(body.label,40),start_date:cleanText(body.start_date||body.startDate,10),end_date:cleanText(body.end_date||body.endDate,10)};
      const errors=validateSchoolYear(values);
      if(hasValidationErrors(errors))return invalid(response,errors);
      const activate=body.ativar===true||body.active===true;
      try{
        await db.transaction(async()=>{
          if(activate&&current.active!==1)await db.prepare('UPDATE school_years SET active=0,closed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE active=1 AND id<>?').run(id);
          await db.prepare('UPDATE school_years SET label=?,start_date=?,end_date=?,dates_confirmed=1,active=?,closed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?')
            .run(values.label,values.start_date,values.end_date,(current.active===1||activate)?1:0,id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,activate&&current.active!==1?'school_year_activated':'school_year_updated',ip);
        });
        return json(response,200,{success:true,message:activate&&current.active!==1?'Novo período ativo. O período anterior foi encerrado.':'Período atualizado.'});
      }catch(error){
        if(duplicateError(error))return json(response,409,{message:'Já existe um período com este nome ou outro período está ativo.'});
        throw error;
      }
    }
  
    if (url.pathname === '/alunos' || url.pathname.startsWith('/alunos/') || url.pathname.startsWith('/api/alunos/') || url.pathname.startsWith('/api/churches') || url.pathname === '/api/catalogos' || url.pathname === '/professores/meus-alunos' || url.pathname === '/api/professores/me/alunos') {
      return studentRoutes(request, response, url, ip);
    }
  
    if (url.pathname === '/cursos' || url.pathname.startsWith('/cursos/') || url.pathname.startsWith('/api/catalogos/')) {
      return classRoutes(request, response, url, ip);
    }
  
    if (url.pathname === '/professores' || (url.pathname.startsWith('/professores/') && !['/professores/meus-cursos','/professores/meus-alunos'].includes(url.pathname))) {
      return professorRoutes(request, response, url, ip);
    }
  
    if (url.pathname === '/professores/meus-cursos' || url.pathname === '/frequencia' || url.pathname.startsWith('/api/frequencia/')) {
      return attendanceRoutes(request, response, url, ip);
    }
  
    if (url.pathname.startsWith('/api/informativos')) {
      return announcementRoutes(request, response, url, ip);
    }
  
  
    if (url.pathname.startsWith('/api/suporte')) {
      return supportRoutes(request, response, url, ip);
    }
  
    if (url.pathname.startsWith('/api/dashboard/')) {
      return dashboardRoutes(request, response, url);
    }
  
    if (url.pathname.startsWith('/api/relatorios/')) {
      return reportRoutes(request, response, url);
    }
  
    return json(response, 404, { message: 'Rota não encontrada.' });
  }
  
}
