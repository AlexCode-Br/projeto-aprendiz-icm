export function createDashboardRoutes(context) {
  const {
    db,
    json,
    authorize,
    schoolYearView,
    selectedSchoolYear,
    atRiskStudents,
    pendingAttendanceForProfessor,
    announcementScheduledCondition,
    managerDecisionMetrics,
    pendingAttendance,
  } = context;

  return async function dashboardRoutes(request, response, url) {
      if(request.method==='GET'&&url.pathname==='/api/dashboard/gestor'){
        if(!await authorize(request,response,['gestor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const alunosRisco=await atRiskStudents(period.id);
        const [decisionMetrics,chamadasPendentes]=await Promise.all([managerDecisionMetrics(period),pendingAttendance(period)]);
        const stats={...decisionMetrics,alunosRisco:alunosRisco.length,chamadasPendentes:chamadasPendentes.length};
        const inscricoesPorCurso=await db.prepare("SELECT courses.name AS curso,COUNT(enrollments.id) AS total FROM courses LEFT JOIN classes ON classes.course_id=courses.id AND classes.active=1 AND classes.school_year_id=? LEFT JOIN enrollments ON enrollments.class_id=classes.id AND enrollments.status='ativa' WHERE courses.active=1 GROUP BY courses.id ORDER BY total DESC,courses.name").all(period.id);
        const ultimasInscricoes=await db.prepare("SELECT students.name AS nome,courses.name AS curso,locations.name AS local,enrollments.enrolled_at FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE enrollments.status='ativa' AND classes.school_year_id=? ORDER BY enrollments.enrolled_at DESC,enrollments.id DESC LIMIT 6").all(period.id);
        const baixaFrequencia=(await db.prepare(`SELECT students.id,students.name AS nome,students.email AS contato,students.phone AS telefone,churches.name AS igreja,students.age_group AS classe,students.has_instrument,courses.name AS curso,locations.name AS local,ROUND(100.0*SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END)/NULLIF(COUNT(attendance_records.id),0)) AS frequencia FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN students ON students.id=attendance_records.student_id LEFT JOIN churches ON churches.id=students.church_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE students.active=1 AND classes.school_year_id=? GROUP BY students.id,classes.id,churches.name,courses.name,locations.name HAVING ROUND(100.0*SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END)/NULLIF(COUNT(attendance_records.id),0))<75 ORDER BY frequencia,students.name`).all(period.id)).map(row=>({...row,curso:[row.curso],instrumento:row.has_instrument?'Sim':'Não',status:'Ativo'}));
        return json(response,200,{stats,inscricoesPorCurso,ultimasInscricoes,baixaFrequencia,alunosRisco,chamadasPendentes,periodo:schoolYearView(period)});
      }
      if(request.method==='GET'&&url.pathname==='/api/dashboard/professor'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const totalAlunos=(await db.prepare("SELECT COUNT(DISTINCT enrollments.student_id) AS total FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id JOIN students ON students.id=enrollments.student_id WHERE professor_profiles.user_id=? AND classes.school_year_id=? AND enrollments.status='ativa' AND students.active=1 AND classes.active=1").get(session.user_id,period.id)).total;
        const proxima=await db.prepare('SELECT courses.name AS curso,locations.name AS local,classes.weekday,classes.start_time FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.active=1 AND classes.school_year_id=? ORDER BY classes.id LIMIT 1').get(session.user_id,period.id);
        const frequency=await db.prepare("SELECT COUNT(attendance_records.id) AS total,COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.school_year_id=?").get(session.user_id,period.id);
        const frequenciaMedia=frequency.total?Math.round(100*frequency.presencas/frequency.total):null;
        const informativos=(await db.prepare(`SELECT COUNT(*) AS total FROM announcements WHERE active=1 AND ${announcementScheduledCondition('scheduled_at')} AND (
          NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
          OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
            (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
            OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1))
          ))
        )`).get(session.user_id,session.user_id)).total;
        const ticketsAbertos=(await db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE requester_user_id=? AND status<>'Resolvido'").get(session.user_id)).total;
        const chamadasPendentes=await pendingAttendanceForProfessor(session.user_id,period);
        return json(response,200,{stats:{totalAlunos,informativos,ticketsAbertos,frequenciaMedia,chamadasPendentes:chamadasPendentes.length},chamadasPendentes,proximaAula:proxima?{...proxima,descricao:`${proxima.weekday||'A definir'}, ${proxima.start_time||'horário a definir'}`} : null,periodo:schoolYearView(period)});
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}

