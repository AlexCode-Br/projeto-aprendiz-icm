import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogNameError,
  emailError,
  personNameError,
  phoneError,
  validateProfessor,
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
