import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { startTestServer } from './test-support/server.mjs';

test('MFA do gestor e consumo atômico do reset impedem repetição', {timeout:20_000}, async()=>{
  const app = await startTestServer({ env: { REQUIRE_MANAGER_MFA: 'true' } });
  const request = (path, body) => app.call(null, 'POST', path, body);
  let db;
  try{
    db=new DatabaseSync(app.databasePath);
    const first=await request('/api/auth/login',{email:'gestor@projetoaprendiz.local',password:'Gestor@2026!',remember:true});
    assert.equal(first.status,202,JSON.stringify(first.data));assert.equal(first.data.mfaRequired,true);assert.equal(first.cookie,null);
    const mail=db.prepare("SELECT body FROM dev_emails WHERE subject LIKE 'Código de verificação%' ORDER BY id DESC LIMIT 1").get();
    assert.match(mail.body,/Detalhes da solicitação/);
    assert.match(mail.body,/Data e horário \(Brasília\):/);
    assert.match(mail.body,/Endereço IP: (?:127\.0\.0\.1|::ffff:127\.0\.0\.1)/);
    assert.match(mail.body,/Localização aproximada pelo IP: Não disponível/);
    assert.match(mail.body,/não use nem compartilhe/);
    const code=mail.body.match(/\b\d{6}\b/)[0];
    assert.equal((await request('/api/auth/mfa/verify',{challengeToken:first.data.challengeToken,code:'000000'})).status,401);
    const verified=await request('/api/auth/mfa/verify',{challengeToken:first.data.challengeToken,code});
    assert.equal(verified.status,200,JSON.stringify(verified.data));assert.match(String(verified.cookie),/pa_session=/);
    assert.equal((await request('/api/auth/mfa/verify',{challengeToken:first.data.challengeToken,code})).status,400);

    assert.equal((await request('/api/auth/forgot-password',{email:'professor@projetoaprendiz.local'})).status,200);
    const resetMail=db.prepare("SELECT body FROM dev_emails WHERE subject LIKE 'Recuperação de senha%' ORDER BY id DESC LIMIT 1").get();
    const resetUrl=new URL(resetMail.body.match(/http:\/\/\S+/)[0]);
    const token=new URLSearchParams(resetUrl.hash.slice(1)).get('token');
    const attempts=await Promise.all([
      request('/api/auth/reset-password',{token,password:'SenhaNovaA@2026!'}),
      request('/api/auth/reset-password',{token,password:'SenhaNovaB@2026!'}),
    ]);
    assert.deepEqual(attempts.map(item=>item.status).sort((a,b)=>a-b),[200,400]);
    const successfulPassword=attempts[0].status===200?'SenhaNovaA@2026!':'SenhaNovaB@2026!';
    const professorLogin=await request('/api/auth/login',{email:'professor@projetoaprendiz.local',password:successfulPassword});
    assert.equal(professorLogin.status,200,JSON.stringify(professorLogin.data));
  } finally {
    db?.close();
    await app.close();
  }
});
