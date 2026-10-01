import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEnrollmentDate } from '../src/utils/enrollment-date.js';

test('data da inscrição usa o calendário do fuso da aplicação',()=>{
  const now=new Date('2026-09-09T15:00:00.000Z');
  assert.equal(formatEnrollmentDate('2026-09-09T12:00:00.000Z',now),'Hoje');
  assert.equal(formatEnrollmentDate('2026-09-08T12:00:00.000Z',now),'Ontem');
  assert.equal(formatEnrollmentDate('2026-09-07T12:00:00.000Z',now),'07/09/2026');
  assert.equal(formatEnrollmentDate('valor-inválido',now),'');
});

test('virada do dia não usa o calendário UTC por engano',()=>{
  const now=new Date('2026-09-09T01:00:00.000Z');
  assert.equal(formatEnrollmentDate('2026-09-08T23:00:00.000Z',now,'America/Sao_Paulo'),'Hoje');
});
