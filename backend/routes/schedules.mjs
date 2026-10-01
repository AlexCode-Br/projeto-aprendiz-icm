import { sortClassSchedules, validateClassSchedules } from '../../shared/class-schedules.mjs';
import { findClassScheduleConflict, lockProfessorProfile, replaceClassSchedules } from '../class-schedule-write.mjs';

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
        if(!await lockProfessorProfile(db,profile.id))return {forbidden:true};
        const target=await db.prepare('SELECT id FROM classes WHERE id=? AND school_year_id=? AND active=1 AND professor_id=?').get(classId,period.id,profile.id);
        if(!target)return {forbidden:true};

        const conflict=await findClassScheduleConflict(db,{professorId:profile.id,schoolYearId:period.id,classId,schedules:horarios});
        if(conflict)return {conflict};
        if(!await replaceClassSchedules(db,{classId,schoolYearId:period.id,professorId:profile.id,schedules:horarios}))return {forbidden:true};
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
