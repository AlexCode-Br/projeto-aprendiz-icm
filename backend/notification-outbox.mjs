import {normalizeNotificationPreferences} from './notifications.mjs';

const MAX_ATTEMPTS=5;
const BATCH_SIZE=50;
const CONCURRENCY=8;

const iso=value=>new Date(value).toISOString();
const retryDelay=attempt=>Math.min(60*60_000,15_000*(2**Math.max(0,attempt-1)));

async function mapConcurrent(items,limit,worker){
  let cursor=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(cursor<items.length){const index=cursor++;await worker(items[index]);}
  });
  await Promise.all(runners);
}

export function createNotificationOutbox({db,notificationService,logger=console,scheduleDrain}={}){
  if(!db||!notificationService)throw new TypeError('Banco e serviço de notificações são obrigatórios.');

  async function enqueueMany(items){
    if(!items.length)return{queued:0};
    const availableAt=iso(Date.now());
    const values=items.map(()=>"(?,?,?,?,?,?,?,?,?,'pending',?)").join(',');
    const params=items.flatMap(item=>[
      Number(item.userId),item.preference,item.subject,item.body,item.destination,item.idempotencyKey,
      item.tag||item.idempotencyKey,item.channels?.email===false?0:1,item.channels?.push===false?0:1,availableAt,
    ]);
    const result=await db.prepare(`INSERT INTO notification_outbox
      (user_id,preference,subject,body,destination,idempotency_key,notification_tag,email_enabled,push_enabled,status,available_at)
      VALUES ${values} ON CONFLICT(idempotency_key) DO NOTHING`).run(...params);
    const queued=Number(result.changes||0);
    if(queued&&scheduleDrain)try{scheduleDrain();}catch(error){logger.error('notification_outbox_schedule_failed',error,{queued});}
    return {queued};
  }

  async function claim(limit=BATCH_SIZE){
    const now=iso(Date.now()),leaseUntil=iso(Date.now()+2*60_000);
    return db.transaction(async()=>{
      const locking=db.dialect==='postgres'?' FOR UPDATE SKIP LOCKED':'';
      const rows=await db.prepare(`SELECT * FROM notification_outbox
        WHERE ((status='pending' AND available_at<=?) OR (status='processing' AND lease_until<?))
          AND attempts<? ORDER BY id LIMIT ?${locking}`).all(now,now,MAX_ATTEMPTS,limit);
      if(rows.length){
        const placeholders=rows.map(()=>'?').join(',');
        await db.prepare(`UPDATE notification_outbox
          SET status='processing',attempts=attempts+1,lease_until=?,updated_at=CURRENT_TIMESTAMP
          WHERE id IN (${placeholders})`).run(leaseUntil,...rows.map(row=>row.id));
      }
      return rows.map(row=>({...row,attempts:Number(row.attempts||0)+1}));
    });
  }

  async function finish(row,error){
    if(!error)return db.prepare("UPDATE notification_outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,lease_until=NULL,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
    const message=String(error?.message||error).slice(0,500);
    if(row.attempts>=MAX_ATTEMPTS)return db.prepare("UPDATE notification_outbox SET status='dead',lease_until=NULL,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(message,row.id);
    return db.prepare("UPDATE notification_outbox SET status='pending',available_at=?,lease_until=NULL,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(iso(Date.now()+retryDelay(row.attempts)),message,row.id);
  }

  async function deliver(row){
    try{
      const result=await notificationService.notifyUser(row.user_id,row.preference,row.subject,row.body,row.idempotency_key,{
        destination:row.destination,
        tag:row.notification_tag,
        channels:{email:Boolean(row.email_enabled),push:Boolean(row.push_enabled)},
      });
      if(!result.sent&&!['disabled','not_subscribed','not_configured','expired'].includes(result.reason))throw new Error(`notification_${result.reason||'delivery_failed'}`);
      await finish(row);
      return true;
    }catch(error){
      logger.error('notification_outbox_delivery_failed',error,{outboxId:Number(row.id),userId:Number(row.user_id),attempt:Number(row.attempts)});
      await finish(row,error);
      return false;
    }
  }

  async function preflight(rows){
    if(!rows.length)return{deliverable:[],skipped:[]};
    const userIds=[...new Set(rows.map(row=>Number(row.user_id)))],placeholders=userIds.map(()=>'?').join(',');
    const [users,settings,subscriptions]=await Promise.all([
      db.prepare(`SELECT id,active FROM users WHERE id IN (${placeholders})`).all(...userIds),
      db.prepare(`SELECT user_id,preferences_json FROM user_settings WHERE user_id IN (${placeholders})`).all(...userIds),
      db.prepare(`SELECT DISTINCT user_id FROM push_subscriptions WHERE user_id IN (${placeholders})`).all(...userIds),
    ]);
    const active=new Set(users.filter(user=>Boolean(user.active)).map(user=>Number(user.id)));
    const preferences=new Map(settings.map(item=>{
      let parsed={};try{parsed=JSON.parse(item.preferences_json||'{}');}catch{}
      return[Number(item.user_id),normalizeNotificationPreferences(parsed)];
    }));
    const subscribed=new Set(subscriptions.map(item=>Number(item.user_id)));
    const skipped=[],deliverable=[];
    for(const row of rows){
      const userId=Number(row.user_id),enabled=(preferences.get(userId)||normalizeNotificationPreferences({}))[row.preference]!==false;
      if(!active.has(userId)||!enabled||(!Boolean(row.email_enabled)&&Boolean(row.push_enabled)&&!subscribed.has(userId)))skipped.push(row);
      else deliverable.push(row);
    }
    return{deliverable,skipped};
  }

  async function drain({limit=BATCH_SIZE}={}){
    const rows=await claim(Math.max(1,Math.min(200,Number(limit)||BATCH_SIZE)));
    const {deliverable,skipped}=await preflight(rows);
    if(skipped.length){
      const placeholders=skipped.map(()=>'?').join(',');
      await db.prepare(`UPDATE notification_outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,lease_until=NULL,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...skipped.map(row=>row.id));
    }
    let delivered=skipped.length;
    await mapConcurrent(deliverable,CONCURRENCY,async row=>{if(await deliver(row))delivered+=1;});
    return {processed:rows.length,delivered};
  }

  return {enqueueMany,drain};
}

export const notificationOutboxInternals={retryDelay,mapConcurrent,MAX_ATTEMPTS,BATCH_SIZE,CONCURRENCY};
