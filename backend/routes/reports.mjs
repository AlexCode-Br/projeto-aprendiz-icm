import { attachClassSchedules } from '../class-schedules.mjs';

const normalizeLocationName = value => ['remoto'].includes(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) ? 'EAD' : value;

export function createReportRoutes(context) {
  const {
    db,
    json,
    authorize,
    selectedSchoolYear,
    isCalendarDate,
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
        const session=await authorize(request,response,['professor']);if(!session)return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const conditions=["classes.active=1","classes.school_year_id=?"],whereParams=[period.id],joinParams=[];
        const filters={curso:url.searchParams.get('curso'),local:url.searchParams.get('local'),professor:url.searchParams.get('professor'),classId:url.searchParams.get('curso_id')};
        if(filters.classId&&(!/^\d+$/.test(filters.classId)||!Number.isSafeInteger(Number(filters.classId))||Number(filters.classId)<1))return json(response,400,{message:'Selecione uma turma válida.'});
        if(filters.curso){conditions.push('courses.name=?');whereParams.push(filters.curso)}
        if(filters.local){conditions.push('locations.name=?');whereParams.push(filters.local)}
        if(filters.professor){conditions.push('professor_profiles.name=?');whereParams.push(filters.professor)}
        if(filters.classId){conditions.push('classes.id=?');whereParams.push(Number(filters.classId))}
        conditions.push('professor_profiles.user_id=?');whereParams.push(session.user_id);
        const start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
        if((start&&!isCalendarDate(start))||(end&&!isCalendarDate(end))||(start&&end&&start>end))return json(response,400,{message:'Informe um intervalo de datas válido.'});
        let dateJoin='';
        if(start){dateJoin+=' AND attendance_sessions.class_date>=?';joinParams.push(start)}
        if(end){dateJoin+=' AND attendance_sessions.class_date<=?';joinParams.push(end)}
        if(url.searchParams.get('detalhado')==='1'){
          const classConditions=['classes.active=1','classes.school_year_id=?','professor_profiles.user_id=?'];
          const classParams=[period.id,session.user_id];
          if(filters.curso){classConditions.push('courses.name=?');classParams.push(filters.curso)}
          if(filters.local){classConditions.push('locations.name=?');classParams.push(filters.local)}
          if(filters.professor){classConditions.push('professor_profiles.name=?');classParams.push(filters.professor)}
          if(filters.classId){classConditions.push('classes.id=?');classParams.push(Number(filters.classId))}

          const professor=await db.prepare('SELECT name,email FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
          const rawClasses=await db.prepare(`
            SELECT classes.id,classes.label,classes.weekday,classes.start_time,
              courses.name AS curso,locations.name AS local
            FROM classes
            JOIN courses ON courses.id=classes.course_id
            JOIN locations ON locations.id=classes.location_id
            JOIN professor_profiles ON professor_profiles.id=classes.professor_id
            WHERE ${classConditions.join(' AND ')}
            ORDER BY courses.name,classes.label,locations.name
          `).all(...classParams);
          const classRows=await attachClassSchedules(db,rawClasses);
          const classIds=classRows.map(row=>Number(row.id));
          let studentRows=[],callRows=[],recordRows=[];
          if(classIds.length){
            const placeholders=classIds.map(()=>'?').join(',');
            studentRows=await db.prepare(`
              SELECT classes.id AS class_id,students.id AS student_id,students.name AS aluno,
                COUNT(DISTINCT attendance_sessions.id) AS chamadas,
                COUNT(attendance_records.id) AS registros,
                COALESCE(SUM(CASE WHEN attendance_records.status='presente' THEN 1 ELSE 0 END),0) AS presentes,
                COALESCE(SUM(CASE WHEN attendance_records.status='ausente' THEN 1 ELSE 0 END),0) AS ausentes,
                COALESCE(SUM(CASE WHEN attendance_records.status='justificado' THEN 1 ELSE 0 END),0) AS justificados
              FROM attendance_records
              JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id${dateJoin}
              JOIN students ON students.id=attendance_records.student_id
              JOIN classes ON classes.id=attendance_sessions.class_id
              WHERE classes.id IN (${placeholders})
              GROUP BY classes.id,students.id,students.name
              ORDER BY classes.id,students.name
            `).all(...joinParams,...classIds);
            const callDateConditions=[];
            const callDateParams=[];
            if(start){callDateConditions.push('attendance_sessions.class_date>=?');callDateParams.push(start)}
            if(end){callDateConditions.push('attendance_sessions.class_date<=?');callDateParams.push(end)}
            callRows=await db.prepare(`
              SELECT attendance_sessions.id,attendance_sessions.class_id,attendance_sessions.class_date AS data,
                COUNT(attendance_records.id) AS registros,
                COALESCE(SUM(CASE WHEN attendance_records.status='presente' THEN 1 ELSE 0 END),0) AS presentes,
                COALESCE(SUM(CASE WHEN attendance_records.status='ausente' THEN 1 ELSE 0 END),0) AS ausentes,
                COALESCE(SUM(CASE WHEN attendance_records.status='justificado' THEN 1 ELSE 0 END),0) AS justificados
              FROM attendance_sessions
              LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id
              WHERE attendance_sessions.class_id IN (${placeholders})${callDateConditions.length?` AND ${callDateConditions.join(' AND ')}`:''}
              GROUP BY attendance_sessions.id,attendance_sessions.class_id,attendance_sessions.class_date
              ORDER BY attendance_sessions.class_date DESC,attendance_sessions.id DESC
            `).all(...classIds,...callDateParams);
            recordRows=await db.prepare(`
              SELECT attendance_sessions.id AS session_id,attendance_sessions.class_id,
                attendance_sessions.class_date AS data,attendance_records.student_id,attendance_records.status
              FROM attendance_sessions
              JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id
              WHERE attendance_sessions.class_id IN (${placeholders})${callDateConditions.length?` AND ${callDateConditions.join(' AND ')}`:''}
              ORDER BY attendance_sessions.class_date,attendance_sessions.id,attendance_records.student_id
            `).all(...classIds,...callDateParams);
          }

          const studentsByClass=new Map(),callsByClass=new Map(),recordsBySessionAndStudent=new Map();
          for(const row of studentRows){
            const registros=Number(row.registros)||0,chamadas=Number(row.chamadas)||0,presentes=Number(row.presentes)||0,justificados=Number(row.justificados)||0;
            const item={
              id:Number(row.student_id),nome:row.aluno,chamadas,registros,presentes,
              ausentes:Number(row.ausentes)||0,justificados,
              naoRegistrados:Math.max(0,chamadas-registros),
              frequencia:registros?Math.round(100*(presentes+justificados)/registros):null,
            };
            const list=studentsByClass.get(Number(row.class_id))||[];list.push(item);studentsByClass.set(Number(row.class_id),list);
          }
          for(const row of callRows){
            const item={id:Number(row.id),data:row.data,registros:Number(row.registros)||0,presentes:Number(row.presentes)||0,ausentes:Number(row.ausentes)||0,justificados:Number(row.justificados)||0};
            const list=callsByClass.get(Number(row.class_id))||[];list.push(item);callsByClass.set(Number(row.class_id),list);
          }
          for(const row of recordRows)recordsBySessionAndStudent.set(`${Number(row.session_id)}:${Number(row.student_id)}`,row.status);
          const reportClasses=classRows.map(row=>{
            const chamadas=callsByClass.get(Number(row.id))||[];
            const alunos=(studentsByClass.get(Number(row.id))||[]).map(student=>({
              ...student,
              frequencias:chamadas.map(call=>({chamadaId:call.id,data:call.data,status:recordsBySessionAndStudent.get(`${call.id}:${student.id}`)||'nao_registrado'})),
            }));
            const registros=alunos.reduce((total,item)=>total+item.registros,0),presentes=alunos.reduce((total,item)=>total+item.presentes,0),justificados=alunos.reduce((total,item)=>total+item.justificados,0);
            return {
              id:Number(row.id),curso:row.curso,turma:row.label||'',local:normalizeLocationName(row.local),horarios:row.horarios||[],
              resumo:{alunos:alunos.length,chamadas:chamadas.length,registros,presentes,ausentes:alunos.reduce((total,item)=>total+item.ausentes,0),justificados,frequencia:registros?Math.round(100*(presentes+justificados)/registros):null},
              alunos,chamadas,
            };
          });
          const allStudents=new Set(studentRows.map(row=>Number(row.student_id)));
          const reportRecords=reportClasses.reduce((total,item)=>total+item.resumo.registros,0);
          const reportPresent=reportClasses.reduce((total,item)=>total+item.resumo.presentes,0);
          const reportJustified=reportClasses.reduce((total,item)=>total+item.resumo.justificados,0);
          return json(response,200,{
            metadata:{
              professor:{nome:professor?.name||'Professor',email:professor?.email||''},
              periodoLetivo:{nome:period.label,inicio:String(period.start_date||'').slice(0,10),fim:String(period.end_date||'').slice(0,10)},
              filtros:{dataInicio:start||'',dataFim:end||'',turmaId:filters.classId?Number(filters.classId):null},
              geradoEm:new Date().toISOString(),
            },
            resumo:{turmas:reportClasses.length,alunos:allStudents.size,chamadas:callRows.length,registros:reportRecords,presentes:reportPresent,ausentes:reportClasses.reduce((total,item)=>total+item.resumo.ausentes,0),justificados:reportJustified,frequencia:reportRecords?Math.round(100*(reportPresent+reportJustified)/reportRecords):null},
            turmas:reportClasses,
          });
        }
        const sql="SELECT courses.name AS curso,students.name AS aluno,professor_profiles.name AS professor,locations.name AS local,COUNT(DISTINCT attendance_sessions.id) AS aulas,COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id"+dateJoin+" JOIN students ON students.id=attendance_records.student_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE "+conditions.join(' AND ')+" GROUP BY classes.id,students.id,courses.name,students.name,professor_profiles.name,locations.name ORDER BY courses.name,students.name";
        const rows=await db.prepare(sql).all(...joinParams,...whereParams);
        return json(response,200,rows.map(row=>({curso:row.curso,aluno:row.aluno,professor:row.professor,local:row.local,frequencia:row.aulas?(Math.round(100*row.presencas/row.aulas)+'%'):'Sem aulas'})));
      }
      if(request.method==='GET'&&url.pathname==='/api/relatorios/evasao'){
        if(!await authorize(request,response,['gestor']))return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const conditions=['classes.school_year_id=?'],params=[period.id],course=url.searchParams.get('curso'),reasonCategory=url.searchParams.get('motivo'),start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
        if((start&&!isCalendarDate(start))||(end&&!isCalendarDate(end))||(start&&end&&start>end))return json(response,400,{message:'Informe um intervalo de datas válido.'});
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
