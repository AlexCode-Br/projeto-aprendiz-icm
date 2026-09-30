const PERSON_NAME = /^[\p{L}]+(?:[\p{L}'’-]*[\p{L}])?(?:\s+[\p{L}]+(?:[\p{L}'’-]*[\p{L}])?)+$/u;
const CATALOG_NAME = /^[\p{L}\p{N}][\p{L}\p{N}\s.'’()&+\-/ºª]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export const SUPPORT_CATEGORIES = ['Acesso ao sistema', 'Alunos', 'Turmas', 'Frequência', 'Cursos', 'Relatórios', 'Outro'];
export const SUPPORT_STATUSES = ['Aberto', 'Em atendimento', 'Resolvido'];

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
  if (!text) return `${label} é ${/^A\s/i.test(label) ? 'obrigatória' : 'obrigatório'}.`;
  if (text.length < min || text.length > max) return `${label} deve ter entre ${min} e ${max} caracteres.`;
  return '';
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
  const selectedClasses = values.turmas ?? values.curso;
  const courses = Array.isArray(selectedClasses) ? selectedClasses : selectedClasses ? [selectedClasses] : [];
  const normalizedCourses = [...new Set(courses.map(course => cleanText(course, 100)).filter(Boolean))];
  if (normalizedCourses.length === 0) errors.curso = 'Selecione pelo menos um curso.';
  if (normalizedCourses.length > 3) errors.curso = 'Selecione no máximo três cursos.';
  if (!cleanText(values.local, 100)) errors.local = 'Selecione uma igreja.';
  if (!['Sim','Não'].includes(values.instrumento)) errors.instrumento = 'Informe se o aluno possui instrumento.';
  if (values.classe === 'Adolescente') {
    const guardianNameMessage = personNameError(values.guardian_name, 'nome do responsável');
    const guardianPhoneMessage = phoneError(values.guardian_phone);
    if (guardianNameMessage) errors.guardian_name = guardianNameMessage;
    if (guardianPhoneMessage) errors.guardian_phone = guardianPhoneMessage;
    if (values.guardian_consent !== true) errors.guardian_consent = 'Confirme a autorização do responsável legal.';
  }
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

export function validateClassDetails(values) {
  const errors = validateClassSchedule(values);
  const label = cleanText(values.label, 100);
  const capacity = values.capacity === '' || values.capacity === null || values.capacity === undefined ? null : Number(values.capacity);
  if (label && catalogNameError(label.replace(/[–—]/g, '-'), 'nome da turma')) errors.label = 'Informe um nome de turma válido.';
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) errors.capacity = 'A capacidade deve ser um número entre 1 e 500.';
  return errors;
}

const STUDENT_CONTACT_OUTCOMES = ['contatado', 'sem_resposta', 'retorno_agendado', 'outro'];

export function validateStudentContact(values) {
  const errors = {};
  const note = cleanText(values.note, 1000);
  if (note.length < 3) errors.note = 'Descreva o contato em pelo menos 3 caracteres.';
  if (!STUDENT_CONTACT_OUTCOMES.includes(values.outcome)) errors.outcome = 'Selecione um resultado válido para o contato.';
  return errors;
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function validateSchoolYear(values) {
  const errors = {};
  const label = cleanText(values.label, 40);
  const startDate = cleanText(values.start_date ?? values.startDate, 10);
  const endDate = cleanText(values.end_date ?? values.endDate, 10);
  if (label.length < 4 || label.length > 40) errors.label = 'Informe um nome de período entre 4 e 40 caracteres.';
  if (!isCalendarDate(startDate)) errors.start_date = 'Informe uma data inicial válida.';
  if (!isCalendarDate(endDate)) errors.end_date = 'Informe uma data final válida.';
  if (!errors.start_date && !errors.end_date && startDate >= endDate) errors.end_date = 'A data final deve ser posterior à data inicial.';
  return errors;
}

export function supportMessageError(value, label = 'A mensagem') {
  return requiredTextError(value, label, 2, 4000);
}

export function supportClientMessageIdError(value) {
  const id = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(id)) return 'Não foi possível identificar este envio. Atualize a página e tente novamente.';
  return '';
}

export function validateSupportTicket(values) {
  const errors = {};
  const subjectError = requiredTextError(values.assunto, 'O assunto', 5, 120);
  const messageError = requiredTextError(values.mensagem, 'A mensagem', 10, 4000);
  if (subjectError) errors.assunto = subjectError;
  if (messageError) errors.mensagem = messageError;
  if (!SUPPORT_CATEGORIES.includes(cleanText(values.categoria, 40))) errors.categoria = 'Selecione uma categoria válida.';
  return errors;
}

export const hasValidationErrors = errors => Object.values(errors).some(Boolean);
