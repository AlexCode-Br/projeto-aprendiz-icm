import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmailService } from './email.mjs';

test('serviço de e-mail mantém a caixa local e não chama o provedor em desenvolvimento',async()=>{
  const rows=[];
  const db={prepare:()=>({run:async(...params)=>{rows.push(params);}})};
  const {sendEmail}=createEmailService({db,isProduction:false,fetchImpl:()=>{throw new Error('não deve chamar fetch');}});
  assert.deepEqual(await sendEmail('professor@example.com','Convite','Conteúdo','convite-1'),{local:true});
  assert.deepEqual(rows,[['professor@example.com','Convite','Conteúdo']]);
});

test('serviço de e-mail envia chave idempotente ao provedor',async()=>{
  const previousKey=process.env.RESEND_API_KEY,previousFrom=process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY='re_test';process.env.EMAIL_FROM='Projeto <teste@example.com>';
  let request;
  try{
    const {sendEmail}=createEmailService({db:{},isProduction:true,fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>({id:'email-1'})};}});
    assert.deepEqual(await sendEmail('professor@example.com','Convite','Conteúdo','convite-1'),{id:'email-1'});
    assert.equal(request.options.headers['Idempotency-Key'],'convite-1');
    assert.deepEqual(JSON.parse(request.options.body).to,['professor@example.com']);
  }finally{
    if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey;
    if(previousFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=previousFrom;
  }
});
