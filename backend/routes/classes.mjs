import { attachClassSchedules } from '../class-schedules.mjs';

import { churchName } from '../../shared/catalog-options.mjs';

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
    notificationService,
  } = context;

  const ensureActiveCatalogItem = async (table, name) => {
    const existing = await db.prepare(`SELECT id,active FROM ${table} WHERE LOWER(name)=LOWER(?)`).get(name);
    if (existing) {
      if (Number(existing.active) !== 1) await db.prepare(`UPDATE ${table} SET name=?,active=1 WHERE id=?`).run(name, existing.id);
      return Number(existing.id);
    }
    await db.prepare(`INSERT INTO ${table} (name,active) VALUES (?,1) ON CONFLICT(name) DO UPDATE SET active=1`).run(name);
    const saved = await db.prepare(`SELECT id FROM ${table} WHERE LOWER(name)=LOWER(?)`).get(name);
    if (!saved) throw new Error(`catalog_item_not_saved:${table}`);
    return Number(saved.id);
  };

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
          const rawName = cleanText(body.nome, 100);
          const name = kind === 'locais' ? churchName(rawName) : rawName;
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
          const rawName = cleanText(body.nome, 100);
          const name = kind === 'locais' ? churchName(rawName) : rawName;
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
        return json(response, 200, { cursos: await attachClassSchedules(db,rows), professores, locais });
      }
    
      if (request.method === 'POST' && url.pathname === '/cursos') {
        const session = await authorize(request, response, ['gestor']); if (!session) return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const body = await readJson(request);
        const courseName = cleanText(body.nome, 100), locationName = churchName(cleanText(body.local, 100)), professorName = cleanText(body.professor, 100);
        if (body.weekday || body.start_time || body.horarios !== undefined) return json(response,403,{message:'Os dias e horários são definidos pelo professor da turma.'});
        const weekday = cleanText(body.weekday, 20), startTime = cleanText(body.start_time, 10),classLabel=cleanText(body.label,100),capacity=body.capacity===''||body.capacity==null?null:Number(body.capacity);
        const errors = {
          nome: catalogNameError(courseName, 'curso'),
          local: catalogNameError(locationName, 'local ou modalidade'),
          professor: professorName ? '' : 'Selecione um professor cadastrado.',
          ...validateClassDetails({ weekday, start_time: startTime,label:classLabel,capacity }),
        };
        if (hasValidationErrors(errors)) return invalid(response, errors);
        const professor = await db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(professorName);
        if (!professor) return json(response, 400, { message: 'Professor não encontrado.' });
        try {
          const classId = await db.transaction(async () => {
            const courseId = await ensureActiveCatalogItem('courses', courseName);
            const locationId = await ensureActiveCatalogItem('locations', locationName);
            const result=await db.prepare('INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label,weekday,start_time,capacity) VALUES (?,?,?,?,?,?,?,?)').run(period.id,courseId,professor.id,locationId,classLabel||`${courseName} — ${locationName}`,weekday||null,startTime||null,capacity);
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_created',ip);
            return Number(result.lastInsertRowid);
          });
          await notificationService.notifyProfessor(professor.id,'courseUpdates','Nova turma atribuída',`A turma ${classLabel||courseName}, em ${locationName}, foi atribuída a você.`,`class-created/${classId}`);
          await notificationService.notifyManagers('courseUpdates','Nova turma cadastrada',`${session.name} cadastrou a turma ${classLabel||courseName}, em ${locationName}.`,`class-created/${classId}`);
          return json(response,201,{id:classId});
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
        if (body.weekday || body.start_time || body.horarios !== undefined) return json(response,403,{message:'Os dias e horários são definidos pelo professor da turma.'});
        const existingClass=await db.prepare(`SELECT classes.id,classes.course_id,classes.label,classes.capacity,courses.name AS course_name,locations.name AS location_name
          FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id
          WHERE classes.id=? AND classes.school_year_id=?`).get(id,period.id);
        if(!existingClass)return json(response,404,{message:'Turma não encontrada.'});
        const requestedCourseName=cleanText(body.nome,100);
        if(requestedCourseName&&requestedCourseName.localeCompare(existingClass.course_name,'pt-BR',{sensitivity:'base'})!==0)return json(response,400,{message:'O curso ofertado não pode ser alterado depois que a turma é criada.'});
        const courseName=existingClass.course_name,locationName=churchName(cleanText(body.local,100)),professorName=cleanText(body.professor,100);
        const weekday = cleanText(body.weekday, 20), startTime = cleanText(body.start_time, 10),classLabel=cleanText(body.label,100),capacity=body.capacity===''||body.capacity==null?null:Number(body.capacity);
        const errors={nome:catalogNameError(courseName,'curso'),local:catalogNameError(locationName,'local ou modalidade'),professor:professorName?'':'Selecione um professor cadastrado.',...validateClassDetails({weekday,start_time:startTime,label:classLabel,capacity})};
        if(hasValidationErrors(errors))return invalid(response,errors);
        const professor=await db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(professorName);
        if(!professor)return json(response,400,{message:'Professor não encontrado.'});
        const generatedPreviousLabel=`${existingClass.course_name} — ${existingClass.location_name}`;
        const nextLabel=body.label===undefined
          ? (existingClass.label===generatedPreviousLabel?`${courseName} — ${locationName}`:existingClass.label)
          : classLabel||`${courseName} — ${locationName}`;
        const nextCapacity=body.capacity===undefined?existingClass.capacity:capacity;
        if(nextCapacity!==null){const occupied=await db.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE class_id=? AND status='ativa'").get(id);if(Number(occupied.total)>nextCapacity)return invalid(response,{capacity:`A capacidade não pode ser menor que os ${occupied.total} aluno(s) já matriculados.`});}
        try{
          await db.transaction(async () => {
            const locationId = await ensureActiveCatalogItem('locations', locationName);
            const result=await db.prepare('UPDATE classes SET professor_id=?,location_id=?,label=?,capacity=? WHERE id=? AND school_year_id=?').run(professor.id,locationId,nextLabel,nextCapacity,id,period.id);
            if(!result.changes)throw new Error('class_update_lost');
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_updated',ip);
          });
        }catch(error){if(duplicateError(error))return json(response,409,{message:'Esta turma já existe.'});throw error;}
        await notificationService.notifyProfessor(professor.id,'courseUpdates','Turma atualizada',`A turma ${nextLabel||courseName}, em ${locationName}, teve seus dados atualizados.`,`class-updated/${id}/${Date.now()}`);
        await notificationService.notifyManagers('courseUpdates','Turma atualizada',`${session.name} atualizou a turma ${nextLabel||courseName}, em ${locationName}.`,`class-updated/${id}/${Date.now()}`);
        return json(response,200,{success:true});
      }
      if(courseMatch&&request.method==='DELETE'){
        const session=await authorize(request,response,['gestor']);if(!session)return;
        const period=await selectedSchoolYear(request,response,{writable:true});if(!period)return;
        const classId=Number(courseMatch[1]);
        const existingClass=await db.prepare('SELECT professor_id,label FROM classes WHERE id=? AND school_year_id=?').get(classId,period.id);
        if(!existingClass)return json(response,404,{message:'Turma não encontrada.'});
        const summary=await db.prepare(`SELECT
          COUNT(DISTINCT enrollments.id) AS matriculas,
          COUNT(DISTINCT attendance_sessions.id) AS chamadas
          FROM classes
          LEFT JOIN enrollments ON enrollments.class_id=classes.id
          LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id
          WHERE classes.id=? AND classes.school_year_id=?`).get(classId,period.id);
        await db.transaction(async()=>{
          await db.prepare('DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions WHERE class_id=?)').run(classId);
          await db.prepare('DELETE FROM attendance_sessions WHERE class_id=?').run(classId);
          await db.prepare('DELETE FROM dropout_events WHERE class_id=?').run(classId);
          await db.prepare('UPDATE enrollments SET transferred_to_class_id=NULL WHERE transferred_to_class_id=?').run(classId);
          await db.prepare('DELETE FROM enrollments WHERE class_id=?').run(classId);
          await db.prepare('DELETE FROM class_schedules WHERE class_id=?').run(classId);
          const result=await db.prepare('DELETE FROM classes WHERE id=? AND school_year_id=?').run(classId,period.id);
          if(!result.changes)throw new Error('class_delete_lost');
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_deleted',ip);
        });
        const className=existingClass.label||`#${classId}`;
        await notificationService.notifyProfessor(existingClass.professor_id,'courseUpdates','Turma excluída',`A turma ${className} foi excluída.`,`class-deleted/${classId}`);
        await notificationService.notifyManagers('courseUpdates','Turma excluída',`${session.name} excluiu a turma ${className}.`,`class-deleted/${classId}`);
        return json(response,200,{
          success:true,
          permanentlyDeleted:true,
          resumo:{matriculas:Number(summary?.matriculas||0),chamadas:Number(summary?.chamadas||0)},
          message:'Turma e todos os vínculos foram excluídos definitivamente.',
        });
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
