import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');

test('MFA do gestor e consumo atômico do reset impedem repetição', {timeout:20_000}, async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aprendiz-auth-security-'));
  const databasePath=join(directory,'auth.db'),port=58_000+(process.pid%500),base=`http://127.0.0.1:${port}`;
  let output='';
  let db;
  const server=spawn(process.execPath,['backend/server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',APP_URL:base,SQLITE_PATH:databasePath,AUTH_PROVIDER:'local',SEED_DEMO_DATA:'true',NODE_ENV:'test',REQUIRE_MANAGER_MFA:'true'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>{output+=chunk;});server.stderr.on('data',chunk=>{output+=chunk;});
  const request=async(path,body)=>{const response=await fetch(`${base}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});return{status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')};};
  try{
    for(let attempt=0;attempt<80;attempt+=1){try{if((await fetch(`${base}/api/health`)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));if(attempt===79)throw new Error(output);}
    db=new DatabaseSync(databasePath);
    const first=await request('/api/auth/login',{email:'gestor@projetoaprendiz.local',password:'Gestor@2026!',remember:true});
    assert.equal(first.status,202,JSON.stringify(first.data));assert.equal(first.data.mfaRequired,true);assert.equal(first.cookie,null);
    const mail=db.prepare("SELECT body FROM dev_emails WHERE subject LIKE 'Código de verificação%' ORDER BY id DESC LIMIT 1").get();
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
  }finally{
    db?.close();
    if(server.exitCode===null)server.kill('SIGTERM');
    if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
