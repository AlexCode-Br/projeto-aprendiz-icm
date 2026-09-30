import { attachClassSchedules } from '../class-schedules.mjs';
import { churchName } from '../../shared/catalog-options.mjs';
import { sortClassSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';
import { findClassScheduleConflict, lockProfessorProfile, replaceClassSchedules } from '../class-schedule-write.mjs';

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
    notificationService,
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

      if (request.method === 'GET' && url.pathname === '/api/professores/me/turmas/opcoes') {
        if (!await authorize(request, response, ['professor'])) return;
        const [courses, locations] = await Promise.all([
          db.prepare('SELECT id,name AS nome FROM courses WHERE active=1 ORDER BY name').all(),
          db.prepare('SELECT id,name AS nome FROM locations WHERE active=1 ORDER BY name').all(),
        ]);
        return json(response, 200, {
          cursos: courses.map(item => ({ id: Number(item.id), nome: item.nome })),
          locais: locations.map(item => ({ id: Number(item.id), nome: churchName(item.nome) })),
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/professores/me/turmas') {
        const session = await authorize(request, response, ['professor']); if (!session) return;
        const period = await selectedSchoolYear(request, response, { writable: true }); if (!period) return;
        const body = await readJson(request) || {};
        const courseId = Number(body.courseId), locationId = Number(body.locationId);
        const scheduleError = validateClassSchedules(body.horarios);
        const horarios = scheduleError ? [] : sortClassSchedules(body.horarios);
        const errors = {
          curso: Number.isSafeInteger(courseId) && courseId > 0 ? '' : 'Selecione um curso cadastrado.',
          local: Number.isSafeInteger(locationId) && locationId > 0 ? '' : 'Selecione uma igreja ou modalidade cadastrada.',
          horarios: scheduleError || (!horarios.length ? 'Cadastre ao menos um dia e horário de aula.' : ''),
        };
        if (hasValidationErrors(errors)) return invalid(response, errors);
        const [profile, course, location] = await Promise.all([
          db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id),
          db.prepare('SELECT id,name FROM courses WHERE id=? AND active=1').get(courseId),
          db.prepare('SELECT id,name FROM locations WHERE id=? AND active=1').get(locationId),
        ]);
        if (!profile) return json(response, 403, { message: 'Seu perfil de professor não está ativo.' });
        if (!course) return invalid(response, { curso: 'O curso selecionado não está disponível.' });
        if (!location) return invalid(response, { local: 'A igreja ou modalidade selecionada não está disponível.' });
        try {
          const created = await db.transaction(async () => {
            if (!await lockProfessorProfile(db, profile.id)) return { forbidden: true };
            const conflict = await findClassScheduleConflict(db, { professorId: profile.id, schoolYearId: period.id, schedules: horarios });
            if (conflict) return { conflict };
            const label = `${course.name} — ${churchName(location.name)}`;
            const firstWeekly = horarios.find(slot => slot.tipo !== 'data');
            const result = await db.prepare('INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label,weekday,start_time,capacity) VALUES (?,?,?,?,?,?,?,NULL)')
              .run(period.id, course.id, profile.id, location.id, label, firstWeekly?.weekday || null, firstWeekly?.start_time || null);
            const classId = Number(result.lastInsertRowid);
            if (!await replaceClassSchedules(db, { classId, schoolYearId: period.id, professorId: profile.id, schedules: horarios })) throw new Error('class_create_lost');
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `class_created_by_professor:${classId}`, ip);
            return { classId, label };
          });
          if (created.forbidden) return json(response, 403, { message: 'Seu perfil de professor não está ativo.' });
          if (created.conflict) return json(response, 409, { message: created.conflict, errors: { horarios: created.conflict } });
          await notificationService.notifyManagers('courseUpdates', 'Nova turma ofertada', `${session.name} criou a turma ${created.label}.`, `class-created/${created.classId}`);
          return json(response, 201, { id: created.classId, message: 'Turma criada. Agora você pode configurar o banner, o mapa e o mural.' });
        } catch (error) {
          if (duplicateError(error)) return json(response, 409, { message: 'Você já possui uma turma com este curso, local e horário.' });
          throw error;
        }
      }

      const professorClassMatch = url.pathname.match(/^\/api\/professores\/me\/turmas\/(\d+)$/);
      if (professorClassMatch && request.method === 'PUT') {
        const session = await authorize(request, response, ['professor']); if (!session) return;
        const period = await selectedSchoolYear(request, response, { writable: true }); if (!period) return;
        const classId = Number(professorClassMatch[1]), body = await readJson(request) || {};
        const courseId = Number(body.courseId), locationId = Number(body.locationId);
        const scheduleError = validateClassSchedules(body.horarios);
        const horarios = scheduleError ? [] : sortClassSchedules(body.horarios);
        const errors = {
          curso: Number.isSafeInteger(courseId) && courseId > 0 ? '' : 'Selecione um curso cadastrado.',
          local: Number.isSafeInteger(locationId) && locationId > 0 ? '' : 'Selecione uma igreja ou modalidade cadastrada.',
          horarios: scheduleError || (!horarios.length ? 'Cadastre ao menos um dia e horário de aula.' : ''),
        };
        if (hasValidationErrors(errors)) return invalid(response, errors);
        const profile = await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
        if (!profile) return json(response, 403, { message: 'Seu perfil de professor não está ativo.' });
        const current = await db.prepare(`SELECT classes.id,classes.course_id,classes.location_id,classes.label,courses.name AS course_name,locations.name AS location_name
          FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id
          WHERE classes.id=? AND classes.school_year_id=? AND classes.professor_id=? AND classes.active=1`).get(classId, period.id, profile.id);
        if (!current) return json(response, 404, { message: 'Turma não encontrada.' });
        if (Number(current.course_id) !== courseId) return json(response, 400, { message: 'O curso ofertado não pode ser alterado depois que a turma é criada.' });
        const location = await db.prepare('SELECT id,name FROM locations WHERE id=? AND active=1').get(locationId);
        if (!location) return invalid(response, { local: 'A igreja ou modalidade selecionada não está disponível.' });
        try {
          const saved = await db.transaction(async () => {
            if (!await lockProfessorProfile(db, profile.id)) return { forbidden: true };
            const target = await db.prepare(`SELECT classes.id FROM classes WHERE classes.id=? AND classes.school_year_id=? AND classes.professor_id=? AND classes.active=1${db.dialect === 'postgres' ? ' FOR UPDATE' : ''}`)
              .get(classId, period.id, profile.id);
            if (!target) return { missing: true };
            const conflict = await findClassScheduleConflict(db, { professorId: profile.id, schoolYearId: period.id, classId, schedules: horarios });
            if (conflict) return { conflict };
            const generatedPreviousLabel = `${current.course_name} — ${churchName(current.location_name)}`;
            const nextLabel = current.label === generatedPreviousLabel ? `${current.course_name} — ${churchName(location.name)}` : current.label;
            await db.prepare('UPDATE classes SET location_id=?,label=? WHERE id=? AND school_year_id=? AND professor_id=? AND active=1')
              .run(location.id, nextLabel, classId, period.id, profile.id);
            if (!await replaceClassSchedules(db, { classId, schoolYearId: period.id, professorId: profile.id, schedules: horarios })) return { missing: true };
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `class_updated_by_professor:${classId}`, ip);
            return { label: nextLabel };
          });
          if (saved.forbidden) return json(response, 403, { message: 'Seu perfil de professor não está ativo.' });
          if (saved.missing) return json(response, 404, { message: 'Turma não encontrada.' });
          if (saved.conflict) return json(response, 409, { message: saved.conflict, errors: { horarios: saved.conflict } });
          await notificationService.notifyManagers('courseUpdates', 'Turma atualizada pelo professor', `${session.name} atualizou a turma ${saved.label}.`, `class-updated/${classId}/${Date.now()}`);
          return json(response, 200, { success: true, message: 'Curso, local e horários salvos.' });
        } catch (error) {
          if (duplicateError(error)) return json(response, 409, { message: 'Você já possui uma turma com este curso, local e horário.' });
          throw error;
        }
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
        return json(response, 403, { message: 'As turmas são criadas pelo professor após a ativação da conta.' });
      }
      const courseMatch=url.pathname.match(/^\/cursos\/(\d+)$/);
      if (courseMatch && request.method==='PUT') {
        const session=await authorize(request,response,['gestor']); if(!session)return;
        return json(response, 403, { message: 'Somente o professor responsável pode configurar sua turma.' });
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
