import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createNotificationJobs } from './jobs.mjs';

function testDatabase(){
  const db=new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE school_years (id INTEGER PRIMARY KEY,label TEXT,active INTEGER,closed_at TEXT);
    CREATE TABLE classes (id INTEGER PRIMARY KEY,school_year_id INTEGER);
    CREATE TABLE enrollments (id INTEGER PRIMARY KEY,class_id INTEGER,enrolled_at TEXT);
    CREATE TABLE support_tickets (id INTEGER PRIMARY KEY,status TEXT);
    CREATE TABLE users (id INTEGER PRIMARY KEY,email TEXT,name TEXT,role TEXT,active INTEGER);
    CREATE TABLE scheduled_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,notification_type TEXT,reference_key TEXT,recipient TEXT,status TEXT DEFAULT 'pending',attempts INTEGER DEFAULT 0,last_error TEXT,sent_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(notification_type,reference_key,recipient));
    INSERT INTO school_years VALUES (1,'2026/2027',1,NULL);
    INSERT INTO classes VALUES (10,1);
    INSERT INTO enrollments VALUES (1,10,'2026-08-31'),(2,10,'2026-09-01');
    INSERT INTO support_tickets VALUES (1,'Aberto'),(2,'Resolvido');
    INSERT INTO users VALUES (1,'gestor@example.com','Gestora Teste','gestor',1);
  `);
  return db;
}

test('jobs enviam lembrete e resumo uma única vez por referência',async()=>{
  const db=testDatabase(),emails=[];
  const jobs=createNotificationJobs({
    db,
    sendEmail:async(recipient,subject,body,idempotencyKey)=>{emails.push({recipient,subject,body,idempotencyKey});},
    pendingAttendance:async()=>[{classId:10,data:'2026-08-29',curso:'Violão',local:'Pituba',professor:'Marina',professorEmail:'professor@example.com'}],
    atRiskStudents:async()=>[{id:1},{id:2}],
    zonedTodayDate:()=> '2026-09-01',
    baseUrl:'https://aprendiz.example.com',
  });
  try{
    assert.deepEqual(await jobs.runAttendanceReminders(),{sent:1,failed:0,skipped:0});
    assert.deepEqual(await jobs.runAttendanceReminders(),{sent:0,failed:0,skipped:1});
    assert.deepEqual(await jobs.runWeeklyManagerSummary(),{sent:1,failed:0,skipped:0});
    assert.deepEqual(await jobs.runWeeklyManagerSummary(),{sent:0,failed:0,skipped:1});
    assert.equal(emails.length,2);
    assert.match(emails[0].body,/chamada da turma Violão/i);
    assert.match(emails[1].body,/Novas matrículas: 2/);
    assert.match(emails[1].body,/Alunos em risco: 2/);
    assert.match(emails[1].body,/Tickets abertos: 1/);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM scheduled_notifications WHERE status='sent'").get().total,2);
  }finally{db.close();}
});

test('job registra falha e tenta novamente sem duplicar a referência',async()=>{
  const db=testDatabase();let attempts=0;
  const jobs=createNotificationJobs({
    db,
    sendEmail:async()=>{attempts+=1;if(attempts===1)throw new Error('provedor indisponível');},
    pendingAttendance:async()=>[{classId:10,data:'2026-08-29',curso:'Violão',local:'Pituba',professor:'Marina',professorEmail:'professor@example.com'}],
    atRiskStudents:async()=>[],zonedTodayDate:()=> '2026-09-01',baseUrl:'https://aprendiz.example.com',
  });
  try{
    assert.deepEqual(await jobs.runAttendanceReminders(),{sent:0,failed:1,skipped:0});
    assert.deepEqual(await jobs.runAttendanceReminders(),{sent:1,failed:0,skipped:0});
    const row=db.prepare("SELECT status,attempts,last_error FROM scheduled_notifications WHERE notification_type='attendance_reminder'").get();
    assert.equal(row.status,'sent');assert.equal(row.attempts,2);assert.equal(row.last_error,null);
  }finally{db.close();}
});
