export function createReportRoutes(context) {
  const {
    db,
    json,
    authorize,
    selectedSchoolYear,
  } = context;

  return async function reportRoutes(request, response, url) {
      if(request.method==='GET'&&url.pathname==='/api/relatorios/opcoes'){
        if(!await authorize(request,response,['gestor','professor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const [courses, locations, professors] = await Promise.all([
          db.prepare('SELECT DISTINCT courses.name FROM courses JOIN classes ON classes.course_id=courses.id WHERE courses.active=1 AND classes.school_year_id=? ORDER BY courses.name').all(period.id),
          db.prepare('SELECT DISTINCT locations.name FROM locations JOIN classes ON classes.location_id=locations.id WHERE locations.active=1 AND classes.school_year_id=? ORDER BY locations.name').all(period.id),
          db.prepare('SELECT DISTINCT professor_profiles.name FROM professor_profiles JOIN classes ON classes.professor_id=professor_profiles.id WHERE professor_profiles.active=1 AND classes.school_year_id=? ORDER BY professor_profiles.name').all(period.id),
        ]);
        return json(response,200,{cursos:courses.map(row=>row.name),locais:locations.map(row=>row.name),professores:professors.map(row=>row.name)});
      }
      if(request.method==='GET'&&url.pathname==='/api/relatorios/frequencia'){
        const session=await authorize(request,response,['gestor','professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const conditions=["enrollments.status='ativa'","students.active=1","classes.active=1","classes.school_year_id=?"],whereParams=[period.id],joinParams=[];
        const filters={curso:url.searchParams.get('curso'),local:url.searchParams.get('local'),professor:url.searchParams.get('professor'),classId:url.searchParams.get('curso_id')};
        if(filters.curso){conditions.push('courses.name=?');whereParams.push(filters.curso)}
        if(filters.local){conditions.push('locations.name=?');whereParams.push(filters.local)}
        if(filters.professor){conditions.push('professor_profiles.name=?');whereParams.push(filters.professor)}
        if(filters.classId){conditions.push('classes.id=?');whereParams.push(Number(filters.classId))}
        if(session.role==='professor'){conditions.push('professor_profiles.user_id=?');whereParams.push(session.user_id)}
        const start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
        let dateJoin='';
        if(start){dateJoin+=' AND attendance_sessions.class_date>=?';joinParams.push(start)}
        if(end){dateJoin+=' AND attendance_sessions.class_date<=?';joinParams.push(end)}
        const sql="SELECT courses.name AS curso,students.name AS aluno,professor_profiles.name AS professor,locations.name AS local,COUNT(DISTINCT attendance_sessions.id) AS aulas,COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id"+dateJoin+" LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id AND attendance_records.student_id=students.id WHERE "+conditions.join(' AND ')+" GROUP BY enrollments.id,courses.name,students.name,professor_profiles.name,locations.name ORDER BY courses.name,students.name";
        const rows=await db.prepare(sql).all(...joinParams,...whereParams);
        return json(response,200,rows.map(row=>({curso:row.curso,aluno:row.aluno,professor:row.professor,local:row.local,frequencia:row.aulas?(Math.round(100*row.presencas/row.aulas)+'%'):'Sem aulas'})));
      }
      if(request.method==='GET'&&url.pathname==='/api/relatorios/evasao'){
        if(!await authorize(request,response,['gestor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const conditions=['classes.school_year_id=?'],params=[period.id],course=url.searchParams.get('curso'),reasonCategory=url.searchParams.get('motivo'),start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
        if(course){conditions.push('courses.name=?');params.push(course)}
        if(reasonCategory){conditions.push('dropout_events.reason_category=?');params.push(reasonCategory)}
        if(start){conditions.push('dropout_events.occurred_at>=?');params.push(start)}
        if(end){conditions.push('dropout_events.occurred_at<=?');params.push(end)}
        const sql="SELECT courses.name AS curso,CASE WHEN students.anonymized_at IS NOT NULL THEN 'Aluno anonimizado' ELSE students.name END AS aluno,enrollments.enrolled_at AS dataInscricao,dropout_events.occurred_at AS dataEvasao,CASE dropout_events.reason_category WHEN 'mudanca' THEN 'Mudança' WHEN 'desinteresse' THEN 'Desinteresse' WHEN 'horario' THEN 'Conflito de horário' WHEN 'saude' THEN 'Saúde' WHEN 'familia' THEN 'Questões familiares' ELSE 'Outro' END AS categoria,dropout_events.reason AS motivo FROM dropout_events JOIN students ON students.id=dropout_events.student_id JOIN classes ON classes.id=dropout_events.class_id JOIN courses ON courses.id=classes.course_id LEFT JOIN enrollments ON enrollments.student_id=students.id AND enrollments.class_id=classes.id WHERE "+conditions.join(' AND ')+" ORDER BY dropout_events.occurred_at DESC";
        return json(response,200,await db.prepare(sql).all(...params));
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
