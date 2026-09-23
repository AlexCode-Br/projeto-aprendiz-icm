export const COURSE_WALL_CATEGORIES = Object.freeze([
  'Aviso',
  'Material de aula',
  'Alteração de horário',
  'Evento ou ensaio',
  'Atividade',
]);

export const COURSE_WALL_MODES = Object.freeze([
  'post_and_comment',
  'comment_only',
  'teacher_only',
]);

export function normalizeCourseWallMode(value) {
  return COURSE_WALL_MODES.includes(value) ? value : 'post_and_comment';
}

export function courseWallPermissions(role, value) {
  const mode = normalizeCourseWallMode(value);
  if (role === 'professor') return { mode, publicar: true, comentar: true, reagir: true };
  if (role === 'gestor') return { mode, publicar: false, comentar: false, reagir: false };
  return {
    mode,
    publicar: mode === 'post_and_comment',
    comentar: mode !== 'teacher_only',
    reagir: mode !== 'teacher_only',
  };
}
