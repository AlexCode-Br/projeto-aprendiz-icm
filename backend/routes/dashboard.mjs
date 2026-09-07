import { attachClassSchedules } from '../class-schedules.mjs';
import { classScheduleConflicts, nextClassSchedule, nextClassSchedules } from '../../shared/class-schedules.mjs';

export function createDashboardRoutes(context) {
  const {
    db,
    json,
    authorize,
    schoolYearView,
    selectedSchoolYear,
    announcementScheduledCondition,
    appTimeZone = 'America/Sao_Paulo',
  } = context;

  return async function dashboardRoutes(request, response, url) {
      if(request.method==='GET'&&url.pathname==='/api/dashboard/gestor'){
        if(!await authorize(request,response,['gestor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const [totalAlunos,cursosAtivos,professores,ticketsPendentes,alunosPorTurma,ultimasInscricoes]=await Promise.all([
          db.prepare("SELECT COUNT(DISTINCT students.id) AS total FROM students JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa' JOIN classes ON classes.id=enrollments.class_id AND classes.active=1 WHERE students.active=1 AND classes.school_year_id=?").get(period.id),
          db.prepare('SELECT COUNT(*) AS total FROM classes WHERE active=1 AND school_year_id=?').get(period.id),
          db.prepare('SELECT COUNT(DISTINCT professor_profiles.id) AS total FROM professor_profiles JOIN classes ON classes.professor_id=professor_profiles.id WHERE professor_profiles.active=1 AND classes.active=1 AND classes.school_year_id=?').get(period.id),
          db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status<>'Resolvido'").get(),
          db.prepare(`SELECT classes.id,
            COALESCE(NULLIF(classes.label,''),courses.name || ' — ' || locations.name) AS curso,
            COUNT(DISTINCT CASE WHEN enrollments.status='ativa' AND students.active=1 THEN students.id END) AS total
            FROM classes
            JOIN courses ON courses.id=classes.course_id
            JOIN locations ON locations.id=classes.location_id
            LEFT JOIN enrollments ON enrollments.class_id=classes.id
            LEFT JOIN students ON students.id=enrollments.student_id
            WHERE classes.active=1 AND classes.school_year_id=?
            GROUP BY classes.id,classes.label,courses.name,locations.name
            ORDER BY total DESC,courses.name,locations.name`).all(period.id),
          db.prepare("SELECT students.id,students.name AS nome,courses.name AS curso,locations.name AS local,enrollments.enrolled_at FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE enrollments.status='ativa' AND students.active=1 AND classes.active=1 AND classes.school_year_id=? ORDER BY enrollments.enrolled_at DESC,enrollments.id DESC LIMIT 6").all(period.id),
        ]);
        return json(response,200,{
          stats:{totalAlunos:Number(totalAlunos.total||0),cursosAtivos:Number(cursosAtivos.total||0),professores:Number(professores.total||0),ticketsPendentes:Number(ticketsPendentes.total||0)},
          alunosPorTurma:alunosPorTurma.map(row=>({...row,id:Number(row.id),total:Number(row.total||0)})),
          ultimasInscricoes,
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
        const proximasAulas=nextClassSchedules(classes,new Date(),timeZone,6).map(item=>({...item,conflito:conflictingClassIds.has(Number(item.id))}));
        const proxima=nextClassSchedule(classes,new Date(),timeZone);
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
          periodo:schoolYearView(period),
        });
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
