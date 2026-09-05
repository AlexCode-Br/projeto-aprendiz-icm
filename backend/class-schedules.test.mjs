import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabase } from './database.mjs';
import { attachClassSchedules, initializeClassSchedules } from './class-schedules.mjs';
import { classScheduleConflicts, classSchedules, nextClassSchedule, nextClassSchedules, sortClassSchedules, validateClassSchedules } from '../shared/class-schedules.mjs';

test('horários semanais validam dias, horas e duplicações e ordenam a semana', () => {
  assert.equal(validateClassSchedules([]),'');
  assert.ok(validateClassSchedules(null));
  assert.ok(validateClassSchedules([{weekday:'Feriado',start_time:'10:00'}]));
  assert.ok(validateClassSchedules([{weekday:'Segunda-feira',start_time:'24:00'}]));
  assert.ok(validateClassSchedules([{weekday:'Segunda-feira',start_time:''}]));
  const monday={weekday:'Segunda-feira',start_time:'10:00'};
  assert.ok(validateClassSchedules([monday,monday]));
  assert.ok(validateClassSchedules(Array(22).fill(monday)));
  assert.equal(validateClassSchedules([monday,{...monday,start_time:'11:00'}]),'');
  assert.deepEqual(sortClassSchedules([{weekday:'Sábado',start_time:'09:00'},monday]),[monday,{weekday:'Sábado',start_time:'09:00'}]);
  assert.deepEqual(classSchedules({horarios:[],weekday:'Sábado',start_time:'09:00'}),[]);
});

test('próxima aula usa todos os horários, fuso local e virada da semana', () => {
  const courses=[
    {id:1,horarios:[{weekday:'Segunda-feira',start_time:'09:00'},{weekday:'Quarta-feira',start_time:'11:00'}]},
    {id:2,horarios:[{weekday:'Quarta-feira',start_time:'09:00'},{weekday:'Quinta-feira',start_time:'08:00'}]},
  ];
  assert.equal(nextClassSchedule(courses,new Date('2026-09-02T13:00:00Z')).id,1);
  assert.equal(nextClassSchedule(courses,new Date('2026-09-02T14:00:01Z')).id,2);
  assert.equal(nextClassSchedule(courses,new Date('2026-09-07T01:00:00Z')).weekday,'Segunda-feira');
  assert.equal(nextClassSchedule([{id:1,horarios:[]}]),null);
  assert.deepEqual(nextClassSchedules(courses,new Date('2026-09-02T13:00:00Z'),'America/Sao_Paulo',2).map(item=>item.id),[1,2]);
  assert.equal(nextClassSchedules(courses,new Date('2026-09-02T13:00:00Z'),'America/Sao_Paulo',1)[0].offsetSeconds>=0,true);
});

test('conflitos consideram turmas diferentes no mesmo dia e horário', () => {
  const conflicts=classScheduleConflicts([
    {id:1,nome:'Violão',local:'Pituba',horarios:[{weekday:'Segunda-feira',start_time:'09:00'}]},
    {id:2,nome:'Flauta',local:'Brotas',horarios:[{weekday:'Segunda-feira',start_time:'09:00'}]},
    {id:3,nome:'Canto',local:'Pituba',horarios:[{weekday:'Segunda-feira',start_time:'10:00'}]},
  ]);
  assert.equal(conflicts.length,1);
  assert.equal(conflicts[0].descricao,'Segunda-feira às 09:00');
  assert.deepEqual(conflicts[0].turmas.map(item=>item.id),[1,2]);
});

test('migração local conserva o horário anterior e índices/constraints protegem vínculos', async () => {
  const db=await createDatabase({sqlitePath:':memory:'});
  try {
    await db.exec("PRAGMA foreign_keys=ON; CREATE TABLE classes (id INTEGER PRIMARY KEY,weekday TEXT,start_time TEXT); INSERT INTO classes VALUES (1,'Sábado','09:00'),(2,NULL,NULL);");
    await initializeClassSchedules(db);
    await initializeClassSchedules(db);
    const classes=await attachClassSchedules(db,await db.prepare('SELECT * FROM classes').all());
    assert.deepEqual(classes[0].horarios,[{weekday:'Sábado',start_time:'09:00'}]);
    assert.deepEqual(classes[1].horarios,[]);
    await assert.rejects(db.prepare('INSERT INTO class_schedules VALUES (?,?,?)').run(1,7,540));
    await assert.rejects(db.prepare('INSERT INTO class_schedules VALUES (?,?,?)').run(1,5,540));
    await db.prepare('DELETE FROM classes WHERE id=?').run(1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM class_schedules').get()).total,0);
  } finally { await db.close(); }
});
