import { createStudentAccessRoutes } from './student-access.mjs';
import { createStudentEmailRoutes } from './student-email.mjs';
import { createCourseAnnouncementRoutes } from './course-announcements.mjs';
import { createCommunityRoutes } from './course-community.mjs';
import { createStudentPortalRoutes } from './student-portal.mjs';
import { createAuthRoutes } from './auth.mjs';
import { createScheduleRoutes } from './schedules.mjs';
import { createAnnouncementRoutes } from './announcements.mjs';
import { createAttendanceRoutes } from './attendance.mjs';
import { createClassRoutes } from './classes.mjs';
import { createDashboardRoutes } from './dashboard.mjs';
import { createProfessorRoutes } from './professors.mjs';
import { createReportRoutes } from './reports.mjs';
import { createStudentRoutes } from './students.mjs';
import { createSupportRoutes } from './support.mjs';
import { createAccountRoutes } from './account.mjs';
import { createProfilePhotoRoutes } from './profile-photos.mjs';
import { createSchoolYearRoutes } from './school-years.mjs';

export function createApiHandler(context) {
  const { db, originAllowed, json } = context;
  const studentAccessRoutes = createStudentAccessRoutes(context);
  const studentEmailRoutes = createStudentEmailRoutes(context);
  const courseAnnouncementRoutes = createCourseAnnouncementRoutes(context);
  const communityRoutes = createCommunityRoutes(context);
  const studentPortalRoutes = createStudentPortalRoutes(context);
  const authRoutes = createAuthRoutes(context);
  const scheduleRoutes = createScheduleRoutes(context);
  const announcementRoutes = createAnnouncementRoutes(context);
  const attendanceRoutes = createAttendanceRoutes(context);
  const classRoutes = createClassRoutes(context);
  const dashboardRoutes = createDashboardRoutes(context);
  const professorRoutes = createProfessorRoutes(context);
  const reportRoutes = createReportRoutes(context);
  const studentRoutes = createStudentRoutes(context);
  const supportRoutes = createSupportRoutes(context);
  const accountRoutes = createAccountRoutes(context);
  const profilePhotoRoutes = createProfilePhotoRoutes(context);
  const schoolYearRoutes = createSchoolYearRoutes(context);

  return async function api(request, response, url) {
    const ip = String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'local').split(',')[0].trim();
    if (['POST','PUT','PATCH','DELETE'].includes(request.method) && !originAllowed(request)) {
      return json(response, 403, { message: 'Origem não autorizada.' });
    }
    if (url.pathname.split('/').some(segment => /^\d+$/.test(segment) && (!Number.isSafeInteger(Number(segment)) || Number(segment) < 1))) {
      return json(response, 400, { message: 'Identificador inválido.' });
    }
  
    if (request.method === 'GET' && url.pathname === '/api/health') {
      await db.prepare('SELECT 1 AS ready').get();
      return json(response, 200, { status: 'ok' });
    }
  
    if (url.pathname.startsWith('/api/student-email/')) return studentEmailRoutes(request,response,url,ip);
    if(/^\/api\/turmas\/\d+\/mural(?:\/versao|\/\d+)?$/.test(url.pathname))return courseAnnouncementRoutes(request,response,url,ip);
    if(url.pathname.startsWith('/api/turmas/'))return communityRoutes(request,response,url,ip);
    if (url.pathname.startsWith('/api/student-access/') || url.pathname.startsWith('/api/student-invitations/')) return studentAccessRoutes(request,response,url,ip);
    if (url.pathname.startsWith('/api/aluno/') || url.pathname.startsWith('/api/student-audiences/')) return studentPortalRoutes(request,response,url,ip);

    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/invitations/')) {
      return authRoutes(request, response, url, ip);
    }
  
    if (url.pathname === '/api/account' || url.pathname.startsWith('/api/account/')) return accountRoutes(request, response, url, ip);
    if (url.pathname === '/api/profile-photo' || /^\/api\/(?:professores|alunos)\/\d+\/foto$/.test(url.pathname)) return profilePhotoRoutes(request, response, url, ip);
    if (url.pathname === '/api/school-years' || /^\/api\/school-years\/\d+$/.test(url.pathname)) return schoolYearRoutes(request, response, url, ip);

    if (url.pathname === '/alunos' || url.pathname.startsWith('/alunos/') || url.pathname.startsWith('/api/alunos/') || url.pathname.startsWith('/api/churches') || url.pathname === '/api/catalogos' || url.pathname === '/professores/meus-alunos' || url.pathname === '/api/professores/me/alunos') {
      return studentRoutes(request, response, url, ip);
    }
  
    if (/^\/api\/professores\/me\/turmas\/\d+\/(?:mural|informativos)(?:\/\d+)?$/.test(url.pathname)) return courseAnnouncementRoutes(request,response,url,ip);
    if (url.pathname === '/api/professores/me/turmas' || url.pathname === '/api/professores/me/turmas/opcoes' || /^\/api\/professores\/me\/turmas\/\d+$/.test(url.pathname)) return classRoutes(request,response,url,ip);
    if (url.pathname.startsWith('/api/professores/me/turmas/')) return scheduleRoutes(request,response,url,ip);

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
