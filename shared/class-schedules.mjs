export const CLASS_WEEKDAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
export const MAX_CLASS_SCHEDULES = 21;

export function validateClassSchedules(value) {
  if (!Array.isArray(value) || value.length > MAX_CLASS_SCHEDULES) return 'Informe até 21 dias e horários de aula.';
  const seen = new Set();
  for (const slot of value) {
    if (!slot || !['semanal','data'].includes(slot.tipo || 'semanal')) return 'Escolha uma recorrência válida.';
    if ((slot.tipo || 'semanal') === 'semanal' && !CLASS_WEEKDAYS.includes(slot.weekday)) return 'Selecione um dia da semana válido em cada horário.';
    if (slot.tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(String(slot.date || ''))) return 'Selecione uma data válida para a aula.';
    if (typeof slot.start_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.start_time)) return 'Preencha todos os horários no formato HH:MM.';
    const key = `${slot.tipo || 'semanal'}/${slot.date || slot.weekday}/${slot.start_time}`;
    if (seen.has(key)) return 'Não repita o mesmo dia e horário.';
    seen.add(key);
  }
  return '';
}

export function sortClassSchedules(slots) {
  return slots.map(({ tipo = 'semanal', weekday = '', date = '', start_time }) => tipo === 'data' ? ({ tipo, date, start_time }) : ({ weekday, start_time }))
    .sort((a, b) => (a.tipo || 'semanal').localeCompare(b.tipo || 'semanal') || (a.date || '').localeCompare(b.date || '') || CLASS_WEEKDAYS.indexOf(a.weekday) - CLASS_WEEKDAYS.indexOf(b.weekday) || a.start_time.localeCompare(b.start_time));
}

export function classSchedules(course) {
  if (Array.isArray(course?.horarios)) return course.horarios;
  return course?.weekday && course?.start_time ? [{ weekday: course.weekday, start_time: course.start_time }] : [];
}

export function scheduleText(slot) {
  return (slot.tipo === 'data' ? new Date(`${slot.date}T12:00:00Z`).toLocaleDateString('pt-BR') : slot.weekday) + ' às ' + slot.start_time;
}

export function classScheduleConflicts(classes) {
  const bySlot = new Map();
  for (const course of classes) {
    for (const slot of classSchedules(course)) {
      const key = `${slot.tipo === 'data' ? slot.date : slot.weekday}/${slot.start_time}`;
      const scheduled = bySlot.get(key) || [];
      scheduled.push({
        id: course.id,
        nome: course.nome || course.curso || course.label || 'Turma',
        local: course.local || '',
      });
      bySlot.set(key, scheduled);
    }
  }
  return [...bySlot.entries()]
    .filter(([, scheduled]) => new Set(scheduled.map(course => String(course.id))).size > 1)
    .map(([key, scheduled]) => {
      const [weekday,start_time] = key.split('/');
      const uniqueClasses = [...new Map(scheduled.map(course => [String(course.id),course])).values()];
      return { weekday, start_time, descricao: scheduleText({ weekday, start_time }), turmas: uniqueClasses };
    })
    .sort((a,b) => CLASS_WEEKDAYS.indexOf(a.weekday) - CLASS_WEEKDAYS.indexOf(b.weekday) || a.start_time.localeCompare(b.start_time));
}

export function nextClassSchedules(classes, now = new Date(), timeZone = 'America/Sao_Paulo', limit = 6) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
  const weekday = (new Date(parts.year + '-' + parts.month + '-' + parts.day + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const currentSeconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  const candidates = classes.flatMap(course => classSchedules(course).map(slot => {
    if (slot.tipo === 'data') {
      const target = new Date(`${slot.date}T${slot.start_time}:00`);
      const offsetSeconds = Math.floor((target.getTime() - now.getTime()) / 1000);
      return { ...course, ...slot, offsetSeconds, descricao: scheduleText(slot) };
    }
    const [hour, minute] = slot.start_time.split(':').map(Number);
    let offset = ((CLASS_WEEKDAYS.indexOf(slot.weekday) - weekday + 7) % 7) * 86400 + hour * 3600 + minute * 60 - currentSeconds;
    if (offset < 0) offset += 7 * 86400;
    return { ...course, ...slot, offsetSeconds: offset, descricao: scheduleText(slot) };
  }));
  return candidates
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds || Number(a.id) - Number(b.id))
    .slice(0, Math.max(0, Number(limit) || 0));
}

export function nextClassSchedule(classes, now = new Date(), timeZone = 'America/Sao_Paulo') {
  return nextClassSchedules(classes, now, timeZone, 1)[0] || null;
}

export function classesOnDate(classes, date, limit = 6) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return [];
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return classes.flatMap(course => classSchedules(course)
    .filter(slot => slot.tipo === 'data' ? slot.date === String(date) : CLASS_WEEKDAYS.indexOf(slot.weekday) === weekday)
    .map(slot => ({ ...course, ...slot, data: String(date), descricao: scheduleText(slot) })))
    .sort((a, b) => a.start_time.localeCompare(b.start_time) || Number(a.id) - Number(b.id))
    .slice(0, Math.max(0, Number(limit) || 0));
}
