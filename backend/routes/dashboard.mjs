import { attachClassSchedules } from '../class-schedules.mjs';
import { supportChatUnread } from './support-chat.mjs';
import { classScheduleConflicts, classesOnDate, nextClassSchedule, nextClassSchedules } from '../../shared/class-schedules.mjs';

export function createDashboardRoutes(context) {
  const {
    db,
    json,
    authorize,
    schoolYearView,
    selectedSchoolYear,
    announcementScheduledCondition,
    appTimeZone = 'America/Sao_Paulo',
    zonedScheduleIso,
    zonedTodayDate,
  } = context;

  const enrollmentPeriods=new Set(['recentes','hoje','ontem','semana']);
  const shiftCalendarDate=(value,days)=>{
    const [year,month,day]=value.split('-').map(Number);
    return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);
  };
  const startOfWeek=value=>{
    const [year,month,day]=value.split('-').map(Number);
    const weekday=new Date(Date.UTC(year,month-1,day)).getUTCDay();
    return shiftCalendarDate(value,-((weekday+6)%7));
  };
  const databaseTimestamp=value=>db.dialect==='postgres'?new Date(value):value.slice(0,19).replace('T',' ');
  const normalizeEnrollmentTimestamp=value=>{
    const text=String(value||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(text))return `${text}T00:00:00.000Z`;
    if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text))return `${text.replace(' ','T')}Z`;
    return text;
  };
  const recentEnrollmentPage=async(schoolYearId,period='recentes',page=1)=>{
    const conditions=["enrollments.status='ativa'",'students.active=1','classes.active=1','classes.school_year_id=?'];
    const params=[schoolYearId];
    if(period!=='recentes'){
      const today=zonedTodayDate();
      const startDate=period==='hoje'?today:period==='ontem'?shiftCalendarDate(today,-1):startOfWeek(today);
      const endDate=period==='hoje'?shiftCalendarDate(today,1):period==='ontem'?today:shiftCalendarDate(startDate,7);
      conditions.push('enrollments.enrolled_at>=?','enrollments.enrolled_at<?');
      params.push(databaseTimestamp(zonedScheduleIso(startDate,'00:00')),databaseTimestamp(zonedScheduleIso(endDate,'00:00')));
    }
    const rows=await db.prepare(`SELECT enrollments.id AS matricula_id,students.id,students.name AS nome,
      courses.name AS curso,locations.name AS local,enrollments.enrolled_at,
      profile_photos.updated_at AS photo_updated_at
      FROM enrollments
      JOIN students ON students.id=enrollments.student_id
      JOIN classes ON classes.id=enrollments.class_id
      JOIN courses ON courses.id=classes.course_id
      JOIN locations ON locations.id=classes.location_id
      LEFT JOIN profile_photos ON profile_photos.owner_type='student' AND profile_photos.owner_id=students.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY enrollments.enrolled_at DESC,enrollments.id DESC
      LIMIT ? OFFSET ?`).all(...params,6,(page-1)*5);
    return{rows:rows.slice(0,5),page,hasPrevious:page>1,hasNext:rows.length>5};
  };
  const recentEnrollmentView=({photo_updated_at,...row})=>({
    ...row,
    id:Number(row.id),
    matricula_id:Number(row.matricula_id),
    enrolled_at:normalizeEnrollmentTimestamp(row.enrolled_at),
    foto_url:photo_updated_at?`/api/alunos/${row.id}/foto?v=${encodeURIComponent(photo_updated_at)}`:'',
  });

  return async function dashboardRoutes(request, response, url) {
      if(request.method==='GET'&&url.pathname==='/api/dashboard/gestor/inscricoes'){
        if(!await authorize(request,response,['gestor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const enrollmentPeriod=url.searchParams.get('periodo')||'recentes';
        if(!enrollmentPeriods.has(enrollmentPeriod))return json(response,400,{message:'Selecione um período válido.'});
        const pageText=url.searchParams.get('pagina')||'1',page=Number(pageText);
        if(!/^[1-9]\d*$/.test(pageText)||!Number.isSafeInteger(page))return json(response,400,{message:'Selecione uma página válida.'});
        const result=await recentEnrollmentPage(period.id,enrollmentPeriod,page);
        return json(response,200,{inscricoes:result.rows.map(recentEnrollmentView),periodo:enrollmentPeriod,paginacao:{pagina:result.page,temAnterior:result.hasPrevious,temProxima:result.hasNext},fusoHorario:appTimeZone});
      }
      if(request.method==='GET'&&url.pathname==='/api/dashboard/gestor'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const [totalAlunos,cursosAtivos,professores,ticketsPendentes,alunosPorTurma,ultimasInscricoes]=await Promise.all([
          db.prepare("SELECT COUNT(DISTINCT students.id) AS total FROM students JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa' JOIN classes ON classes.id=enrollments.class_id AND classes.active=1 WHERE students.active=1 AND classes.school_year_id=?").get(period.id),
          db.prepare('SELECT COUNT(*) AS total FROM classes WHERE active=1 AND school_year_id=?').get(period.id),
          db.prepare('SELECT COUNT(DISTINCT professor_profiles.id) AS total FROM professor_profiles JOIN classes ON classes.professor_id=professor_profiles.id WHERE professor_profiles.active=1 AND classes.active=1 AND classes.school_year_id=?').get(period.id),
          db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status<>'Resolvido'").get(),
          db.prepare(`SELECT classes.id,
            courses.name AS curso,
            locations.name AS local,
            COUNT(DISTINCT CASE WHEN enrollments.status='ativa' AND students.active=1 THEN students.id END) AS total
            FROM classes
            JOIN courses ON courses.id=classes.course_id
            JOIN locations ON locations.id=classes.location_id
            LEFT JOIN enrollments ON enrollments.class_id=classes.id
            LEFT JOIN students ON students.id=enrollments.student_id
            WHERE classes.active=1 AND classes.school_year_id=?
            GROUP BY classes.id,classes.label,courses.name,locations.name
            ORDER BY total DESC,courses.name,locations.name`).all(period.id),
          recentEnrollmentPage(period.id),
        ]);
        return json(response,200,{
          stats:{totalAlunos:Number(totalAlunos.total||0),cursosAtivos:Number(cursosAtivos.total||0),professores:Number(professores.total||0),ticketsPendentes:Number(ticketsPendentes.total||0),conversasNaoLidas:await supportChatUnread(db,session)},
          alunosPorTurma:alunosPorTurma.map(row=>({...row,id:Number(row.id),total:Number(row.total||0)})),
          ultimasInscricoes:ultimasInscricoes.rows.map(recentEnrollmentView),
          ultimasInscricoesPaginacao:{pagina:ultimasInscricoes.page,temAnterior:ultimasInscricoes.hasPrevious,temProxima:ultimasInscricoes.hasNext},
          fusoHorario:appTimeZone,
        });
      }
      if(request.method==='GET'&&url.pathname==='/api/dashboard/professor'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const totalAlunos=(await db.prepare("SELECT COUNT(DISTINCT enrollments.student_id) AS total FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id JOIN students ON students.id=enrollments.student_id WHERE professor_profiles.user_id=? AND classes.school_year_id=? AND enrollments.status='ativa' AND students.active=1 AND classes.active=1").get(session.user_id,period.id)).total;
        const classRows=await db.prepare(`
          SELECT classes.id,classes.label,courses.name AS curso,locations.name AS local,
            classes.weekday,classes.start_time,
            COUNT(DISTINCT CASE WHEN enrollments.status='ativa' AND students.active=1 THEN students.id END) AS alunos
          FROM classes
          JOIN courses ON courses.id=classes.course_id
          JOIN locations ON locations.id=classes.location_id
          JOIN professor_profiles ON professor_profiles.id=classes.professor_id
          LEFT JOIN enrollments ON enrollments.class_id=classes.id
          LEFT JOIN students ON students.id=enrollments.student_id
          WHERE professor_profiles.user_id=? AND professor_profiles.active=1
            AND classes.active=1 AND classes.school_year_id=?
          GROUP BY classes.id,classes.label,courses.name,locations.name,classes.weekday,classes.start_time
          ORDER BY courses.name,locations.name,classes.id
        `).all(session.user_id,period.id);
        const classes=await attachClassSchedules(db,classRows);
        const timeZone=appTimeZone;
        const conflitosHorario=classScheduleConflicts(classes);
        const conflictingClassIds=new Set(conflitosHorario.flatMap(conflict=>conflict.turmas.map(item=>Number(item.id))));
        const selectedDate = url.searchParams.get('date');
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate || '')) ? selectedDate : '';
        const proximasAulas=(validDate ? classesOnDate(classes,validDate,6) : nextClassSchedules(classes,new Date(),timeZone,6)).map(item=>({...item,conflito:conflictingClassIds.has(Number(item.id))}));
        const proxima=validDate ? proximasAulas[0] || null : nextClassSchedule(classes,new Date(),timeZone);
        const frequency=await db.prepare("SELECT COUNT(attendance_records.id) AS total,COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.school_year_id=?").get(session.user_id,period.id);
        const frequenciaMedia=frequency.total?Math.round(100*frequency.presencas/frequency.total):null;
        const frequencyRows=await db.prepare(`
          SELECT classes.id,classes.label,courses.name AS curso,locations.name AS local,
            COUNT(DISTINCT attendance_sessions.id) AS aulas,
            COUNT(attendance_records.id) AS registros,
            COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas
          FROM classes
          JOIN courses ON courses.id=classes.course_id
          JOIN locations ON locations.id=classes.location_id
          JOIN professor_profiles ON professor_profiles.id=classes.professor_id
          LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id
          LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id
          WHERE professor_profiles.user_id=? AND professor_profiles.active=1
            AND classes.active=1 AND classes.school_year_id=?
          GROUP BY classes.id,classes.label,courses.name,locations.name
          ORDER BY courses.name,locations.name,classes.id
        `).all(session.user_id,period.id);
        const frequenciaPorTurma=frequencyRows.map(row=>({
          id:Number(row.id),label:row.label||'',curso:row.curso,local:row.local,
          aulas:Number(row.aulas||0),registros:Number(row.registros||0),
          frequencia:Number(row.registros||0)?Math.round(100*Number(row.presencas||0)/Number(row.registros)):null,
        }));
        const informativos=(await db.prepare(`SELECT COUNT(*) AS total FROM announcements WHERE active=1 AND ${announcementScheduledCondition('scheduled_at')} AND (
          NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
          OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
            (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
            OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1 AND classes.school_year_id=?))
          ))
        )`).get(session.user_id,session.user_id,period.id)).total;
        const ticketsAbertos=(await db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE requester_user_id=? AND status<>'Resolvido'").get(session.user_id)).total;
        return json(response,200,{
          stats:{totalAlunos:Number(totalAlunos||0),turmasAtivas:classes.length,informativos:Number(informativos||0),ticketsAbertos:Number(ticketsAbertos||0),frequenciaMedia,conflitosHorario:conflitosHorario.length},
          proximaAula:proxima,proximasAulas,frequenciaPorTurma,conflitosHorario,
          periodo:schoolYearView(period),agendaData:validDate||null,
        });
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
