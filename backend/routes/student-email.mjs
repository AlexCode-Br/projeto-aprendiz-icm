export function createStudentEmailRoutes(context){
  const {db,json,authorize,readJson,sha256,cleanEmail,emailError,sendEmail,issueStudentEmailChange,
    usesSupabaseAuth,supabaseAdmin,requireSupabaseAdmin,verifyStudentPassword,consumeAuthRateLimit,rateLimitResponse,logger}=context;
  const valid=hash=>db.prepare(`SELECT ec.*,u.auth_user_id,sa.student_id FROM student_email_changes ec
    JOIN users u ON u.id=ec.user_id AND u.role='aluno' AND u.active=1 AND LOWER(u.email)=LOWER(ec.old_email)
    JOIN student_accounts sa ON sa.user_id=u.id
    JOIN students s ON s.id=sa.student_id AND s.active=1 AND s.anonymized_at IS NULL
    WHERE ec.token_hash=? AND ec.used_at IS NULL AND ec.expires_at>?`).get(hash,new Date().toISOString());
  return async(request,response,url,ip)=>{
    if(url.pathname==='/api/student-email/request'&&request.method==='POST'){
      const session=await authorize(request,response,['aluno']);if(!session)return;
      const limit=await consumeAuthRateLimit({route:'reset_password',ip,email:session.email});if(limit.blocked)return rateLimitResponse(response,limit);
      const body=await readJson(request),email=cleanEmail(body.email);
      if(emailError(email))return json(response,400,{message:'Informe um novo e-mail válido.'});
      if(email===cleanEmail(session.email))return json(response,400,{message:'Este já é o e-mail da sua conta.'});
      if(!await verifyStudentPassword(session.user_id,String(body.password||'')))return json(response,400,{message:'A senha atual está incorreta.'});
      const result=await issueStudentEmailChange({userId:session.user_id,newEmail:email,requestedBy:session.user_id,ip});
      if(!result.sent){
        const status=result.code==='EMAIL_IN_USE'?409:result.code==='DELIVERY_FAILED'?502:400;
        return json(response,status,{message:result.message});
      }
      return json(response,200,{message:result.message});
    }
    const validating=request.method==='GET'&&url.pathname==='/api/student-email/validate';
    const confirming=request.method==='POST'&&url.pathname==='/api/student-email/confirm';
    if(!validating&&!confirming)return json(response,404,{message:'Rota não encontrada.'});
    const limit=await consumeAuthRateLimit({route:'reset_password',ip,includeEmail:false});if(limit.blocked)return rateLimitResponse(response,limit);
    const body=confirming?await readJson(request):{};
    const hash=sha256(String(confirming?body.token||'':url.searchParams.get('token')||''));
    const change=await valid(hash);
    if(!change)return json(response,400,{message:'Este link é inválido, expirou ou já foi utilizado.'});
    if(validating)return json(response,200,{email:change.new_email});
    if(usesSupabaseAuth&&!requireSupabaseAdmin(response))return;
    let authChanged=false;
    try{
      await db.transaction(async()=>{
        if(db.dialect==='postgres')await db.prepare('SELECT id FROM users WHERE id=? FOR UPDATE').get(change.user_id);
        if(!await valid(hash))throw new Error('EMAIL_CHANGE_INVALID');
        const claimed=await db.prepare('UPDATE student_email_changes SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL AND expires_at>?').run(hash,new Date().toISOString());
        if(claimed.changes!==1)throw new Error('EMAIL_CHANGE_INVALID');
        // Reserve both unique addresses before contacting the auth provider.
        await db.prepare('UPDATE users SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(change.new_email,change.user_id);
        await db.prepare('UPDATE students SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(change.new_email,change.student_id);
        if(usesSupabaseAuth){
          if(!change.auth_user_id)throw new Error('AUTH_EMAIL_UPDATE_FAILED');
          const {error}=await supabaseAdmin.auth.admin.updateUserById(change.auth_user_id,{email:change.new_email,email_confirm:true});
          if(error)throw new Error('AUTH_EMAIL_UPDATE_FAILED');
          authChanged=true;
        }
        await db.prepare('DELETE FROM password_resets WHERE user_id=?').run(change.user_id);
        await db.prepare('DELETE FROM sessions WHERE user_id=?').run(change.user_id);
        await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(change.user_id,'student_email_changed',ip);
      });
    }catch(error){
      if(authChanged){
        const result=await supabaseAdmin.auth.admin.updateUserById(change.auth_user_id,{email:change.old_email,email_confirm:true}).catch(e=>({error:e}));
        if(result.error)logger.error('student_email_compensation_failed',result.error,{userId:change.user_id});
      }
      if(context.duplicateError(error))return json(response,409,{message:'Não é possível utilizar este e-mail. Solicite outra alteração.'});
      if(error.message==='EMAIL_CHANGE_INVALID')return json(response,400,{message:'O link já foi utilizado ou expirou.'});
      logger.error('student_email_change_failed',error,{userId:change.user_id});
      return json(response,502,{message:'Não foi possível confirmar a alteração. Tente novamente.'});
    }
    // Advisory only: failure to send this notice must not undo an already verified change.
    try{await sendEmail(change.old_email,'E-mail de acesso alterado — Projeto Aprendiz','O e-mail da sua conta foi alterado após confirmação. Se não reconhece esta ação, entre em contato com a gestão.',`student-email-alert/${hash}`);}catch(error){logger.error('student_email_alert_failed',error,{userId:change.user_id});}
    return json(response,200,{message:'E-mail confirmado. Entre usando seu novo endereço.'},{'Set-Cookie':context.cookie('pa_session','',0)});
  };
}
