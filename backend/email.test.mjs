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
  const previousKey=process.env.RESEND_API_KEY,previousFrom=process.env.EMAIL_FROM,previousReply=process.env.EMAIL_REPLY_TO,previousLogo=process.env.EMAIL_LOGO_URL,previousIcmLogo=process.env.EMAIL_ICM_LOGO_URL;
  process.env.RESEND_API_KEY='re_test';
  process.env.EMAIL_FROM='teste@example.com';
  process.env.EMAIL_REPLY_TO='contato@example.com';
  process.env.EMAIL_LOGO_URL='https://example.com/logo.png';
  process.env.EMAIL_ICM_LOGO_URL='https://example.com/icm-logo.png';
  let request;
  try{
    const {sendEmail}=createEmailService({db:{},isProduction:true,fetchImpl:async(url,options)=>{request={url,options};return{ok:true,json:async()=>({id:'email-1'})};}});
    assert.deepEqual(await sendEmail('professor@example.com','Convite <especial>','Acesse https://example.com/convite\n\n<script>não executar</script>','convite-1'),{id:'email-1'});
    assert.equal(request.options.headers['Idempotency-Key'],'convite-1');
    const payload=JSON.parse(request.options.body);
    assert.deepEqual(payload.to,['professor@example.com']);
    assert.equal(payload.from,'Projeto Aprendiz <teste@example.com>');
    assert.equal(payload.reply_to,'contato@example.com');
    assert.match(payload.html,/https:\/\/example\.com\/logo\.png/);
    assert.match(payload.html,/https:\/\/example\.com\/icm-logo\.png/);
    assert.match(payload.html,/Igreja Cristã Maranata/);
    assert.match(payload.html,/Acessar o Projeto Aprendiz/);
    assert.match(payload.html,/Convite &lt;especial&gt;/);
    assert.match(payload.html,/<a href="https:\/\/example\.com\/convite"/);
    assert.doesNotMatch(payload.html,/<script>/);
    assert.equal(payload.text,'Acesse https://example.com/convite\n\n<script>não executar</script>');
  }finally{
    if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey;
    if(previousFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=previousFrom;
    if(previousReply===undefined)delete process.env.EMAIL_REPLY_TO;else process.env.EMAIL_REPLY_TO=previousReply;
    if(previousLogo===undefined)delete process.env.EMAIL_LOGO_URL;else process.env.EMAIL_LOGO_URL=previousLogo;
    if(previousIcmLogo===undefined)delete process.env.EMAIL_ICM_LOGO_URL;else process.env.EMAIL_ICM_LOGO_URL=previousIcmLogo;
  }
});

test('serviço usa o remetente oficial quando EMAIL_FROM não está definido',async()=>{
  const previousKey=process.env.RESEND_API_KEY,previousFrom=process.env.EMAIL_FROM;
  process.env.RESEND_API_KEY='re_test';
  delete process.env.EMAIL_FROM;
  let request;
  try{
    const {sendEmail}=createEmailService({db:{},isProduction:true,fetchImpl:async(_url,options)=>{request=options;return{ok:true,json:async()=>({id:'email-2'})};}});
    await sendEmail('aluno@example.com','Aviso','Olá.');
    assert.equal(JSON.parse(request.body).from,'Projeto Aprendiz <naoresponda@aprendizicm.com.br>');
  }finally{
    if(previousKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previousKey;
    if(previousFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=previousFrom;
  }
});
