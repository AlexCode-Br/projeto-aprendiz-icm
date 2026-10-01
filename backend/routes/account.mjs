import { normalizePushSubscription } from '../web-push.mjs';

export function createAccountRoutes(context) {
  const { db, json, usesSupabaseAuth, readJson, cleanEmail, verifyPassword, publicUser, strongPassword, hashPassword, authorize, cleanText, personNameError, hasValidationErrors, invalid, notificationService, webPushService, normalizeNotificationPreferences, profilePhotoStorage, logger, userFromSupabaseToken, cookie, supabaseAdmin, requireSupabaseAdmin, randomBytes, verifyUserPassword, consumeActionRateLimit, rateLimitResponse, managerMfaRequired } = context;
  const pushDeviceView = row => ({
    id: Number(row.id), userAgent: row.user_agent || '', createdAt: row.created_at, updatedAt: row.updated_at,
  });
  return async function route(request, response, url, ip) {
    if(request.method==='GET'&&url.pathname==='/api/account'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const preferences=await notificationService.preferencesFor(session.user_id);
      let photoOwnerType='user',photoOwnerId=Number(session.user_id);
      if(session.role==='professor'){
        const profile=await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
        photoOwnerType='professor';photoOwnerId=Number(profile?.id||0);
      }
      if(session.role==='aluno'){photoOwnerType='student';photoOwnerId=session.student_id;}
      const photo=photoOwnerId?await db.prepare('SELECT updated_at FROM profile_photos WHERE owner_type=? AND owner_id=?').get(photoOwnerType,photoOwnerId):null;
      return json(response,200,{user:publicUser({id:session.user_id,...session}),preferences,photoUrl:photo?`/api/profile-photo?v=${encodeURIComponent(photo.updated_at)}`:'',mfaVerified:Boolean(session.mfa_verified_at)});
    }
    if(request.method==='GET'&&url.pathname==='/api/account/sessions'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const rows=await db.prepare('SELECT id,user_agent,created_at,last_seen_at,expires_at FROM sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen_at DESC,id DESC').all(session.user_id,new Date().toISOString());
      return json(response,200,{items:rows.map(row=>({id:Number(row.id),userAgent:row.user_agent||'',createdAt:row.created_at,lastSeenAt:row.last_seen_at||row.created_at,expiresAt:row.expires_at,current:Number(row.id)===Number(session.id)}))});
    }
    const sessionDeleteMatch=url.pathname.match(/^\/api\/account\/sessions\/(\d+)$/);
    if(request.method==='DELETE'&&sessionDeleteMatch){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const sessionId=Number(sessionDeleteMatch[1]);
      const removed=await db.prepare('DELETE FROM sessions WHERE id=? AND user_id=? AND id<>?').run(sessionId,session.user_id,session.id);
      if(!removed.changes)return json(response,404,{message:'Sessão não encontrada ou já encerrada.'});
      await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`session_revoked:${sessionId}`,ip);
      return json(response,200,{success:true,message:'Sessão encerrada.'});
    }
    if(request.method==='PUT'&&url.pathname==='/api/account/profile'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const body=await readJson(request),name=cleanText(body.nome,100);
      const errors={nome:personNameError(name,'nome completo')};
      if(hasValidationErrors(errors))return invalid(response,errors);
      await db.transaction(async () => {
        await db.prepare('UPDATE users SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,session.user_id);
        if(session.role==='aluno')await db.prepare('UPDATE students SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,session.student_id);
        if(session.role==='professor')await db.prepare('UPDATE professor_profiles SET name=? WHERE user_id=?').run(name,session.user_id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'profile_updated',ip);
      });
      return json(response,200,{user:{id:session.user_id,nome:name,email:session.email,role:session.role}});
    }
    if(request.method==='PUT'&&url.pathname==='/api/account/password'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      if(usesSupabaseAuth)return json(response,409,{message:'A senha desta conta é gerenciada pelo Supabase.'});
      const body=await readJson(request),user=await db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
      if(!(await verifyPassword(body.currentPassword,user.password_hash)))return json(response,400,{message:'A senha atual está incorreta.'});
      if(!strongPassword(body.newPassword))return json(response,400,{message:'A nova senha não atende aos requisitos de segurança.'});
      const passwordHash=await hashPassword(body.newPassword);
      await db.transaction(async()=>{
        await db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(passwordHash,session.user_id);
        await db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').run(session.user_id,session.id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'password_changed',ip);
      });
      await notificationService.notifyUser(session.user_id,'systemAlerts','Sua senha foi alterada','A senha de acesso da sua conta foi alterada. Se não reconhece esta ação, entre em contato com a administração imediatamente.',`password-change/${session.user_id}/${Date.now()}`);
      return json(response,200,{message:'Senha alterada com sucesso.'});
    }
    if(request.method==='PUT'&&url.pathname==='/api/account/preferences'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const body=await readJson(request),preferences=normalizeNotificationPreferences(body.preferences);
      await db.prepare(`INSERT INTO user_settings (user_id,preferences_json) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,updated_at=CURRENT_TIMESTAMP`).run(session.user_id,JSON.stringify(preferences));
      return json(response,200,{preferences});
    }
    if(request.method==='POST'&&url.pathname==='/api/account/preferences/test'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const actionLimit=await consumeActionRateLimit({route:'notification_email_test',userId:session.user_id,ip,limit:3,windowMs:15*60_000});
      if(actionLimit.blocked)return rateLimitResponse(response,actionLimit);
      try{
        await context.sendEmail(session.email,'Teste de notificações — Projeto Aprendiz',`Olá, ${session.name}.\n\nAs notificações por e-mail da sua conta estão funcionando corretamente.\n\nProjeto Aprendiz`,`notification-test/${session.user_id}/${Date.now()}`);
        return json(response,200,{message:'E-mail de teste enviado com sucesso.'});
      }catch(error){logger.error('notification_test_failed',error,{userId:session.user_id});return json(response,502,{message:'Não foi possível enviar o e-mail de teste. Revise a configuração do remetente.'});}
    }
    if(request.method==='GET'&&url.pathname==='/api/account/push'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const configuration=await webPushService.configuration();
      const devices=await db.prepare('SELECT id,user_agent,created_at,updated_at FROM push_subscriptions WHERE user_id=? ORDER BY updated_at DESC,id DESC').all(session.user_id);
      return json(response,200,{...configuration,subscriptions:devices.length,devices:devices.map(pushDeviceView)});
    }
    if(request.method==='POST'&&url.pathname==='/api/account/push/subscribe'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const configuration=await webPushService.configuration();
      if(!configuration.configured)return json(response,503,{message:'As notificações no dispositivo ainda não estão configuradas no servidor.'});
      const body=await readJson(request),subscription=normalizePushSubscription(body.subscription);
      if(subscription.error)return invalid(response,{subscription:subscription.error});
      const userAgent=cleanText(request.headers['user-agent'],500);
      const existing=await db.prepare('SELECT user_id,p256dh,auth FROM push_subscriptions WHERE endpoint=?').get(subscription.endpoint);
      await db.prepare(`INSERT INTO push_subscriptions (user_id,endpoint,p256dh,auth,user_agent)
        VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=CURRENT_TIMESTAMP`)
        .run(session.user_id,subscription.endpoint,subscription.p256dh,subscription.auth,userAgent);
      if(!existing||Number(existing.user_id)!==Number(session.user_id)||existing.p256dh!==subscription.p256dh||existing.auth!==subscription.auth){
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'push_notifications_enabled',ip);
      }
      const device=await db.prepare('SELECT id,user_agent,created_at,updated_at FROM push_subscriptions WHERE user_id=? AND endpoint=?').get(session.user_id,subscription.endpoint);
      return json(response,200,{success:true,message:'Notificações ativadas neste dispositivo.',device:pushDeviceView(device)});
    }
    if(request.method==='POST'&&url.pathname==='/api/account/push/unsubscribe'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const body=await readJson(request),endpoint=String(body.endpoint||'').trim();
      if(!endpoint||endpoint.length>2048)return invalid(response,{subscription:'Assinatura de notificações inválida.'});
      await db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(session.user_id,endpoint);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'push_notifications_disabled',ip);
      return json(response,200,{success:true,message:'Notificações desativadas neste dispositivo.'});
    }
    const pushDeviceMatch=url.pathname.match(/^\/api\/account\/push\/devices\/(\d+)$/);
    if(request.method==='DELETE'&&pushDeviceMatch){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const deviceId=Number(pushDeviceMatch[1]);
      const device=await db.prepare('SELECT id FROM push_subscriptions WHERE id=? AND user_id=?').get(deviceId,session.user_id);
      if(!device)return json(response,404,{message:'Este dispositivo não está mais conectado.'});
      await db.prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=?').run(deviceId,session.user_id);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`push_device_removed:${deviceId}`,ip);
      return json(response,200,{success:true,message:'Dispositivo removido das notificações.'});
    }
    if(request.method==='POST'&&url.pathname==='/api/account/push/test'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const actionLimit=await consumeActionRateLimit({route:'notification_push_test',userId:session.user_id,ip,limit:3,windowMs:15*60_000});
      if(actionLimit.blocked)return rateLimitResponse(response,actionLimit);
      const result=await webPushService.sendToUser(session.user_id,{title:'Teste de notificações — Projeto Aprendiz',body:'As notificações deste dispositivo estão funcionando corretamente.',tag:`push-test/${session.user_id}/${Date.now()}`,url:'/configuracoes'});
      if(!result.sent)return json(response,result.reason==='not_configured'?503:409,{message:result.reason==='not_subscribed'?'Ative as notificações neste dispositivo antes de testar.':'Não foi possível entregar a notificação de teste neste dispositivo.'});
      return json(response,200,{message:`Notificação enviada para ${result.delivered} ${result.delivered===1?'dispositivo':'dispositivos'}.`});
    }
    if(request.method==='POST'&&url.pathname==='/api/account/password-changed'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      if(!usesSupabaseAuth)return json(response,404,{message:'Rota não disponível.'});
      const authenticatedUser=await userFromSupabaseToken(request);
      if(!authenticatedUser||Number(authenticatedUser.id)!==Number(session.user_id))return json(response,401,{message:'Confirme novamente sua identidade para concluir a alteração.'});
      await db.transaction(async()=>{
        await db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').run(session.user_id,session.id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'password_changed',ip);
      });
      await notificationService.notifyUser(session.user_id,'systemAlerts','Sua senha foi alterada','A senha de acesso da sua conta foi alterada. Se não reconhece esta ação, entre em contato com a administração imediatamente.',`supabase-password-change/${session.user_id}/${Date.now()}`);
      return json(response,200,{success:true});
    }
    if(request.method==='POST'&&url.pathname==='/api/account/delete'){
      const session=await authorize(request,response,['gestor','professor','aluno']);if(!session)return;
      const body=await readJson(request);
      if(cleanEmail(body.confirmation)!==cleanEmail(session.email))return invalid(response,{confirmation:'Digite o e-mail completo da conta para confirmar.'});
      if(!await verifyUserPassword(session.user_id,String(body.currentPassword||'')))return invalid(response,{currentPassword:'Informe a senha atual corretamente para confirmar.'});
      if(session.role==='gestor'&&managerMfaRequired&&!session.mfa_verified_at)return json(response,403,{message:'Entre novamente e conclua a verificação em duas etapas antes de excluir esta conta.'});
      if(usesSupabaseAuth&&!requireSupabaseAdmin(response))return;
      if(session.role==='gestor'){
        const managers=await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='gestor' AND active=1").get();
        if(Number(managers?.total||0)<=1)return json(response,409,{message:'A última conta de gestor não pode ser excluída. Cadastre outro gestor antes de continuar.'});
      }
      const account=await db.prepare('SELECT auth_user_id FROM users WHERE id=? AND active=1').get(session.user_id);
      const professor=session.role==='professor'?await db.prepare('SELECT id FROM professor_profiles WHERE user_id=?').get(session.user_id):null;
      const ownerType=professor?'professor':'user',ownerId=Number(professor?.id||session.user_id);
      const photo=await db.prepare('SELECT storage_path FROM profile_photos WHERE owner_type=? AND owner_id=?').get(ownerType,ownerId);
      const replacementPassword=await hashPassword(randomBytes(48).toString('base64url'));
      await db.transaction(async()=>{
        await db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(session.user_id);
        await db.prepare('DELETE FROM user_settings WHERE user_id=?').run(session.user_id);
        await db.prepare('DELETE FROM password_resets WHERE user_id=?').run(session.user_id);
        await db.prepare('DELETE FROM profile_photos WHERE owner_type=? AND owner_id=?').run(ownerType,ownerId);
        if(session.role==='aluno')await db.prepare('DELETE FROM student_accounts WHERE user_id=?').run(session.user_id);
        if(professor)await db.prepare("UPDATE professor_profiles SET user_id=NULL,name='Professor removido #' || id,email='professor-removido-' || id || '@deleted.invalid',phone=NULL,home_location_id=NULL,active=0 WHERE id=?").run(professor.id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'account_deleted',ip);
        await db.prepare("UPDATE users SET auth_user_id=NULL,name='Conta excluída',email='conta-removida-' || id || '@deleted.invalid',password_hash=?,active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(replacementPassword,session.user_id);
        await db.prepare('DELETE FROM sessions WHERE user_id=?').run(session.user_id);
      });
      await profilePhotoStorage.removePaths([photo?.storage_path]);
      if(usesSupabaseAuth&&account?.auth_user_id){
        const {error}=await supabaseAdmin.auth.admin.deleteUser(account.auth_user_id);
        if(error)logger.error('account_auth_deletion_failed',error,{userId:session.user_id});
      }
      return json(response,200,{success:true,message:session.role==='aluno'?'Acesso excluído. O cadastro acadêmico permanece sob responsabilidade da gestão.':'Sua conta foi excluída e seus dados pessoais foram removidos.'},{'Set-Cookie':cookie('pa_session','',0)});
    }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
