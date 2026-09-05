import { CLASS_WEEKDAYS, sortClassSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';

export function createScheduleRoutes({ db, json, authorize, selectedSchoolYear, readJson, duplicateError }) {
  return async (request, response, url, ip) => {
    const match = url.pathname.match(/^\/api\/professores\/me\/turmas\/(\d+)\/horarios$/);
    if (!match || request.method !== 'PUT') return json(response,404,{message:'Rota não encontrada.'});
    const session = await authorize(request,response,['professor']); if (!session) return;
    const period = await selectedSchoolYear(request,response,{writable:true}); if (!period) return;
    const classId = Number(match[1]);
    if (!Number.isSafeInteger(classId) || classId < 1) return json(response,404,{message:'Turma não encontrada.'});
    const body = await readJson(request) || {};
    const error = validateClassSchedules(body.horarios);
    if (error) return json(response,400,{message:error,errors:{horarios:error}});
    const horarios = sortClassSchedules(body.horarios);
    try {
      const result = await db.transaction(async () => {
        const profile=await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
        if(!profile)return {forbidden:true};
        // Serialize schedule changes for this professor. Without this lock, two
        // simultaneous requests could each validate before the other commits.
        if(db.dialect==='postgres'){
          const locked=await db.prepare('SELECT id FROM professor_profiles WHERE id=? AND active=1 FOR UPDATE').get(profile.id);
          if(!locked)return {forbidden:true};
        }
        const target=await db.prepare('SELECT id FROM classes WHERE id=? AND school_year_id=? AND active=1 AND professor_id=?').get(classId,period.id,profile.id);
        if(!target)return {forbidden:true};

        if(horarios.length){
          const slotConditions=horarios.map(()=>'(class_schedules.weekday_index=? AND class_schedules.start_minutes=?)').join(' OR ');
          const slotParams=horarios.flatMap(slot=>{
            const [hour,minute]=slot.start_time.split(':').map(Number);
            return [CLASS_WEEKDAYS.indexOf(slot.weekday),hour*60+minute];
          });
          const conflict=await db.prepare(`
            SELECT classes.id,
              COALESCE(NULLIF(classes.label,''),courses.name || ' — ' || locations.name) AS turma,
              class_schedules.weekday_index,class_schedules.start_minutes
            FROM class_schedules
            JOIN classes ON classes.id=class_schedules.class_id
            JOIN courses ON courses.id=classes.course_id
            JOIN locations ON locations.id=classes.location_id
            WHERE classes.professor_id=? AND classes.school_year_id=?
              AND classes.active=1 AND classes.id<>? AND (${slotConditions})
            ORDER BY class_schedules.weekday_index,class_schedules.start_minutes,classes.id
            LIMIT 1
          `).get(profile.id,period.id,classId,...slotParams);
          if(conflict){
            const weekday=CLASS_WEEKDAYS[Number(conflict.weekday_index)];
            const startTime=`${String(Math.floor(Number(conflict.start_minutes)/60)).padStart(2,'0')}:${String(Number(conflict.start_minutes)%60).padStart(2,'0')}`;
            return {conflict:`${weekday} às ${startTime} já está ocupado pela turma ${conflict.turma}.`};
          }
        }

        const updated = await db.prepare('UPDATE classes SET weekday=?,start_time=? WHERE id=? AND school_year_id=? AND active=1 AND professor_id=?').run(horarios[0]?.weekday || null,horarios[0]?.start_time || null,classId,period.id,profile.id);
        if (!updated.changes) return {forbidden:true};
        await db.prepare('DELETE FROM class_schedules WHERE class_id=?').run(classId);
        for (const slot of horarios) {
          const [hour,minute] = slot.start_time.split(':').map(Number);
          await db.prepare('INSERT INTO class_schedules (class_id,weekday_index,start_minutes) VALUES (?,?,?)').run(classId,CLASS_WEEKDAYS.indexOf(slot.weekday),hour*60+minute);
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_schedule_updated:'+classId,ip);
        return {saved:true};
      });
      if (result.forbidden) return json(response,403,{message:'Esta turma não está mais disponível para edição.'});
      if (result.conflict) return json(response,409,{message:result.conflict,errors:{horarios:result.conflict}});
      return json(response,200,{horarios});
    } catch (error) {
      if (duplicateError(error)) return json(response,409,{message:'Já existe uma turma com essa identificação e horário. Fale com o gestor.'});
      throw error;
    }
  };
}
