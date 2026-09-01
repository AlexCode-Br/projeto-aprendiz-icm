import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogNameError,
  emailError,
  personNameError,
  phoneError,
  validateProfessor,
  validateStudent,
  validateClassSchedule,
  validateClassDetails,
  validateSchoolYear,
  validateSupportTicket,
  supportClientMessageIdError,
  supportMessageError,
} from '../shared/validation.mjs';

test('valida dados pessoais e rejeita conteúdo arbitrário', () => {
  assert.match(personNameError('Teste', 'nome completo'), /sobrenome/);
  assert.match(personNameError('123 456', 'nome completo'), /letras/);
  assert.equal(personNameError('Alexandre Silva', 'nome completo'), '');
  assert.notEqual(emailError('qualquer coisa'), '');
  assert.equal(emailError('professor@exemplo.com.br'), '');
  assert.notEqual(phoneError('adwadawdawdwa'), '');
  assert.notEqual(phoneError('11111111111'), '');
  assert.equal(phoneError('(71) 99999-1234'), '');
});

test('valida catálogos e o cadastro completo do professor', () => {
  assert.notEqual(catalogNameError('a', 'curso'), '');
  assert.notEqual(catalogNameError('<script>', 'curso'), '');
  assert.equal(catalogNameError('Violão I', 'curso'), '');
  assert.deepEqual(validateProfessor({
    nome: 'Alexandre Silva',
    contato: 'alexandre@example.com',
    telefone: '(71) 99999-1234',
    local: 'Guarani',
    cursos: ['Violão I'],
  }), {});
  assert.ok(Object.keys(validateProfessor({ nome: 'Teste', contato: 'x', telefone: 'abc', local: '', cursos: [] })).length >= 5);
});

test('valida o cadastro completo do aluno sem exigir uma igreja duplicada', () => {
  assert.deepEqual(validateStudent({
    nome: 'Maria de Souza',
    contato: '',
    telefone: '(71) 99999-1234',
    classe: 'Adolescente',
    turmas: [11, 22, 33],
    local: 'Guarani',
    instrumento: 'Não',
    guardian_name: 'Joana de Souza',
    guardian_phone: '(71) 98888-1234',
  }), {});

  assert.equal(validateStudent({
    nome: 'Maria de Souza',
    contato: 'maria@example.com',
    telefone: '(71) 99999-1234',
    classe: 'Jovem',
    turmas: [11, 22, 33, 44],
    local: 'Guarani',
    instrumento: 'Não',
  }).curso, 'Selecione no máximo três cursos.');

  const errors = validateStudent({
    nome: 'Teste',
    contato: 'qualquer coisa',
    telefone: '31231231312312',
    classe: 'Outra',
    curso: '',
    local: '',
    instrumento: 'Talvez',
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    'classe',
    'contato',
    'instrumento',
    'local',
    'nome',
    'curso',
    'telefone',
  ].sort());
});

test('valida dia e horário da turma como um único agendamento opcional', () => {
  assert.deepEqual(validateClassSchedule({ weekday: '', start_time: '' }), {});
  assert.deepEqual(validateClassSchedule({ weekday: 'Quarta-feira', start_time: '19:30' }), {});
  assert.equal(validateClassSchedule({ weekday: 'Quarta-feira', start_time: '' }).start_time, 'Informe o horário da turma.');
  assert.equal(validateClassSchedule({ weekday: '', start_time: '19:30' }).weekday, 'Selecione o dia da semana.');
  assert.equal(validateClassSchedule({ weekday: 'Feriado', start_time: '25:99' }).weekday, 'Selecione um dia da semana válido.');
  assert.deepEqual(validateClassDetails({ weekday: 'Sábado', start_time: '09:00', label: 'Turma A', capacity: 25 }), {});
  assert.match(validateClassDetails({ weekday: '', start_time: '', label: 'Turma A', capacity: 0 }).capacity, /entre 1 e 500/);
});

test('valida período letivo por intervalo de datas, inclusive entre anos civis', () => {
  assert.deepEqual(validateSchoolYear({ label: '2026/2027', start_date: '2026-08-10', end_date: '2027-06-30' }), {});
  assert.equal(validateSchoolYear({ label: '2026', start_date: '2027-06-30', end_date: '2026-08-10' }).end_date, 'A data final deve ser posterior à data inicial.');
  assert.equal(validateSchoolYear({ label: 'x', start_date: '2026-02-30', end_date: '2027-06-30' }).start_date, 'Informe uma data inicial válida.');
});

test('valida chamados, mensagens e identificadores idempotentes', () => {
  assert.deepEqual(validateSupportTicket({
    assunto: 'Problema com frequência',
    categoria: 'Frequência',
    mensagem: 'Não consigo registrar a presença da turma.',
  }), {});
  assert.equal(validateSupportTicket({ assunto: '   ', categoria: 'Qualquer', mensagem: 'x' }).categoria, 'Selecione uma categoria válida.');
  assert.match(validateSupportTicket({ assunto: 'a'.repeat(121), categoria: 'Outro', mensagem: 'Mensagem suficientemente longa.' }).assunto, /120/);
  assert.match(validateSupportTicket({ assunto: 'Assunto válido', categoria: 'Outro', mensagem: 'a'.repeat(4001) }).mensagem, /4000/);
  assert.match(supportMessageError(' '), /obrigatória/);
  assert.equal(supportMessageError('Tudo certo agora.'), '');
  assert.equal(supportClientMessageIdError('12345678-1234-1234-1234-123456789abc'), '');
  assert.notEqual(supportClientMessageIdError('curto'), '');
});
