import { CLASS_WEEKDAYS, sortClassSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';

export function createScheduleRoutes({ db, json, authorize, selectedSchoolYear, readJson, duplicateError }) {
  return async (request, response, url, ip) => {
    const match = url.pathname.match(/^\/api\/professores\/me\/turmas\/(\d+)\/horarios$/);
    if (!match || request.method !== 'PUT') return json(response,404,{message:'Rota não encontrada.'});
    const session = await authorize(request,response,['professor']); if (!session) return;
    const period = await selectedSchoolYear(request,response,{writable:true}); if (!period) return;
    const classId = Number(match[1]);
    if (!Number.isSafeInteger(classId) || classId < 1) return json(response,404,{message:'Turma não encontrada.'});
    const ownership = `id=? AND school_year_id=? AND active=1 AND professor_id IN (SELECT id FROM professor_profiles WHERE user_id=? AND active=1)`;
    if (!await db.prepare(`SELECT id FROM classes WHERE ${ownership}`).get(classId,period.id,session.user_id)) return json(response,403,{message:'Você só pode editar horários das suas turmas ativas.'});
    const body = await readJson(request) || {};
    const error = validateClassSchedules(body.horarios);
    if (error) return json(response,400,{message:error,errors:{horarios:error}});
    const horarios = sortClassSchedules(body.horarios);
    try {
      const saved = await db.transaction(async () => {
        // Lock the owned class before replacing its slots, including the legacy projection.
        const updated = await db.prepare(`UPDATE classes SET weekday=?,start_time=? WHERE ${ownership}`).run(horarios[0]?.weekday || null,horarios[0]?.start_time || null,classId,period.id,session.user_id);
        if (!updated.changes) return false;
        await db.prepare('DELETE FROM class_schedules WHERE class_id=?').run(classId);
        for (const slot of horarios) {
          const [hour,minute] = slot.start_time.split(':').map(Number);
          await db.prepare('INSERT INTO class_schedules (class_id,weekday_index,start_minutes) VALUES (?,?,?)').run(classId,CLASS_WEEKDAYS.indexOf(slot.weekday),hour*60+minute);
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_schedule_updated:'+classId,ip);
        return true;
      });
      if (!saved) return json(response,403,{message:'Esta turma não está mais disponível para edição.'});
      return json(response,200,{horarios});
    } catch (error) {
      if (duplicateError(error)) return json(response,409,{message:'Já existe uma turma com essa identificação e horário. Fale com o gestor.'});
      throw error;
    }
  };
}
