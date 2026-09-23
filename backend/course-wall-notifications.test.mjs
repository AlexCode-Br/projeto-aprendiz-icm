import assert from 'node:assert/strict';
import test from 'node:test';
import { courseWallDestination, notifyCourseWallGroup, notifyCourseWallLike } from './course-wall-notifications.mjs';

test('destino do mural abre a turma correta para cada perfil',()=>{
  assert.equal(courseWallDestination('aluno',12),'/aluno/cursos/12?view=mural');
  assert.equal(courseWallDestination('professor',12),'/professor/turmas?turma=12');
  assert.equal(courseWallDestination('gestor',12),'/gestor/cursos?turma=12');
});

test('nova publicação e comentário notificam o grupo, menos quem realizou a ação',async()=>{
  const deliveries=[];
  const db={prepare:()=>({all:async()=>[
    {user_id:1,role:'professor'},
    {user_id:2,role:'aluno'},
    {user_id:3,role:'gestor'},
  ]})};
  const notificationService={notifyUser:async(...args)=>{deliveries.push(args);return{sent:true};}};
  const logger={error(){}};
  await notifyCourseWallGroup({db,notificationService,logger,classId:8,courseName:'Canto Coral',actorUserId:2,actorName:'Ana',event:'post',eventId:41});
  assert.deepEqual(deliveries.map(item=>[item[0],item[1],item[5].destination]),[
    [1,'wallPosts','/professor/turmas?turma=8'],
    [3,'wallPosts','/gestor/cursos?turma=8'],
  ]);
  assert.ok(deliveries.every(item=>item[2]==='Nova publicação — Canto Coral'&&item[3].includes('Ana')));
  deliveries.length=0;
  await notifyCourseWallGroup({db,notificationService,logger,classId:8,courseName:'Canto Coral',actorUserId:1,actorName:'Prof. Bruno',event:'comment',eventId:'comment-1'});
  assert.deepEqual(deliveries.map(item=>[item[0],item[1],item[5].destination]),[
    [2,'wallComments','/aluno/cursos/8?view=mural'],
    [3,'wallComments','/gestor/cursos?turma=8'],
  ]);
});

test('curtida avisa somente o autor da publicação e ignora autocurtida',async()=>{
  const deliveries=[];
  const notificationService={notifyUser:async(...args)=>{deliveries.push(args);return{sent:true};}};
  const input={notificationService,classId:4,courseName:'Teclado',postId:72,ownerUserId:9,ownerRole:'aluno',actorUserId:5,actorName:'Marina'};
  await notifyCourseWallLike(input);
  assert.deepEqual(deliveries.map(item=>[item[0],item[1],item[2],item[5].destination]),[[9,'wallLikes','Marina curtiu sua publicação','/aluno/cursos/4?view=mural']]);
  await notifyCourseWallLike({...input,actorUserId:9});
  assert.equal(deliveries.length,1);
});
