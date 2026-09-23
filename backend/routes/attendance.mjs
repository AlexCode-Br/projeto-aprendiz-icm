import { attachClassSchedules } from '../class-schedules.mjs';

export function createAttendanceRoutes(context) {
  const {
    db,
    json,
    readJson,
    authorize,
    selectedSchoolYear,
    zonedTodayDate,
    isCalendarDate,
  } = context;

  return async function attendanceRoutes(request, response, url, ip) {
      if(request.method==='GET'&&url.pathname==='/professores/meus-cursos'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const rows=await db.prepare(`
          SELECT classes.id,classes.label,classes.weekday,classes.start_time,
            courses.name AS nome,locations.name AS local,
            COUNT(DISTINCT CASE WHEN enrollments.status='ativa' AND students.active=1 THEN students.id END) AS alunos
          FROM classes
          JOIN courses ON courses.id=classes.course_id
          JOIN locations ON locations.id=classes.location_id
          JOIN professor_profiles ON professor_profiles.id=classes.professor_id
          LEFT JOIN enrollments ON enrollments.class_id=classes.id
          LEFT JOIN students ON students.id=enrollments.student_id
          WHERE professor_profiles.user_id=? AND professor_profiles.active=1
            AND classes.active=1 AND classes.school_year_id=?
          GROUP BY classes.id,classes.label,classes.weekday,classes.start_time,courses.name,locations.name
          ORDER BY courses.name,classes.label,locations.name
        `).all(session.user_id,period.id);
        return json(response,200,await attachClassSchedules(db,rows));
      }
    
      if(request.method==='GET'&&url.pathname==='/frequencia'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const classId=Number(url.searchParams.get('curso_id')),date=url.searchParams.get('data');
        const owned=await db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1 AND classes.school_year_id=?`).get(classId,session.user_id,period.id);
        if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
        if(!Number.isSafeInteger(classId)||classId<1||!isCalendarDate(date))return json(response,400,{message:'Informe uma turma e uma data de aula válidas.'});
        const attendanceSession=await db.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(classId,date);
        // Once a call exists, its records are the immutable roster snapshot. Using
        // current enrollments here made students enrolled months later appear in
        // old calls and made those calls impossible to edit consistently.
        const rows=attendanceSession
          ? await db.prepare(`SELECT students.id,students.name AS nome,attendance_records.status
              FROM attendance_records
              JOIN students ON students.id=attendance_records.student_id
              WHERE attendance_records.session_id=?
              ORDER BY students.name`).all(attendanceSession.id)
          : await db.prepare(`SELECT students.id,students.name AS nome,NULL AS status
              FROM enrollments
              JOIN students ON students.id=enrollments.student_id
              WHERE enrollments.class_id=? AND students.active=1
                AND date(enrollments.enrolled_at)<=?
                AND (enrollments.status='ativa' OR (enrollments.completed_at IS NOT NULL AND date(enrollments.completed_at)>=?))
              ORDER BY students.name`).all(classId,date,date);
        return json(response,200,{alunos:rows,registrada:Boolean(attendanceSession)});
      }
    
      if(request.method==='POST'&&url.pathname==='/frequencia'){
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body=await readJson(request),classId=Number(body.curso_id),date=String(body.data_aula||'');
        if(!Number.isSafeInteger(classId)||classId<1||!isCalendarDate(date))return json(response,400,{message:'Selecione uma turma e uma data válidas.'});
        if(date>zonedTodayDate())return json(response,400,{message:'Não é possível registrar uma chamada em uma data futura.'});
        if(!Array.isArray(body.frequencias))return json(response,400,{message:'A lista de frequência é inválida.'});
        const owned=await db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1 AND classes.school_year_id=?`).get(classId,session.user_id,period.id);
        if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
        const existingSession=await db.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(classId,date);
        const rosterRows=existingSession
          ? await db.prepare('SELECT student_id FROM attendance_records WHERE session_id=? ORDER BY student_id').all(existingSession.id)
          : await db.prepare(`SELECT enrollments.student_id FROM enrollments
              JOIN students ON students.id=enrollments.student_id
              WHERE enrollments.class_id=? AND students.active=1
                AND date(enrollments.enrolled_at)<=?
                AND (enrollments.status='ativa' OR (enrollments.completed_at IS NOT NULL AND date(enrollments.completed_at)>=?))
              ORDER BY enrollments.student_id`).all(classId,date,date);
        const enrolled=rosterRows.map(row=>Number(row.student_id));
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
