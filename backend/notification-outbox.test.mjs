import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {createDatabase} from './database.mjs';
import {initializeNodeApplication} from './node-startup.mjs';
import {createNotificationOutbox} from './notification-outbox.mjs';

test('outbox agrupa, deduplica e entrega o mural apenas por push',{timeout:20_000},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aprendiz-outbox-'));
  const db=await createDatabase({sqlitePath:join(directory,'outbox.db')});
  try{
    await initializeNodeApplication({db,env:{NODE_ENV:'test',AUTH_PROVIDER:'local',SEED_DEMO_DATA:'false'}});
    const user=(await db.prepare("SELECT id FROM users WHERE active=1 ORDER BY id LIMIT 1").get())||
      {id:(await db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES ('Aluno','aluno-outbox@example.com','x','aluno')").run()).lastInsertRowid};
    await db.prepare("INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth) VALUES (?,?,?,?)").run(user.id,'https://fcm.googleapis.com/test','key','auth');
    const calls=[];
    const outbox=createNotificationOutbox({db,notificationService:{notifyUser:async(...args)=>{calls.push(args);return{sent:true,channels:{email:false,push:true}};}}});
    const item={userId:user.id,preference:'wallPosts',subject:'Nova publicação',body:'Mensagem',destination:'/aluno/cursos/1?view=mural',idempotencyKey:'wall/post/1/user',tag:'course-wall/1',channels:{email:false,push:true}};
    assert.equal((await outbox.enqueueMany([item,item])).queued,1);
    assert.deepEqual(await outbox.drain(),{processed:1,delivered:1});
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0][5],{destination:item.destination,tag:item.tag,channels:item.channels});
    const row=await db.prepare('SELECT status,attempts FROM notification_outbox WHERE idempotency_key=?').get(item.idempotencyKey);
    assert.equal(row.status,'sent');
    assert.equal(Number(row.attempts),1);
    assert.deepEqual(await outbox.drain(),{processed:0,delivered:0});
  }finally{await db.close();await rm(directory,{recursive:true,force:true});}
});
