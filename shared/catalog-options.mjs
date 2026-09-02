// Permanent registration suggestions, independent of demo accounts and database seeds.
export const COURSE_SUGGESTIONS = Object.freeze([
  'Bateria', 'Canto Coral', 'Contrabaixo', 'Flauta Transversal', 'Saxofone',
  'Teclado', 'Teoria Musical', 'Violino', 'Violão I', 'Violão II',
]);
export const CHURCH_SUGGESTIONS = Object.freeze([
  'Alto de Coutos', 'Boca do Rio', 'Brotas', 'Guarani', 'Lauro de Freitas', 'Pituba', 'Remoto',
]);

export const catalogKey = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

export function catalogSuggestions(type, existing = []) {
  const registered = new Set(existing.map(item => catalogKey(item.nome)));
  return (type === 'cursos' ? COURSE_SUGGESTIONS : CHURCH_SUGGESTIONS).map(name => ({
    value: name, label: name, isDisabled: registered.has(catalogKey(name)),
  }));
}

export function courseIconKind(name) {
  const key = catalogKey(name);
  if (/\b(bateria|percussao)\b/.test(key)) return 'drums';
  if (/\b(contrabaixo|baixo)\b/.test(key)) return 'bass';
  if (/\b(violao|guitarra|ukulele|cavaquinho)\b/.test(key)) return 'guitar';
  if (/\b(violino|viola|violoncelo)\b/.test(key)) return 'violin';
  if (/\b(flauta|flautim)\b/.test(key)) return 'flute';
  if (/\b(saxofone|sax)\b/.test(key)) return 'saxophone';
  if (/\b(teclado|piano|orgao)\b/.test(key)) return 'piano';
  if (/\b(canto|coral|voz|vocal)\b/.test(key)) return 'choir';
  if (/\b(teoria|solfejo|musicalizacao|partitura)\b/.test(key)) return 'theory';
  if (/\b(gaita|harmonica)\b/.test(key)) return 'harmonica';
  return 'music';
}
