import { CLASS_WEEKDAYS, scheduleText } from '../shared/class-schedules.mjs';

const startMinutes = value => {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
};

export async function lockProfessorProfile(db, professorId) {
  if (db.dialect !== 'postgres') return true;
  return Boolean(await db.prepare('SELECT id FROM professor_profiles WHERE id=? AND active=1 FOR UPDATE').get(professorId));
}

export async function findClassScheduleConflict(db, { professorId, schoolYearId, classId = 0, schedules }) {
  const weekly = schedules.filter(slot => slot.tipo !== 'data');
  if (weekly.length) {
    const conditions = weekly.map(() => '(class_schedules.weekday_index=? AND class_schedules.start_minutes=?)').join(' OR ');
    const params = weekly.flatMap(slot => [CLASS_WEEKDAYS.indexOf(slot.weekday), startMinutes(slot.start_time)]);
    const conflict = await db.prepare(`
      SELECT COALESCE(NULLIF(classes.label,''),courses.name || ' — ' || locations.name) AS turma,
        class_schedules.weekday_index,class_schedules.start_minutes
      FROM class_schedules
      JOIN classes ON classes.id=class_schedules.class_id
      JOIN courses ON courses.id=classes.course_id
      JOIN locations ON locations.id=classes.location_id
      WHERE classes.professor_id=? AND classes.school_year_id=?
        AND classes.active=1 AND classes.id<>? AND (${conditions})
      ORDER BY class_schedules.weekday_index,class_schedules.start_minutes,classes.id
      LIMIT 1
    `).get(professorId, schoolYearId, classId, ...params);
    if (conflict) {
      const weekday = CLASS_WEEKDAYS[Number(conflict.weekday_index)];
      const start_time = `${String(Math.floor(Number(conflict.start_minutes) / 60)).padStart(2, '0')}:${String(Number(conflict.start_minutes) % 60).padStart(2, '0')}`;
      return `${scheduleText({ weekday, start_time })} já está ocupado pela turma ${conflict.turma}.`;
    }
  }

  const dated = schedules.filter(slot => slot.tipo === 'data');
  if (dated.length) {
    const conditions = dated.map(() => '(class_schedule_dates.class_date=? AND class_schedule_dates.start_minutes=?)').join(' OR ');
    const params = dated.flatMap(slot => [slot.date, startMinutes(slot.start_time)]);
    const conflict = await db.prepare(`
      SELECT COALESCE(NULLIF(classes.label,''),courses.name || ' — ' || locations.name) AS turma,
        class_schedule_dates.class_date,class_schedule_dates.start_minutes
      FROM class_schedule_dates
      JOIN classes ON classes.id=class_schedule_dates.class_id
      JOIN courses ON courses.id=classes.course_id
      JOIN locations ON locations.id=classes.location_id
      WHERE classes.professor_id=? AND classes.school_year_id=?
        AND classes.active=1 AND classes.id<>? AND (${conditions})
      ORDER BY class_schedule_dates.class_date,class_schedule_dates.start_minutes,classes.id
      LIMIT 1
    `).get(professorId, schoolYearId, classId, ...params);
    if (conflict) {
      const start_time = `${String(Math.floor(Number(conflict.start_minutes) / 60)).padStart(2, '0')}:${String(Number(conflict.start_minutes) % 60).padStart(2, '0')}`;
      return `${scheduleText({ tipo: 'data', date: String(conflict.class_date).slice(0, 10), start_time })} já está ocupado pela turma ${conflict.turma}.`;
    }
  }
  return '';
}

export async function replaceClassSchedules(db, { classId, schoolYearId, professorId, schedules }) {
  const firstWeekly = schedules.find(slot => slot.tipo !== 'data');
  const updated = await db.prepare('UPDATE classes SET weekday=?,start_time=? WHERE id=? AND school_year_id=? AND active=1 AND professor_id=?')
    .run(firstWeekly?.weekday || null, firstWeekly?.start_time || null, classId, schoolYearId, professorId);
  if (!updated.changes) return false;
  await db.prepare('DELETE FROM class_schedules WHERE class_id=?').run(classId);
  await db.prepare('DELETE FROM class_schedule_dates WHERE class_id=?').run(classId);
  for (const slot of schedules.filter(item => item.tipo !== 'data')) {
    await db.prepare('INSERT INTO class_schedules (class_id,weekday_index,start_minutes) VALUES (?,?,?)')
      .run(classId, CLASS_WEEKDAYS.indexOf(slot.weekday), startMinutes(slot.start_time));
  }
  for (const slot of schedules.filter(item => item.tipo === 'data')) {
    await db.prepare('INSERT INTO class_schedule_dates (class_id,class_date,start_minutes) VALUES (?,?,?)')
      .run(classId, slot.date, startMinutes(slot.start_time));
  }
  return true;
}
