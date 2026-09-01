export function createAttendanceRoutes(context) {
  const {
    db,
    json,
    readJson,
    authorize,
    selectedSchoolYear,
    pendingAttendanceForProfessor,
    zonedTodayDate,
  } = context;

  return async function attendanceRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/professores/meus-cursos'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const rows=await db.prepare(`SELECT classes.id,classes.label,classes.weekday,classes.start_time,courses.name AS nome,locations.name AS local FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.active=1 AND classes.school_year_id=? ORDER BY courses.name,classes.label,locations.name`).all(session.user_id,period.id);
        return json(response,200,rows);
      }
    
      if(request.method==='GET'&&url.pathname==='/frequencia'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const classId=Number(url.searchParams.get('curso_id')),date=url.searchParams.get('data');
        const owned=await db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1 AND classes.school_year_id=?`).get(classId,session.user_id,period.id);
        if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
        if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))return json(response,400,{message:'Informe uma data de aula válida.'});
        const attendanceSession=await db.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(classId,date);
        const rows=await db.prepare(`SELECT students.id,students.name AS nome,attendance_records.status AS status FROM students JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa' LEFT JOIN attendance_sessions ON attendance_sessions.class_id=enrollments.class_id AND attendance_sessions.class_date=? LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id AND attendance_records.student_id=students.id WHERE enrollments.class_id=? AND students.active=1 ORDER BY students.name`).all(date,classId);
        return json(response,200,{alunos:rows,registrada:Boolean(attendanceSession)});
      }
    
      if(request.method==='GET'&&url.pathname==='/api/frequencia/pendentes'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const items=await pendingAttendanceForProfessor(session.user_id,period);
        return json(response,200,{total:items.length,items});
      }
    
      if(request.method==='POST'&&url.pathname==='/frequencia'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body=await readJson(request),classId=Number(body.curso_id),date=String(body.data_aula||'');
        if(!Number.isInteger(classId)||classId<1||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))return json(response,400,{message:'Selecione uma turma e uma data válidas.'});
        if(date>zonedTodayDate())return json(response,400,{message:'Não é possível registrar uma chamada em uma data futura.'});
        if(!Array.isArray(body.frequencias))return json(response,400,{message:'A lista de frequência é inválida.'});
        const owned=await db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1 AND classes.school_year_id=?`).get(classId,session.user_id,period.id);
        if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
        const enrolled=(await db.prepare("SELECT student_id FROM enrollments WHERE class_id=? AND status='ativa'").all(classId)).map(row=>row.student_id);
        const allowed=new Set(enrolled);
        const submitted=new Map();
        for(const item of body.frequencias){
          const studentId=Number(item.aluno_id),status=String(item.status);
          if(!allowed.has(studentId)||submitted.has(studentId)||!['presente','ausente','justificado'].includes(status))return json(response,400,{message:'A chamada contém alunos ou estados inválidos.'});
          submitted.set(studentId,status);
        }
        if(submitted.size!==allowed.size)return json(response,400,{message:'A chamada precisa incluir todos os alunos ativos da turma.'});
        await db.transaction(async()=>{
          await db.prepare(`INSERT INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?) ON CONFLICT(class_id,class_date) DO UPDATE SET recorded_by=excluded.recorded_by,updated_at=CURRENT_TIMESTAMP`).run(classId,date,session.user_id);
          const attendanceSession=await db.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(classId,date);
          for(const [studentId,status] of submitted)await db.prepare(`INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status`).run(attendanceSession.id,studentId,status);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'attendance_saved',ip);
        });
        return json(response,200,{success:true});
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}

