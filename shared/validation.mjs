const PERSON_NAME = /^[\p{L}]+(?:[\p{L}'’-]*[\p{L}])?(?:\s+[\p{L}]+(?:[\p{L}'’-]*[\p{L}])?)+$/u;
const CATALOG_NAME = /^[\p{L}\p{N}][\p{L}\p{N}\s.'’()&+\-/ºª]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export const cleanText = (value, maxLength = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
export const normalizeEmail = value => cleanText(value, 254).toLowerCase();
export const phoneDigits = value => String(value ?? '').replace(/\D/g, '');

export function personNameError(value, label = 'nome') {
  const text = cleanText(value, 100);
  if (!text) return `O ${label} é obrigatório.`;
  if (text.length < 5 || text.length > 100 || !PERSON_NAME.test(text)) return `Informe ${label} e sobrenome, usando apenas letras.`;
  return '';
}

export function emailError(value) {
  const email = normalizeEmail(value);
  if (!email) return 'O e-mail é obrigatório.';
  if (!EMAIL.test(email)) return 'Informe um e-mail válido.';
  return '';
}

export function phoneError(value, required = true) {
  const digits = phoneDigits(value);
  if (!digits) return required ? 'O telefone é obrigatório.' : '';
  if (digits.length < 10 || digits.length > 11) return 'Informe um telefone com DDD válido.';
  if (/^(\d)\1+$/.test(digits)) return 'Informe um telefone válido.';
  return '';
}

export function catalogNameError(value, label = 'nome') {
  const text = cleanText(value, 100);
  if (!text) return `O ${label} é obrigatório.`;
  if (text.length < 2 || text.length > 100 || !CATALOG_NAME.test(text)) return `Informe um ${label} válido (2 a 100 caracteres).`;
  return '';
}

export function requiredTextError(value, label, min = 3, max = 2000) {
  const text = cleanText(value, max + 1);
  if (!text) return `${label} é obrigatório.`;
  if (text.length < min || text.length > max) return `${label} deve ter entre ${min} e ${max} caracteres.`;
  return '';
}

export function httpsUrlError(value) {
  const text = cleanText(value, 2048);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? '' : 'Use um endereço HTTPS válido.';
  } catch {
    return 'Informe uma URL válida.';
  }
}

export function validateProfessor(values) {
  const errors = {};
  const nameMessage = personNameError(values.nome, 'nome completo');
  const emailMessage = emailError(values.contato);
  const phoneMessage = phoneError(values.telefone);
  if (nameMessage) errors.nome = nameMessage;
  if (emailMessage) errors.contato = emailMessage;
  if (phoneMessage) errors.telefone = phoneMessage;
  if (!cleanText(values.local, 100)) errors.local = 'Selecione um local cadastrado.';
  if (!Array.isArray(values.cursos) || values.cursos.length === 0) errors.cursos = 'Selecione pelo menos um curso cadastrado.';
  return errors;
}

export function validateStudent(values) {
  const errors = {};
  const nameMessage = personNameError(values.nome, 'nome completo');
  const emailMessage = emailError(values.contato);
  const phoneMessage = phoneError(values.telefone);
  if (nameMessage) errors.nome = nameMessage;
  if (emailMessage) errors.contato = emailMessage;
  if (phoneMessage) errors.telefone = phoneMessage;
  if (!['Adolescente','Jovem','Senhora','Varão'].includes(values.classe)) errors.classe = 'Selecione uma classe válida.';
  if (!cleanText(values.curso, 100)) errors.curso = 'Selecione um curso.';
  if (!cleanText(values.local, 100)) errors.local = 'Selecione uma igreja.';
  if (!['Sim','Não'].includes(values.instrumento)) errors.instrumento = 'Informe se o aluno possui instrumento.';
  return errors;
}

export function validateClassSchedule(values) {
  const errors = {};
  const weekday = cleanText(values.weekday, 20);
  const startTime = cleanText(values.start_time, 10);
  const weekdays = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  if (weekday && !weekdays.includes(weekday)) errors.weekday = 'Selecione um dia da semana válido.';
  if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) errors.start_time = 'Informe um horário válido.';
  if (weekday && !startTime) errors.start_time = 'Informe o horário da turma.';
  if (!weekday && startTime) errors.weekday = 'Selecione o dia da semana.';
  return errors;
}

export const hasValidationErrors = errors => Object.values(errors).some(Boolean);
