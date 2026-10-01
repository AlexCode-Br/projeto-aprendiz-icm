import assert from 'node:assert/strict';
import test from 'node:test';
import { enrollmentBarWidth, rankEnrollmentClasses } from '../src/utils/enrollment-ranking.js';

const classes = [
  { id: 1, curso: 'Violão', local: 'Pituba', total: 4 },
  { id: 2, curso: 'Bateria', local: 'Brotas', total: 9 },
  { id: 3, curso: 'Canto', local: 'Guarani', total: 0 },
  { id: 4, curso: 'Teclado', local: 'Pituba', total: 4 },
  { id: 5, curso: 'Flauta', local: 'Brotas', total: 2 },
  { id: 6, curso: 'Gaita', local: 'EAD', total: 1 },
  { id: 7, curso: 'Saxofone', local: 'Guarani', total: 12 },
];

test('ranking limita a seis turmas e ordena pelos critérios disponíveis',()=>{
  assert.deepEqual(rankEnrollmentClasses(classes).map(item=>item.id),[7,2,4,1,5,6]);
  assert.deepEqual(rankEnrollmentClasses(classes,'least').map(item=>item.id),[3,6,5,4,1,2]);
  assert.deepEqual(rankEnrollmentClasses(classes,'az').map(item=>item.curso),['Bateria','Canto','Flauta','Gaita','Saxofone','Teclado']);
  assert.deepEqual(rankEnrollmentClasses(classes,'za').map(item=>item.curso),['Violão','Teclado','Saxofone','Gaita','Flauta','Canto']);
  assert.equal(classes[0].id,1,'a ordenação não deve alterar os dados recebidos');
});

test('largura das barras trata proporção, empate e zero',()=>{
  assert.equal(enrollmentBarWidth(20,20),100);
  assert.equal(enrollmentBarWidth(15,20),75);
  assert.equal(enrollmentBarWidth(0,20),0);
  assert.equal(enrollmentBarWidth(0,0),0);
});
