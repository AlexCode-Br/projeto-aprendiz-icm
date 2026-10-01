import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';

const PROFESSORS=5;
const STUDENTS=25;
const CLASSES=5;
const CALLS_PER_CLASS=12;
const PROFESSOR_POSTS=4;
const STUDENT_POSTS=2;
const COMMENTS_PER_POST=3;
const LIKES_PER_POST=4;
const MANAGER_NOTICES=10;
const HTTP_CONCURRENCY=20;
const samples=[];

const sha256=value=>createHash('sha256').update(value).digest('hex');
const round=value=>Math.round(value*100)/100;
const percentile=(values,ratio)=>values.length?values[Math.min(values.length-1,Math.ceil(values.length*ratio)-1)]:0;
const dataUrl=(mime,buffer)=>`data:${mime};base64,${buffer.toString('base64')}`;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=','base64');
const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF');

function attachment(index){
  return index%2
    ?{nome:`material-${index}.pdf`,tipo:'application/pdf',tamanho:pdf.length,dataUrl:dataUrl('application/pdf',pdf)}
    :{nome:`imagem-${index}.png`,tipo:'image/png',tamanho:png.length,dataUrl:dataUrl('image/png',png)};
}

async function runPool(tasks,concurrency){
  const results=new Array(tasks.length);
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,tasks.length)},async()=>{
    while(cursor<tasks.length){
      const index=cursor++;
      results[index]=await tasks[index]();
    }
  }));
  return results;
}

function summarize(items){
  const groups=new Map();
  for(const item of items){
    const list=groups.get(item.label)||[];
    list.push(item);
    groups.set(item.label,list);
  }
  return Object.fromEntries([...groups].map(([label,list])=>{
    const durations=list.map(item=>item.ms).sort((a,b)=>a-b);
    return [label,{requests:list.length,errors:list.filter(item=>item.status>=400).length,averageMs:round(durations.reduce((sum,value)=>sum+value,0)/durations.length),p50Ms:round(percentile(durations,.5)),p95Ms:round(percentile(durations,.95)),p99Ms:round(percentile(durations,.99)),maxMs:round(durations.at(-1))}];
  }));
}

function tomorrowSchedule(){
  const future=new Date(Date.now()+24*60*60*1000);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(future).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return {dataAgendamento:`${parts.year}-${parts.month}-${parts.day}`,horaAgendamento:`${parts.hour}:${parts.minute}`};
}

function createSession(db,userId){
  const token=randomBytes(32).toString('base64url'),csrf=randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessions(user_id,token_hash,csrf_token,expires_at) VALUES (?,?,?,?)').run(userId,sha256(token),csrf,new Date(Date.now()+8*60*60*1000).toISOString());
  return {userId,cookie:`pa_session=${token}`,csrf};
}

const directory=await mkdtemp(join(tmpdir(),'aprendiz-mass-'));
const databasePath=join(directory,'mass.db');
const port=58000+process.pid%1000;
const base=`http://127.0.0.1:${port}`;
let server,db,logs='';

try{
  server=spawn(process.execPath,['backend/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:base,DATABASE_URL:'',SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',NODE_ENV:'test',SEED_DEMO_DATA:'true',VAPID_PRIVATE_KEY:'',VAPID_PUBLIC_KEY:'',ANNOUNCEMENT_STORAGE_PROVIDER:'database'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>{logs+=chunk;});
  server.stderr.on('data',chunk=>{logs+=chunk;});
  let ready=false;
  for(let attempt=0;attempt<150;attempt++){
    try{if((await fetch(`${base}/api/health`)).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,`Servidor de teste não iniciou.\n${logs}`);
  db=new DatabaseSync(databasePath);
  db.exec('PRAGMA busy_timeout=15000;');

  const managerUser=db.prepare("SELECT id FROM users WHERE role='gestor' AND active=1 ORDER BY id LIMIT 1").get();
  const year=db.prepare('SELECT id FROM school_years WHERE active=1 AND closed_at IS NULL').get();
  const location=db.prepare('SELECT id FROM locations WHERE active=1 ORDER BY id LIMIT 1').get();
  const church=db.prepare('SELECT id FROM churches WHERE active=1 ORDER BY id LIMIT 1').get();
  assert.ok(managerUser&&year&&location&&church,'Dados-base não foram inicializados.');
  db.prepare("UPDATE school_years SET start_date='2026-01-01',end_date='2026-12-31',dates_confirmed=1 WHERE id=?").run(year.id);

  const manager={...createSession(db,managerUser.id),role:'gestor'};
  const professors=[],students=[],classes=[];
  db.exec('BEGIN IMMEDIATE');
  try{
    for(let index=0;index<PROFESSORS;index++){
      const name=`Professor Carga ${index+1}`,email=`professor.carga.${index+1}@example.test`;
      const userId=Number(db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'professor')").run(name,email,'mass-test-unused').lastInsertRowid);
      const profileId=Number(db.prepare('INSERT INTO professor_profiles(user_id,name,email,phone,home_location_id) VALUES (?,?,?,?,?)').run(userId,name,email,`71990000${String(index).padStart(3,'0')}`,location.id).lastInsertRowid);
      const courseId=Number(db.prepare('INSERT INTO courses(name) VALUES (?)').run(`Curso de Carga ${index+1}`).lastInsertRowid);
      const classId=Number(db.prepare('INSERT INTO classes(school_year_id,course_id,professor_id,location_id,label,capacity) VALUES (?,?,?,?,?,100)').run(year.id,courseId,profileId,location.id,`Turma Carga ${index+1}`).lastInsertRowid);
      const session={...createSession(db,userId),role:'professor',name,userId,profileId,classId};
      professors.push(session);classes.push({id:classId,courseId,professor:session,students:[]});
    }
    for(let index=0;index<STUDENTS;index++){
      const name=`Aluno Carga ${String(index+1).padStart(2,'0')}`,email=`aluno.carga.${index+1}@example.test`,classInfo=classes[index%CLASSES];
      const userId=Number(db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,'aluno')").run(name,email,'mass-test-unused').lastInsertRowid);
      const studentId=Number(db.prepare("INSERT INTO students(name,email,phone,church_id,age_group,has_instrument) VALUES (?,?,?,?,?,1)").run(name,email,`71980000${String(index).padStart(3,'0')}`,church.id,'Jovem').lastInsertRowid);
      db.prepare('INSERT INTO student_accounts(student_id,user_id) VALUES (?,?)').run(studentId,userId);
      db.prepare("INSERT INTO enrollments(student_id,class_id,status,enrolled_at) VALUES (?,?,'ativa','2026-01-15')").run(studentId,classInfo.id);
      const session={...createSession(db,userId),role:'aluno',name,userId,studentId,classId:classInfo.id};
      students.push(session);classInfo.students.push(session);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}

  async function request(session,label,method,path,body,expected=[200]){
    const started=performance.now();
    const response=await fetch(base+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.csrf}:{}),Origin:base},body:body===undefined?undefined:JSON.stringify(body)});
    const contentType=response.headers.get('content-type')||'';
    const data=contentType.includes('json')?await response.json().catch(()=>null):Buffer.from(await response.arrayBuffer());
    samples.push({label,status:response.status,ms:performance.now()-started});
    assert.ok(expected.includes(response.status),`${method} ${path}: esperado ${expected.join('/')}, recebido ${response.status}: ${JSON.stringify(data)}`);
    return {status:response.status,data,headers:response.headers};
  }

  const phaseTimes={};
  async function phase(name,work){const started=performance.now();const result=await work();phaseTimes[name]=round(performance.now()-started);return result;}

  await phase('configurarTurmas',()=>runPool(classes.map((item,index)=>()=>request(item.professor,'configurar-turma','PUT',`/api/turmas/${item.id}/configuracao`,{mapsUrl:`https://maps.app.goo.gl/TesteCarga${index+1}`,banner:index===0?dataUrl('image/png',png):null,x:50,y:50,zoom:100,permissaoMural:'post_and_comment'})),CLASSES));

  await phase('registrarChamadas',()=>runPool(classes.flatMap((item,classIndex)=>Array.from({length:CALLS_PER_CLASS},(_,callIndex)=>()=>request(item.professor,'salvar-chamada','POST','/frequencia',{
    curso_id:item.id,data_aula:`2026-06-${String(callIndex+1).padStart(2,'0')}`,
    frequencias:item.students.map((student,studentIndex)=>({aluno_id:student.studentId,status:(studentIndex+callIndex+classIndex)%5===0?'ausente':(studentIndex+callIndex)%7===0?'justificado':'presente'})),
  }))),10));

  const postTasks=[];
  for(const item of classes){
    for(let index=0;index<PROFESSOR_POSTS;index++)postTasks.push({session:item.professor,classInfo:item,index,source:'professor'});
    for(const student of item.students)for(let index=0;index<STUDENT_POSTS;index++)postTasks.push({session:student,classInfo:item,index,source:'aluno'});
  }
  const posts=await phase('publicarNoMural',()=>runPool(postTasks.map((task,index)=>async()=>{
    const attached=index%4===0?[attachment(index)]:[];
    const response=await request(task.session,'publicar-mural','POST',`/api/turmas/${task.classInfo.id}/mural`,{titulo:`Publicação de carga ${index+1}`,categoria:index%3===0?'Material de aula':'Aviso',conteudo:`Mensagem de teste em massa número ${index+1}, criada por ${task.session.name}.`,anexos:attached,fixarNoTopo:task.source==='professor'&&index%11===0,solicitarConfirmacao:task.source==='professor'&&index%9===0},[201]);
    return {id:Number(response.data.id),classInfo:task.classInfo,authorId:task.session.userId,attachment:Boolean(attached.length)};
  }),HTTP_CONCURRENCY));

  await phase('comentarNoMural',()=>runPool(posts.flatMap((post,postIndex)=>Array.from({length:COMMENTS_PER_POST},(_,commentIndex)=>{
    const actors=[post.classInfo.professor,...post.classInfo.students];
    const actor=actors[(postIndex+commentIndex)%actors.length];
    return()=>request(actor,'comentar-mural','POST',`/api/turmas/${post.classInfo.id}/mural/${post.id}/comentarios`,{conteudo:`Comentário simultâneo ${commentIndex+1} na publicação ${post.id}.`},[201]);
  })),HTTP_CONCURRENCY));

  await phase('curtirNoMural',()=>runPool(posts.flatMap((post,postIndex)=>{
    const actors=[post.classInfo.professor,...post.classInfo.students].filter(actor=>actor.userId!==post.authorId);
    return actors.slice(0,LIKES_PER_POST).map((actor,likeIndex)=>()=>request(actor,'curtir-mural','PUT',`/api/turmas/${post.classInfo.id}/mural/${post.id}/curtida`,{ordem:postIndex+likeIndex}));
  }),HTTP_CONCURRENCY));

  const schedule=tomorrowSchedule();
  const notices=await phase('publicarInformativos',()=>runPool(Array.from({length:MANAGER_NOTICES},(_,index)=>async()=>{
    const response=await request(manager,'publicar-informativo','POST','/api/informativos',{titulo:`Informativo de carga ${index+1}`,categoria:index%4===0?'Urgente':'Geral',conteudo:`Comunicado administrativo de teste em massa número ${index+1}.`,...schedule,fixarNoTopo:index%5===0,destinatarios:{turmas:classes.map(item=>item.id)},anexos:[attachment(1000+index)]},[201]);
    return Number(response.data.id);
  }),5));
  const publishedAt=new Date(Date.now()-60_000).toISOString();
  for(const id of notices)db.prepare('UPDATE announcements SET scheduled_at=?,published_at=? WHERE id=?').run(publishedAt,publishedAt,id);

  const portalResults=await phase('consultarPortais',()=>runPool([
    ...students.map(student=>()=>request(student,'listar-informativos-aluno','GET',`/api/aluno/informativos?turma=${student.classId}&origem=gestao`)),
    ...professors.map(professor=>()=>request(professor,'listar-informativos-professor','GET','/api/informativos')),
    ...professors.map(professor=>()=>request(professor,'dashboard-professor','GET','/api/dashboard/professor')),
    ...professors.map(professor=>()=>request(professor,'relatorio-frequencia','GET','/api/relatorios/frequencia?dataInicio=2026-06-01&dataFim=2026-06-30')),
    ()=>request(manager,'dashboard-gestor','GET','/api/dashboard/gestor'),
    ()=>request(manager,'listar-informativos-gestor','GET','/api/informativos'),
  ],15));
  assert.ok(portalResults.slice(0,STUDENTS).every(result=>Number(result.data.total)>=MANAGER_NOTICES),'Todos os alunos devem receber os dez informativos destinados às suas turmas.');
  assert.ok(portalResults.slice(STUDENTS,STUDENTS+PROFESSORS).every(result=>result.data.filter(item=>item.titulo.startsWith('Informativo de carga ')).length===MANAGER_NOTICES),'Cada professor deve receber os informativos das próprias turmas.');

  const firstAttachment=db.prepare(`SELECT aa.id,a.id AS announcement_id,sca.class_id FROM announcement_attachments aa JOIN announcements a ON a.id=aa.announcement_id JOIN student_course_announcements sca ON sca.announcement_id=a.id ORDER BY aa.id LIMIT 1`).get();
  assert.ok(firstAttachment,'O teste deveria criar ao menos um anexo no mural.');
  const member=classes.find(item=>item.id===Number(firstAttachment.class_id)).students[0];
  const outsider=classes.find(item=>item.id!==Number(firstAttachment.class_id)).students[0];
  await request(member,'baixar-anexo-autorizado','GET',`/api/aluno/informativos/${firstAttachment.announcement_id}/anexos/${firstAttachment.id}`,undefined,[200]);
  await request(outsider,'bloquear-anexo-outra-turma','GET',`/api/aluno/informativos/${firstAttachment.announcement_id}/anexos/${firstAttachment.id}`,undefined,[404]);
  await request(students[0],'bloquear-mural-outra-turma','GET',`/api/turmas/${classes[1].id}/mural`,undefined,[404]);
  await request(professors[0],'bloquear-professor-outra-turma','GET',`/api/turmas/${classes[1].id}/mural`,undefined,[404]);
  await request(manager,'bloquear-publicacao-gestor','POST',`/api/turmas/${classes[0].id}/mural`,{titulo:'Gestor',conteudo:'Tentativa administrativa que deve ser bloqueada.',anexos:[]},[403]);

  for(const student of students)db.prepare("INSERT INTO enrollments(student_id,class_id,status,enrolled_at) VALUES (?,?,'ativa','2026-09-23') ON CONFLICT(student_id,class_id) DO NOTHING").run(student.studentId,classes[0].id);
  const historicRoster=(await request(classes[0].professor,'carregar-chamada-historica-apos-matriculas','GET',`/frequencia?curso_id=${classes[0].id}&data=2026-06-01`)).data.alunos;
  const historicRosterObservation={studentsReturned:historicRoster.length,studentsWithoutRecord:historicRoster.filter(item=>!item.status).length,studentsEnrolledAfterDate:20};
  assert.equal(historicRosterObservation.studentsReturned,5,'A chamada histórica deve preservar somente o elenco registrado.');
  assert.equal(historicRosterObservation.studentsWithoutRecord,0,'O snapshot da chamada não pode receber alunos posteriores.');
  const largeGroupPost=await phase('publicarEmTurmaCom25Alunos',async()=>{
    const response=await request(classes[0].professor,'publicar-mural-grupo-25','POST',`/api/turmas/${classes[0].id}/mural`,{titulo:'Ensaio geral da turma ampliada',categoria:'Evento ou ensaio',conteudo:'Mensagem enviada para validar a distribuição em uma turma com vinte e cinco alunos.',anexos:[attachment(5000)]},[201]);
    return Number(response.data.id);
  });
  await phase('vinteComentariosSimultaneosTurma25',()=>runPool(students.slice(0,20).map((student,index)=>()=>request(student,'comentar-mural-grupo-25','POST',`/api/turmas/${classes[0].id}/mural/${largeGroupPost}/comentarios`,{conteudo:`Resposta simultânea ${index+1} da turma ampliada.`},[201])),20));
  await phase('vinteCurtidasSimultaneasTurma25',()=>runPool(students.slice(0,20).map(student=>()=>request(student,'curtir-mural-grupo-25','PUT',`/api/turmas/${classes[0].id}/mural/${largeGroupPost}/curtida`,{})),20));

  const burst={};
  for(const concurrency of [1,5,15,30]){
    const requests=90;
    const started=performance.now();
    await runPool(Array.from({length:requests},(_,index)=>{
      const actor=index%2?students[index%students.length]:professors[index%professors.length];
      const classId=actor.classId;
       return()=>request(actor,`versao-mural-c${concurrency}`,'GET',`/api/turmas/${classId}/mural/versao`);
    }),concurrency);
    const elapsed=performance.now()-started;
    burst[`concorrencia${concurrency}`]={requests,elapsedMs:round(elapsed),throughputPerSecond:round(requests/(elapsed/1000))};
  }

  const counts={
    professors:Number(db.prepare("SELECT COUNT(*) AS total FROM users WHERE email LIKE 'professor.carga.%@example.test'").get().total),
    students:Number(db.prepare("SELECT COUNT(*) AS total FROM users WHERE email LIKE 'aluno.carga.%@example.test'").get().total),
    classes:Number(db.prepare("SELECT COUNT(*) AS total FROM classes WHERE label LIKE 'Turma Carga %'").get().total),
    calls:Number(db.prepare("SELECT COUNT(*) AS total FROM attendance_sessions ats JOIN classes c ON c.id=ats.class_id WHERE c.label LIKE 'Turma Carga %'").get().total),
    attendanceRecords:Number(db.prepare("SELECT COUNT(*) AS total FROM attendance_records ar JOIN attendance_sessions ats ON ats.id=ar.session_id JOIN classes c ON c.id=ats.class_id WHERE c.label LIKE 'Turma Carga %'").get().total),
    wallPosts:Number(db.prepare("SELECT COUNT(*) AS total FROM student_course_announcements sca JOIN classes c ON c.id=sca.class_id WHERE c.label LIKE 'Turma Carga %'").get().total),
    comments:Number(db.prepare("SELECT COUNT(*) AS total FROM course_post_comments cc JOIN student_course_announcements sca ON sca.announcement_id=cc.announcement_id JOIN classes c ON c.id=sca.class_id WHERE c.label LIKE 'Turma Carga %'").get().total),
    likes:Number(db.prepare("SELECT COUNT(*) AS total FROM course_post_likes cl JOIN student_course_announcements sca ON sca.announcement_id=cl.announcement_id JOIN classes c ON c.id=sca.class_id WHERE c.label LIKE 'Turma Carga %'").get().total),
    attachments:Number(db.prepare("SELECT COUNT(*) AS total FROM announcement_attachments").get().total),
    managerNotices:Number(db.prepare("SELECT COUNT(*) AS total FROM announcements WHERE title LIKE 'Informativo de carga %'").get().total),
    notificationEmails:Number(db.prepare("SELECT COUNT(*) AS total FROM dev_emails WHERE subject LIKE 'Nova publicação — %' OR subject LIKE 'Nova mensagem — %' OR subject LIKE '%curtiu sua publicação'").get().total),
    notificationOutbox:Number(db.prepare("SELECT COUNT(*) AS total FROM notification_outbox").get().total),
  };
  const expectedPosts=posts.length+1,expectedComments=posts.length*COMMENTS_PER_POST+20,expectedLikes=posts.length*LIKES_PER_POST+20;
  assert.deepEqual({...counts,attachments:undefined,notificationEmails:undefined,notificationOutbox:undefined},{professors:PROFESSORS,students:STUDENTS,classes:CLASSES,calls:CLASSES*CALLS_PER_CLASS,attendanceRecords:STUDENTS*CALLS_PER_CLASS,wallPosts:expectedPosts,comments:expectedComments,likes:expectedLikes,attachments:undefined,managerNotices:MANAGER_NOTICES,notificationEmails:undefined,notificationOutbox:undefined});
  const smallGroupNotifications=posts.length*(COMMENTS_PER_POST+1)*(STUDENTS/CLASSES+1)+posts.length*LIKES_PER_POST;
  const largeGroupNotifications=(STUDENTS+1)+20*(STUDENTS+1)+20;
  assert.equal(counts.notificationOutbox,smallGroupNotifications+largeGroupNotifications,'A outbox deve conter um evento deduplicado por destinatário.');
  assert.equal(counts.notificationEmails,0,'Interações do mural não devem gerar uma tempestade de e-mails.');

  const indexInventory=Object.fromEntries(['enrollments','student_course_announcements','course_post_comments','course_post_likes','attendance_sessions','attendance_records','announcements'].map(table=>[table,db.prepare(`PRAGMA index_list(${table})`).all().map(row=>row.name)]));
  const queryPlans={
    mural:db.prepare('EXPLAIN QUERY PLAN SELECT announcement_id FROM student_course_announcements WHERE class_id=? ORDER BY announcement_id DESC LIMIT 5').all(classes[0].id).map(row=>row.detail),
    comments:db.prepare('EXPLAIN QUERY PLAN SELECT id FROM course_post_comments WHERE announcement_id=? ORDER BY created_at DESC LIMIT 20').all(posts[0].id).map(row=>row.detail),
    enrollments:db.prepare("EXPLAIN QUERY PLAN SELECT student_id FROM enrollments WHERE class_id=? AND status='ativa'").all(classes[0].id).map(row=>row.detail),
    attendance:db.prepare('EXPLAIN QUERY PLAN SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').all(classes[0].id,'2026-06-01').map(row=>row.detail),
  };
  const databaseBytes=(await stat(databasePath)).size;
  const errorResponses=samples.filter(item=>item.status>=400&&!['bloquear-anexo-outra-turma','bloquear-mural-outra-turma','bloquear-professor-outra-turma','bloquear-publicacao-gestor'].includes(item.label));
  assert.equal(errorResponses.length,0,JSON.stringify(errorResponses));

  const result={
    environment:'Node local + SQLite isolado (não produção)',
    configuration:{professors:PROFESSORS,students:STUDENTS,classes:CLASSES,httpConcurrency:HTTP_CONCURRENCY,callsPerClass:CALLS_PER_CLASS,posts:expectedPosts,comments:expectedComments,likes:expectedLikes,managerNotices:MANAGER_NOTICES,largeGroupStudents:STUDENTS},
    counts,
    phaseTimesMs:phaseTimes,
    endpointMetrics:summarize(samples),
    readBursts:burst,
    isolationChecks:{authorizedAttachment:200,crossClassAttachment:404,crossClassStudentWall:404,crossClassProfessorWall:404,managerPosting:403},
    logicalObservations:{historicAttendanceRoster:historicRosterObservation},
    database:{bytes:databaseBytes,indexInventory,queryPlans},
    totalRequests:samples.length,
    unexpectedHttpErrors:errorResponses.length,
  };
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}finally{
  try{db?.close();}catch{}
  if(server&&!server.killed){server.kill('SIGTERM');await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);}
  await rm(directory,{recursive:true,force:true});
}
