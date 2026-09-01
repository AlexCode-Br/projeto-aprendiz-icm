export function createClassRoutes(context) {
  const {
    db,
    json,
    readJson,
    authorize,
    cleanText,
    hasValidationErrors,
    invalid,
    duplicateError,
    selectedSchoolYear,
    catalogNameError,
    validateClassDetails,
  } = context;

  return async function classRoutes(request, response, url, ip) {
      const catalogMatch = url.pathname.match(/^\/api\/catalogos\/(cursos|locais)(?:\/(\d+))?$/);
      if (catalogMatch && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const [, kind, idText] = catalogMatch;
        const table = kind === 'cursos' ? 'courses' : 'locations';
        const entity = kind === 'cursos' ? 'curso' : 'igreja';
        const id = idText ? Number(idText) : null;
        if (request.method === 'POST') {
          const body = await readJson(request);
          const name = cleanText(body.nome, 100);
          const errorMessage = catalogNameError(name, entity);
          if (errorMessage) return invalid(response, { nome: errorMessage });
          const existing = await db.prepare(`SELECT id,active FROM ${table} WHERE LOWER(name)=LOWER(?)`).get(name);
          if (existing?.active === 1) return json(response, 409, { message: `Este ${entity} já está cadastrado.` });
          if (existing) {
            await db.prepare(`UPDATE ${table} SET name=?,active=1 WHERE id=?`).run(name, existing.id);
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_reactivated`, ip);
            return json(response, 200, { id: existing.id, message: `${entity[0].toUpperCase()}${entity.slice(1)} reativado com sucesso.` });
          }
          const result = await db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_created`, ip);
          return json(response, 201, { id: Number(result.lastInsertRowid) });
        }
        if (!id) return json(response, 404, { message: 'Cadastro não encontrado.' });
        const current = await db.prepare(`SELECT id,active FROM ${table} WHERE id=?`).get(id);
        if (!current) return json(response, 404, { message: `${entity[0].toUpperCase()}${entity.slice(1)} não encontrado.` });
        if (request.method === 'PUT') {
          const body = await readJson(request);
          const name = cleanText(body.nome, 100);
          const errorMessage = catalogNameError(name, entity);
          if (errorMessage) return invalid(response, { nome: errorMessage });
          try {
            await db.prepare(`UPDATE ${table} SET name=? WHERE id=?`).run(name, id);
          } catch (error) {
            if (duplicateError(error)) return json(response, 409, { message: `Já existe outro ${entity} com este nome.` });
            throw error;
          }
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_updated`, ip);
          return json(response, 200, { success: true });
        }
        const classFilter = kind === 'cursos' ? 'course_id' : 'location_id';
        const historicalLink=await db.prepare(`SELECT classes.id FROM classes JOIN school_years ON school_years.id=classes.school_year_id WHERE classes.${classFilter}=? AND school_years.closed_at IS NOT NULL LIMIT 1`).get(id);
        if(historicalLink)return json(response,409,{message:`Este ${entity} faz parte de um período encerrado e não pode ser excluído. O histórico letivo é imutável.`});
        const summary = await db.prepare(`SELECT
          COUNT(DISTINCT classes.id) AS turmas,
          COUNT(DISTINCT enrollments.id) AS matriculas
          FROM classes
          LEFT JOIN enrollments ON enrollments.class_id=classes.id
          WHERE classes.${classFilter}=?`).get(id);
        await db.transaction(async()=>{
          await db.prepare(`DELETE FROM attendance_records WHERE session_id IN (
            SELECT attendance_sessions.id FROM attendance_sessions
            JOIN classes ON classes.id=attendance_sessions.class_id
            WHERE classes.${classFilter}=?
          )`).run(id);
          await db.prepare(`DELETE FROM attendance_sessions WHERE class_id IN (
            SELECT id FROM classes WHERE ${classFilter}=?
          )`).run(id);
          await db.prepare(`DELETE FROM dropout_events WHERE class_id IN (
            SELECT id FROM classes WHERE ${classFilter}=?
          )`).run(id);
          await db.prepare(`DELETE FROM enrollments WHERE class_id IN (
            SELECT id FROM classes WHERE ${classFilter}=?
          )`).run(id);
          await db.prepare(`DELETE FROM classes WHERE ${classFilter}=?`).run(id);
          if(kind === 'locais')await db.prepare('UPDATE professor_profiles SET home_location_id=NULL WHERE home_location_id=?').run(id);
          await db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_permanently_deleted`, ip);
        });
        return json(response, 200, {
          success: true,
          permanentlyDeleted: true,
          resumo: { turmas: Number(summary?.turmas || 0), matriculas: Number(summary?.matriculas || 0) },
          message: `${entity[0].toUpperCase()}${entity.slice(1)} e todos os vínculos foram excluídos definitivamente.`,
        });
      }
    
      if (request.method === 'GET' && url.pathname === '/cursos') {
        if (!await authorize(request, response, ['gestor'])) return;
        const period=await selectedSchoolYear(request,response);if(!period)return;
        const rows = await db.prepare(`SELECT classes.id,classes.label,classes.capacity,courses.name AS nome,locations.name AS local,professor_profiles.name AS professor,classes.weekday,classes.start_time,CASE classes.active WHEN 1 THEN 'Ativo' ELSE 'Inativo' END AS status,COUNT(CASE WHEN enrollments.status='ativa' AND students.active=1 THEN 1 END) AS alunos FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id LEFT JOIN enrollments ON enrollments.class_id=classes.id LEFT JOIN students ON students.id=enrollments.student_id WHERE classes.school_year_id=? GROUP BY classes.id,courses.name,locations.name,professor_profiles.name,classes.weekday,classes.start_time ORDER BY courses.name,classes.label,locations.name`).all(period.id);
        const professores = (await db.prepare('SELECT name FROM professor_profiles WHERE active=1 ORDER BY name').all()).map(row=>row.name);
        const locais = (await db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all()).map(row=>row.name);
        return json(response, 200, { cursos: rows, professores, locais });
      }
    
      if (request.method === 'POST' && url.pathname === '/cursos') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body = await readJson(request);
        const courseName = cleanText(body.nome, 100), locationName = cleanText(body.local, 100), professorName = cleanText(body.professor, 100);
        const weekday = cleanText(body.weekday, 20), startTime = cleanText(body.start_time, 10),classLabel=cleanText(body.label,100),capacity=body.capacity===''||body.capacity==null?null:Number(body.capacity);
        const errors = {
          nome: catalogNameError(courseName, 'curso'),
          local: locationName ? '' : 'Selecione uma igreja cadastrada.',
          professor: professorName ? '' : 'Selecione um professor cadastrado.',
          ...validateClassDetails({ weekday, start_time: startTime,label:classLabel,capacity }),
        };
        if (hasValidationErrors(errors)) return invalid(response, errors);
        const professor = await db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(professorName);
        if (!professor) return json(response, 400, { message: 'Professor não encontrado.' });
        const course = await db.prepare('SELECT id FROM courses WHERE name=? AND active=1').get(courseName);
        const location = await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
        if (!course || !location) return json(response, 400, { message: 'Selecione somente cursos e locais ativos cadastrados pelo gestor.' });
        try {
          const result=await db.prepare('INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label,weekday,start_time,capacity) VALUES (?,?,?,?,?,?,?,?)').run(period.id,course.id,professor.id,location.id,classLabel||`${courseName} — ${locationName}`,weekday||null,startTime||null,capacity);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_created',ip);
          return json(response,201,{id:Number(result.lastInsertRowid)});
        } catch (error) {
          if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response,409,{message:'Esta turma já existe.'});
          throw error;
        }
      }
      const courseMatch=url.pathname.match(/^\/cursos\/(\d+)$/);
      if (courseMatch && request.method==='PUT') {
        const session=await authorize(request,response,['gestor']); if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const id=Number(courseMatch[1]),body=await readJson(request);
        const courseName=cleanText(body.nome,100),locationName=cleanText(body.local,100),professorName=cleanText(body.professor,100);
        const weekday = cleanText(body.weekday, 20), startTime = cleanText(body.start_time, 10),classLabel=cleanText(body.label,100),capacity=body.capacity===''||body.capacity==null?null:Number(body.capacity);
        const errors={nome:catalogNameError(courseName,'curso'),local:locationName?'':'Selecione uma igreja cadastrada.',professor:professorName?'':'Selecione um professor cadastrado.',...validateClassDetails({weekday,start_time:startTime,label:classLabel,capacity})};
        if(hasValidationErrors(errors))return invalid(response,errors);
        const professor=await db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(professorName);
        if(!professor)return json(response,400,{message:'Professor não encontrado.'});
        const course=await db.prepare('SELECT id FROM courses WHERE name=? AND active=1').get(courseName),location=await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
        if(!course||!location)return json(response,400,{message:'Selecione somente cursos e locais ativos cadastrados pelo gestor.'});
        if(capacity!==null){const occupied=await db.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE class_id=? AND status='ativa'").get(id);if(Number(occupied.total)>capacity)return invalid(response,{capacity:`A capacidade não pode ser menor que os ${occupied.total} aluno(s) já matriculados.`});}
        try{
          const result=await db.prepare('UPDATE classes SET course_id=?,professor_id=?,location_id=?,label=?,weekday=?,start_time=?,capacity=? WHERE id=? AND school_year_id=?').run(course.id,professor.id,location.id,classLabel||`${courseName} — ${locationName}`,weekday||null,startTime||null,capacity,id,period.id);
          if(!result.changes)return json(response,404,{message:'Turma não encontrada.'});
        }catch(error){if(duplicateError(error))return json(response,409,{message:'Esta turma já existe.'});throw error;}
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_updated',ip);
        return json(response,200,{success:true});
      }
      if(courseMatch&&request.method==='DELETE'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        await db.prepare('UPDATE classes SET active=0 WHERE id=? AND school_year_id=?').run(Number(courseMatch[1]),period.id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_deactivated',ip);
        return json(response,200,{success:true});
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
