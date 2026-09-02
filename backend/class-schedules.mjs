import { CLASS_WEEKDAYS, classSchedules, validateClassSchedules } from '../shared/class-schedules.mjs';

export async function initializeClassSchedules(db) {
  if (db.dialect !== 'sqlite') return;
  if (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='class_schedules'").get()) return;
  await db.transaction(async () => {
    await db.exec(`CREATE TABLE class_schedules (
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      weekday_index INTEGER NOT NULL CHECK(weekday_index BETWEEN 0 AND 6),
      start_minutes INTEGER NOT NULL CHECK(start_minutes BETWEEN 0 AND 1439),
      PRIMARY KEY(class_id,weekday_index,start_minutes)
    )`);
    const classes = await db.prepare('SELECT id,weekday,start_time FROM classes').all();
    for (const course of classes) {
      const slots = classSchedules(course);
      if (!slots.length || validateClassSchedules(slots)) continue;
      const [hours, minutes] = course.start_time.split(':').map(Number);
      await db.prepare('INSERT INTO class_schedules (class_id,weekday_index,start_minutes) VALUES (?,?,?)').run(course.id,CLASS_WEEKDAYS.indexOf(course.weekday),hours*60+minutes);
    }
  });
}

export async function attachClassSchedules(db, classes) {
  if (!classes.length) return [];
  const grouped = new Map();
  // Bound parameter counts and avoid a query per class.
  for (let index = 0; index < classes.length; index += 400) {
    const ids = classes.slice(index,index+400).map(course => course.id);
    const rows = await db.prepare(`SELECT class_id,weekday_index,start_minutes FROM class_schedules WHERE class_id IN (${ids.map(()=>'?').join(',')}) ORDER BY weekday_index,start_minutes`).all(...ids);
    for (const row of rows) {
      const slots = grouped.get(row.class_id) || [];
      slots.push({ weekday: CLASS_WEEKDAYS[row.weekday_index], start_time: String(Math.floor(row.start_minutes/60)).padStart(2,'0') + ':' + String(row.start_minutes%60).padStart(2,'0') });
      grouped.set(row.class_id,slots);
    }
  }
  return classes.map(course => ({ ...course, horarios: grouped.get(course.id) || classSchedules(course) }));
}
