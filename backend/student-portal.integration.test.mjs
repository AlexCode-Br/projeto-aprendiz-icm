import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './security.mjs';
import { createDatabase } from './database.mjs';
import { initializeStudentSchema } from './student-schema.mjs';
import { studentCalendar } from '../shared/student-calendar.mjs';
import { deliverStudentNotices } from './student-notifications.mjs';
import { notificationDestination } from './notifications.mjs';
import { SALVADOR_CHURCHES } from '../shared/catalog-options.mjs';

test('calendário civil limita matrícula e período, deduplica datas semanais e específicas',()=>{
  const classes=[{id:1,curso:'Violão',local:'EAD',enrolled_at:'2026-09-08',dates_confirmed:1,start_date:'2026-09-01',end_date:'2026-09-22'}];
  const slots=[{class_id:1,weekday_index:0,start_minutes:600},{class_id:1,class_date:'2026-09-14',start_minutes:600},{class_id:1,class_date:'2026-09-18',start_minutes:720},{class_id:2,class_date:'2026-09-18',start_minutes:720}];
  assert.deepEqual(studentCalendar(classes,slots,'2026-09').map(e=>`${e.data}/${e.hora}`),['2026-09-14/10:00','2026-09-18/12:00','2026-09-21/10:00']);
  assert.throws(()=>studentCalendar(classes,slots,'2026-13'));
});

test('calendário do aluno sinaliza choque entre turmas no mesmo horário',()=>{
  const classes=[
    {id:1,curso:'Violão',local:'Pituba',enrolled_at:'2026-01-01',dates_confirmed:0},
    {id:2,curso:'Teclado',local:'Brotas',enrolled_at:'2026-01-01',dates_confirmed:0},
  ];
  const slots=[
    {class_id:1,class_date:'2026-09-26',start_minutes:540},
    {class_id:2,class_date:'2026-09-26',start_minutes:540},
    {class_id:2,class_date:'2026-09-27',start_minutes:600},
  ];
  const events=studentCalendar(classes,slots,'2026-09');
  assert.equal(events.filter(event=>event.data==='2026-09-26').every(event=>event.conflito),true);
  assert.equal(events.find(event=>event.data==='2026-09-27').conflito,false);
});

test('migração SQLite preserva contas antigas, vínculos e índices ao incluir aluno',async()=>{
  const db=await createDatabase({sqlitePath:':memory:'});
  try{
    await db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE,role TEXT CHECK(role IN ('gestor','professor')));
      CREATE INDEX users_custom_email_idx ON users(email);
      CREATE TABLE students (id INTEGER PRIMARY KEY);
      CREATE TABLE classes (id INTEGER PRIMARY KEY);
      CREATE TABLE announcements (id INTEGER PRIMARY KEY);
      CREATE TABLE sessions (id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE);
      INSERT INTO users (id,email,role) VALUES (12,'gestor@example.test','gestor');
      INSERT INTO sessions VALUES (1,12);`);
    await initializeStudentSchema(db);
    assert.equal((await db.prepare('SELECT user_id FROM sessions').get()).user_id,12);
    assert.ok(await db.prepare("SELECT name FROM sqlite_master WHERE name='users_custom_email_idx'").get());
    await db.prepare("INSERT INTO users (email,role) VALUES (?,'aluno')").run('aluno@example.test');
    assert.deepEqual(await db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal((await db.prepare('PRAGMA foreign_keys').get()).foreign_keys,1);
    await initializeStudentSchema(db);
  }finally{await db.close();}
});

test('área do aluno: convite, autorização, IDOR, frequência, calendário, comunicados e conta', {timeout:60000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aprendiz-student-'));
  const databasePath=join(directory,'test.db'),port=56000+process.pid%1000,base=`http://127.0.0.1:${port}`;
  let logs='',db;
  const server=spawn(process.execPath,['backend/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:base,DATABASE_URL:'',SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',NODE_ENV:'test',SEED_DEMO_DATA:'true',VAPID_PRIVATE_KEY:'',VAPID_PUBLIC_KEY:''},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  const call=async(session,path,method='GET',body)=>{
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),Origin:base},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json().catch(()=>null),cookie:String(response.headers.get('set-cookie')||'').split(';')[0]};
  };
  const login=async(email,password='Aluno@2026!')=>{
    const result=await call(null,'/api/auth/login','POST',{email,password,remember:true});
    assert.equal(result.status,200,JSON.stringify(result));
    return {cookie:result.cookie,csrf:result.data.csrfToken,user:result.data.user};
  };
  try{
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
    assert.ok(ready,logs);
    const manager=await login('gestor@projetoaprendiz.local','Gestor@2026!');
    const professor=await login('professor@projetoaprendiz.local','Professor@2026!');
    db=new DatabaseSync(databasePath);
    const insertStudent=(name,email)=>Number(db.prepare("INSERT INTO students(name,email,age_group) VALUES (?,?,'Jovem')").run(name,email).lastInsertRowid);
    const aliceId=insertStudent('Alice Teste','alice@example.test'),bobId=insertStudent('Beto Teste','beto@example.test');
    const classes=db.prepare('SELECT id FROM classes WHERE active=1 ORDER BY id LIMIT 2').all().map(r=>r.id);
    assert.equal(classes.length,2);
    db.prepare("UPDATE school_years SET start_date='2026-01-01',end_date='2026-12-31',dates_confirmed=1 WHERE active=1").run();
    for(const[id,classId]of [[aliceId,classes[0]],[bobId,classes[1]]])db.prepare("INSERT INTO enrollments(student_id,class_id,enrolled_at) VALUES (?,?,'2026-01-01')").run(id,classId);
    const requestInvite=async id=>{
      const result=await call(manager,`/api/student-access/${id}`,'POST',{});
      assert.equal(result.status,200,JSON.stringify(result));
      const email=db.prepare('SELECT body FROM dev_emails ORDER BY id DESC LIMIT 1').get();
      return new URL(email.body.match(/http:\/\/\S+/)[0]).searchParams.get('token');
    };
    assert.equal((await call(professor,`/api/student-access/${aliceId}`,'POST',{})).status,403);
    let token=await requestInvite(aliceId);
    const pendingStatus=await call(manager,`/api/student-access/${aliceId}`);
    assert.equal(pendingStatus.status,200,JSON.stringify(pendingStatus));
    assert.equal(pendingStatus.data.pending,true);
    assert.equal(pendingStatus.data.hasInvite,true);
    const replacedToken=token;
    token=await requestInvite(aliceId);
    assert.equal((await call(null,`/api/student-invitations/validate?token=${replacedToken}`)).status,400);
    assert.equal((await call(null,`/api/student-invitations/validate?token=${token}`)).data.nome,'Alice Teste');
    assert.equal((await call(null,'/api/student-invitations/accept','POST',{token,password:'short'})).status,400);
    assert.equal((await call(null,'/api/student-invitations/accept','POST',{token,password:'Aluno@2026!'})).status,200);
    assert.equal((await call(null,'/api/student-invitations/accept','POST',{token,password:'Aluno@2026!'})).status,400);
    assert.equal((await call(manager,`/api/student-access/${aliceId}`,'POST',{})).status,409);
    const bobUser=Number(db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES ('Beto Teste','beto@example.test',?,'aluno')").run(await hashPassword('Aluno@2026!')).lastInsertRowid);
    db.prepare('INSERT INTO student_accounts(student_id,user_id) VALUES (?,?)').run(bobId,bobUser);
    const alice=await login('alice@example.test'),bob=await login('beto@example.test');
    assert.equal(alice.user.role,'aluno');
    assert.equal((await call(null,'/api/aluno/turmas')).status,401);
    assert.equal((await call(manager,'/api/aluno/turmas')).status,403);
    for(const path of ['/alunos','/professores','/cursos','/professores/meus-alunos','/api/informativos','/api/suporte','/api/dashboard/gestor','/api/dashboard/professor','/api/school-years',`/api/alunos/${bobId}/foto`])assert.equal((await call(alice,path)).status,403,path);
    assert.equal((await call(alice,'/api/aluno/turmas','POST',{})).status,404);
    const managerChurch=db.prepare('SELECT id FROM churches WHERE active=1 ORDER BY id LIMIT 1').get();
    const managerEmailChange=await call(manager,`/alunos/${aliceId}`,'PUT',{
      nome:'Alice Teste',contato:'alice-manager-change@example.test',telefone:'71999999999',classe:'Jovem',
      church_id:managerChurch.id,instrumento:'Não',turmas:[classes[0]],
    });
    assert.equal(managerEmailChange.status,200,JSON.stringify(managerEmailChange));
    assert.equal(managerEmailChange.data.emailConfirmation.sent,true);
    assert.equal(db.prepare('SELECT email FROM students WHERE id=?').get(aliceId).email,'alice@example.test');
    assert.equal(db.prepare('SELECT email FROM users WHERE id=?').get(alice.user.id).email,'alice@example.test');
    assert.equal(db.prepare('SELECT recipient FROM dev_emails ORDER BY id DESC LIMIT 1').get().recipient,'alice-manager-change@example.test');
    assert.deepEqual((await call(alice,`/api/aluno/turmas?student_id=${bobId}`)).data.turmas.map(c=>c.id),[classes[0]]);
    assert.equal((await call(alice,`/api/aluno/turmas?turma=${classes[1]}`)).status,404);
    assert.equal((await call(alice,'/api/aluno/turmas?periodo=999999')).status,404);
    const own=(await call(alice,'/api/aluno/turmas')).data.turmas[0];
    assert.equal('professor_id' in own,false);assert.equal('alunos' in own,false);
    const lesson=Number(db.prepare("INSERT INTO attendance_sessions(class_id,class_date,recorded_by) VALUES (?,'2026-09-01',?)").run(classes[0],professor.user.id).lastInsertRowid);
    db.prepare("INSERT INTO attendance_records(session_id,student_id,status) VALUES (?,?,'presente')").run(lesson,aliceId);
    db.prepare("INSERT INTO attendance_records(session_id,student_id,status) VALUES (?,?,'ausente')").run(lesson,bobId);
    const attendance=await call(alice,'/api/aluno/frequencia');
    assert.equal(attendance.data.total,1);assert.equal(attendance.data.percentual,100);
    const justifiedLesson=Number(db.prepare("INSERT INTO attendance_sessions(class_id,class_date,recorded_by) VALUES (?,'2026-09-08',?)").run(classes[0],professor.user.id).lastInsertRowid);
    db.prepare("INSERT INTO attendance_records(session_id,student_id,status) VALUES (?,?,'justificado')").run(justifiedLesson,aliceId);
    const attendanceWithJustification=await call(alice,'/api/aluno/frequencia');
    assert.equal(attendanceWithJustification.data.total,2);
    assert.equal(attendanceWithJustification.data.presentes,1);
    assert.equal(attendanceWithJustification.data.justificadas,1);
    assert.equal(attendanceWithJustification.data.percentual,100);
    assert.equal((await call(bob,'/api/aluno/frequencia')).data.total,0);
    db.prepare("INSERT OR IGNORE INTO class_schedule_dates(class_id,class_date,start_minutes) VALUES (?,'2026-09-18',600)").run(classes[0]);
    assert.ok((await call(alice,'/api/aluno/calendario?mes=2026-09')).data.aulas.some(a=>a.data==='2026-09-18'&&a.hora==='10:00'));
    assert.equal((await call(alice,'/api/aluno/calendario?mes=invalid')).status,400);
    const announce=(title,date)=>Number(db.prepare("INSERT INTO announcements(author_user_id,title,category,content,scheduled_at) VALUES (?,?,'Geral','<p>Conteúdo privado do teste</p>',?)").run(manager.user.id,title,date).lastInsertRowid);
    const staff=announce('Somente equipe','2020-01-01T00:00:00Z'),target=announce('Somente turma da Alice','2020-01-01T00:00:00Z'),future=announce('Futuro','2099-01-01T00:00:00Z');
    const assign=async(id,selected)=>call(manager,`/api/student-audiences/${id}`,'PUT',{mode:'classes',selected});
    assert.equal((await assign(target,classes.slice(0,1))).status,200);
    assert.equal((await assign(future,classes)).status,200);
    assert.equal((await assign(target,[999999])).status,400);
    assert.equal((await call(alice,`/api/student-audiences/${target}`,'PUT',{mode:'all'})).status,403);
    const attachment=Number(db.prepare("INSERT INTO announcement_attachments(announcement_id,filename,mime_type,size_bytes,data_url) VALUES (?,'private.pdf','application/pdf',3,'data:application/pdf;base64,YWJj')").run(target).lastInsertRowid);
    const notices=await call(alice,'/api/aluno/notificacoes');
    assert.deepEqual(notices.data.items.map(r=>r.id),[target]);
    assert.equal((await call(bob,'/api/aluno/informativos')).data.total,0);
    assert.equal((await call(alice,'/api/aluno/nao-lidos')).data.total,1);
    assert.equal((await call(bob,`/api/aluno/informativos/${target}/anexos/${attachment}`)).status,404);
    assert.equal((await call(alice,`/api/aluno/informativos/${target}/anexos/${attachment}`)).status,200);
    assert.equal((await call(alice,`/api/aluno/informativos/${staff}/lido`,'POST',{})).status,404);
    assert.equal((await call(alice,`/api/aluno/informativos/${target}/lido`,'POST',{})).status,200);
    assert.equal((await call(alice,'/api/aluno/nao-lidos')).data.total,0);
    assert.equal((await call(alice,`/api/aluno/cursos/${classes[1]}`)).status,404);
    assert.equal((await call(alice,`/api/aluno/informativos?turma=${classes[1]}`)).status,404);
    const coursePost=await call(professor,`/api/professores/me/turmas/${classes[0]}/mural`,'POST',{titulo:'Próxima aula',categoria:'Atividade',conteudo:'Traga seu instrumento para a próxima aula.',fixarNoTopo:true,solicitarConfirmacao:true,anexos:[]});
    assert.equal(coursePost.status,201,JSON.stringify(coursePost));
    assert.equal((await call(professor,'/api/professores/me/turmas/999999/informativos','POST',{titulo:'Indevido',conteudo:'Não deve ser publicado.'})).status,404);
    assert.equal((await call(alice,`/api/professores/me/turmas/${classes[0]}/informativos`,'POST',{titulo:'Indevido',conteudo:'Não deve ser publicado.'})).status,403);
    const studentWall=(await call(alice,`/api/aluno/informativos?turma=${classes[0]}`)).data.items.find(i=>i.id===coursePost.data.id);
    assert.equal(studentWall.requerConfirmacao,true);
    assert.equal(studentWall.confirmado,false);
    let professorWall=(await call(professor,`/api/professores/me/turmas/${classes[0]}/mural`)).data.items.find(i=>i.id===coursePost.data.id);
    assert.equal(professorWall.categoria,'Atividade');
    assert.equal(professorWall.fixado,true);
    assert.equal(professorWall.confirmacoes,0);
    assert.equal(professorWall.totalAlunos,1);
    assert.equal((await call(alice,`/api/aluno/informativos/${coursePost.data.id}/lido`,'POST',{})).status,200);
    professorWall=(await call(professor,`/api/professores/me/turmas/${classes[0]}/mural`)).data.items.find(i=>i.id===coursePost.data.id);
    assert.equal(professorWall.confirmacoes,1);
    const updatedWall=await call(professor,`/api/professores/me/turmas/${classes[0]}/mural/${coursePost.data.id}`,'PUT',{titulo:'Próxima aula atualizada',categoria:'Aviso',conteudo:'Leve também o caderno para a próxima aula.',fixarNoTopo:false,solicitarConfirmacao:false,anexos:[]});
    assert.equal(updatedWall.status,200,JSON.stringify(updatedWall));
    professorWall=(await call(professor,`/api/professores/me/turmas/${classes[0]}/mural`)).data.items.find(i=>i.id===coursePost.data.id);
    assert.equal(professorWall.titulo,'Próxima aula atualizada');
    assert.equal(professorWall.requerConfirmacao,false);
    assert.equal((await call(bob,'/api/aluno/informativos')).data.total,0);
    const deliveryCalls=[];
    const dispatcher={db,notificationService:{notifyUser:async(...args)=>{deliveryCalls.push(args);return {sent:true};}},announcementScheduledCondition:column=>`${column} <= strftime('%Y-%m-%dT%H:%M:%fZ','now')`};
    assert.equal((await deliverStudentNotices(dispatcher)).processed,2);
    assert.ok(deliveryCalls.every(args=>args[0]===alice.user.id));
    assert.equal((await deliverStudentNotices(dispatcher)).processed,0);
    assert.equal(notificationDestination('systemNews','aluno'),'/aluno/informativos');
    const church=db.prepare('SELECT id FROM churches WHERE active=1 LIMIT 1').get();
    const extraLocation=Number(db.prepare("INSERT INTO locations(name,active) VALUES ('Igreja Nova Esperança',1)").run().lastInsertRowid);
    const availableChurches=(await call(alice,'/api/aluno/perfil')).data.churches;
    assert.ok(SALVADOR_CHURCHES.every(name=>availableChurches.some(item=>item.nome===name)),JSON.stringify(availableChurches));
    assert.ok(availableChurches.some(item=>item.id===`location:${extraLocation}`&&item.nome==='Igreja Nova Esperança'));
    const personal={telefone:'71998887766',church_id:church.id,classe:'Jovem',instrumento:true};
    assert.equal((await call(alice,'/api/aluno/perfil','PUT',{...personal,turmas:[classes[1]]})).status,400);
    assert.equal((await call(alice,'/api/aluno/perfil','PUT',{...personal,student_id:bobId})).status,400);
    assert.equal((await call(alice,'/api/aluno/perfil','PUT',personal)).status,200);
    assert.equal((await call(alice,'/api/aluno/perfil')).data.telefone,'71998887766');
    assert.equal((await call(alice,'/api/aluno/perfil','PUT',{...personal,church_id:`location:${extraLocation}`})).status,200);
    assert.equal(db.prepare('SELECT ch.name FROM students s JOIN churches ch ON ch.id=s.church_id WHERE s.id=?').get(aliceId).name,'Igreja Nova Esperança');
    assert.equal((await call(bob,'/api/aluno/perfil')).data.telefone,null);
    assert.equal((await call(alice,'/api/aluno/perfil','PUT',{...personal,classe:'Adolescente'})).status,400);
    assert.deepEqual((await call(alice,'/api/aluno/turmas')).data.turmas.map(c=>c.id),[classes[0]]);
    assert.equal((await call(alice,'/api/account/profile','PUT',{nome:'Alice Atualizada',id:bobUser,role:'gestor'})).status,200);
    assert.equal(db.prepare('SELECT name FROM students WHERE id=?').get(aliceId).name,'Alice Atualizada');
    assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get(bobUser).name,'Beto Teste');
    assert.equal((await call(alice,'/api/account')).data.user.role,'aluno');
    assert.equal((await call({...alice,csrf:'invalid'},'/api/account/profile','PUT',{nome:'Não Permitido'})).status,403);
    assert.equal((await call(alice,'/api/account/preferences','PUT',{preferences:{systemNews:true},user_id:bobUser})).status,200);
    assert.equal((await call(bob,'/api/account')).data.preferences.systemNews,false);
    db.prepare('UPDATE students SET active=0 WHERE id=?').run(aliceId);
    assert.equal((await call(alice,'/api/auth/me')).status,401);
    assert.equal((await call(alice,'/api/aluno/perfil')).status,401);
    assert.equal((await call(null,'/api/auth/login','POST',{email:'alice@example.test',password:'Aluno@2026!'})).status,401);
    db.prepare('UPDATE students SET active=1 WHERE id=?').run(aliceId);
    assert.equal((await call(bob,'/api/account/delete','POST',{confirmation:'beto@example.test'})).status,200);
    assert.ok(db.prepare('SELECT id FROM students WHERE id=? AND active=1').get(bobId));
    assert.equal((await call(bob,'/api/auth/me')).status,401);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM student_accounts WHERE user_id=?').get(bobUser).total,0);
    // Changed emails and expired invitations must never activate stale ownership.
    const changed=insertStudent('Carla Teste','carla@example.test'),changedToken=await requestInvite(changed);
    db.prepare("UPDATE students SET email='changed@example.test' WHERE id=?").run(changed);
    assert.equal((await call(null,`/api/student-invitations/validate?token=${changedToken}`)).status,400);
    const expired=insertStudent('Dora Teste','dora@example.test'),expiredToken=await requestInvite(expired);
    db.prepare("UPDATE student_invites SET expires_at='2000-01-01' WHERE student_id=?").run(expired);
    assert.equal((await call(null,`/api/student-invitations/validate?token=${expiredToken}`)).status,400);
    assert.equal((await call(alice,'/api/student-email/request','POST',{email:'new-alice@example.test',password:'wrong'})).status,400);
    assert.equal((await call(alice,'/api/student-email/request','POST',{email:'new-alice@example.test',password:'Aluno@2026!'})).status,200);
    assert.equal(db.prepare('SELECT email FROM users WHERE id=?').get(alice.user.id).email,'alice@example.test');
    const confirmationMail=db.prepare('SELECT body FROM dev_emails ORDER BY id DESC LIMIT 1').get();
    const emailToken=new URL(confirmationMail.body.match(/http:\/\/\S+/)[0]).searchParams.get('token');
    assert.equal((await call(null,`/api/student-email/validate?token=${emailToken}`)).data.email,'new-alice@example.test');
    assert.equal((await call(null,'/api/student-email/confirm','POST',{token:emailToken})).status,200);
    assert.equal((await call(null,'/api/student-email/confirm','POST',{token:emailToken})).status,400);
    assert.equal(db.prepare('SELECT email FROM users WHERE id=?').get(alice.user.id).email,'new-alice@example.test');
    assert.equal(db.prepare('SELECT email FROM students WHERE id=?').get(aliceId).email,'new-alice@example.test');
    assert.equal((await call(alice,'/api/auth/me')).status,401);
    await login('new-alice@example.test');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{
    db?.close();
    const stopped=once(server,'exit');server.kill();await stopped;
    await rm(directory,{recursive:true,force:true});
  }
});
