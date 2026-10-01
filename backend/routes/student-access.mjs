export function createStudentAccessRoutes(context) {
  const { db, json, authorize, readJson, sha256, randomBytes, strongPassword,
    hashPassword, usesSupabaseAuth, supabaseAdmin, requireSupabaseAdmin, consumeAuthRateLimit, rateLimitResponse, logger,
    issueStudentInvite } = context;
  const validInvite = hash => db.prepare(`SELECT si.*,s.name FROM student_invites si
    JOIN students s ON s.id=si.student_id AND s.active=1 AND s.anonymized_at IS NULL
    WHERE si.token_hash=? AND si.accepted_at IS NULL AND si.expires_at>?
      AND LOWER(s.email)=LOWER(si.email)
      AND NOT EXISTS (SELECT 1 FROM student_accounts sa WHERE sa.student_id=s.id)`)
    .get(hash, new Date().toISOString());

  return async (request, response, url, ip) => {
    const manager = url.pathname.match(/^\/api\/student-access\/(\d+)$/);
    if (manager) {
      const session = await authorize(request,response,['gestor']); if (!session) return;
      const student = await db.prepare(`SELECT s.id,s.name,s.email,sa.user_id,u.active AS account_active
        FROM students s LEFT JOIN student_accounts sa ON sa.student_id=s.id LEFT JOIN users u ON u.id=sa.user_id
        WHERE s.id=? AND s.active=1 AND s.anonymized_at IS NULL`).get(Number(manager[1]));
      if (!student) return json(response,404,{message:'Aluno não encontrado.'});
      if (request.method==='GET') {
        const invitation=await db.prepare(`SELECT created_at,expires_at FROM student_invites
          WHERE student_id=? AND accepted_at IS NULL ORDER BY created_at DESC LIMIT 1`).get(student.id);
        const pending=Boolean(invitation && new Date(invitation.expires_at).getTime()>Date.now());
        return json(response,200,{active:student.account_active===1,hasEmail:Boolean(student.email),pending,hasInvite:Boolean(invitation),inviteSentAt:invitation?.created_at||null,inviteExpiresAt:invitation?.expires_at||null});
      }
      if (request.method!=='POST') return json(response,405,{message:'Método não permitido.'});
      const limit=await consumeAuthRateLimit({route:'student_invite_send',ip,email:student.email});
      if (limit.blocked) return rateLimitResponse(response,limit);
      const invitation=await issueStudentInvite({studentId:student.id,createdBy:session.user_id,ip,auditAction:'student_invited'});
      if(!invitation.inviteSent){
        const status=invitation.code==='STUDENT_NOT_FOUND'?404:invitation.code==='INVALID_EMAIL'?400:invitation.code==='DELIVERY_FAILED'?502:409;
        return json(response,status,{message:invitation.message});
      }
      return json(response,200,{message:'Convite de acesso enviado. Válido por 48 horas.',pending:true,hasInvite:true,inviteSentAt:invitation.sentAt,inviteExpiresAt:invitation.expiresAt});
    }
    const accepting=request.method==='POST' && url.pathname==='/api/student-invitations/accept';
    const validating=request.method==='GET' && url.pathname==='/api/student-invitations/validate';
    if (!accepting && !validating) return json(response,404,{message:'Rota não encontrada.'});
    const limit=await consumeAuthRateLimit({route:'invitation_accept',ip,includeEmail:false});
    if (limit.blocked) return rateLimitResponse(response,limit);
    const body=accepting ? await readJson(request) : {};
    const hash=sha256(String(accepting ? body.token || '' : url.searchParams.get('token') || ''));
    const invitation=await validInvite(hash);
    if (!invitation) return json(response,400,{message:'Este convite é inválido, expirou ou já foi utilizado.'});
    if (validating) return json(response,200,{nome:invitation.name,email:invitation.email});
    if (!strongPassword(body.password)) return json(response,400,{message:'A senha não atende aos requisitos de segurança.'});
    if (await db.prepare('SELECT id FROM users WHERE LOWER(email)=LOWER(?)').get(invitation.email)) return json(response,409,{message:'Já existe uma conta com este e-mail.'});
    if (usesSupabaseAuth && !requireSupabaseAdmin(response)) return;
    let authId=null;
    if (usesSupabaseAuth) {
      const {data,error}=await supabaseAdmin.auth.admin.createUser({email:invitation.email,password:body.password,email_confirm:true,user_metadata:{name:invitation.name},app_metadata:{role:'aluno'}});
      if (error || !data?.user) return json(response,409,{message:'Não foi possível ativar esta conta. Verifique se o e-mail já possui acesso.'});
      authId=data.user.id;
    }
    try {
      const passwordHash=await hashPassword(usesSupabaseAuth ? randomBytes(48).toString('base64url') : body.password);
      await db.transaction(async()=>{
        // Recheck ownership and atomically consume the invitation, including concurrent requests.
        if (db.dialect==='postgres') await db.prepare('SELECT id FROM students WHERE id=? FOR UPDATE').get(invitation.student_id);
        const fresh=await validInvite(hash);
        if (!fresh) throw new Error('INVITE_CONSUMED');
        const claimed=await db.prepare('UPDATE student_invites SET accepted_at=CURRENT_TIMESTAMP WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?').run(hash,new Date().toISOString());
        if (claimed.changes!==1) throw new Error('INVITE_CONSUMED');
        const result=await db.prepare("INSERT INTO users (auth_user_id,name,email,password_hash,role) VALUES (?,?,?,?,'aluno')").run(authId,fresh.name,fresh.email,passwordHash);
        await db.prepare('INSERT INTO student_accounts (student_id,user_id) VALUES (?,?)').run(fresh.student_id,result.lastInsertRowid);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(result.lastInsertRowid,'student_invite_accepted',ip);
      });
    } catch (error) {
      if (authId) {
        const cleanup=await supabaseAdmin.auth.admin.deleteUser(authId);
        if (cleanup.error) logger.error('student_auth_cleanup_failed',cleanup.error,{authId});
      }
      if (error.message==='INVITE_CONSUMED' || context.duplicateError(error)) return json(response,409,{message:'O convite já foi utilizado ou os dados do cadastro mudaram. Solicite um novo convite.'});
      throw error;
    }
    return json(response,200,{message:'Conta de aluno ativada. Você já pode entrar.'});
  };
}
