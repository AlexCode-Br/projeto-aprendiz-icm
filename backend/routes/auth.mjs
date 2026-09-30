export function createAuthRoutes(context) {
  const {
    db,
    json,
    usesSupabaseAuth,
    readJson,
    cleanEmail,
    consumeAuthRateLimit,
    loginRateLimitStatus,
    recordLoginFailure,
    resetLoginFailures,
    verifyTurnstile,
    turnstileSiteKey,
    rateLimitResponse,
    verifyPassword,
    createAppSession,
    publicUser,
    cookie,
    currentSession,
    baseUrl,
    sendEmail,
    sha256,
    isProduction,
    issueProfessorInvite,
    strongPassword,
    requireSupabaseAdmin,
    supabaseAdmin,
    hashPassword,
    randomBytes,
    logger,
    signInWithSupabasePassword,
    managerMfaRequired,
  } = context;
  const studentHasAccess = async user => user.role !== 'aluno' || Boolean(await db.prepare(`SELECT sa.student_id
    FROM student_accounts sa JOIN students s ON s.id=sa.student_id AND s.active=1 AND s.anonymized_at IS NULL
    WHERE sa.user_id=?`).get(user.id));

  const maskedEmail = email => {
    const [local = '', domain = ''] = String(email || '').split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, Math.min(8, local.length - 2)))}@${domain}`;
  };

  async function issueManagerChallenge(user, remember, ip) {
    const challengeToken = randomBytes(32).toString('base64url');
    const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await db.transaction(async () => {
      await db.prepare('UPDATE manager_login_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=? AND consumed_at IS NULL').run(user.id);
      await db.prepare('INSERT INTO manager_login_challenges(user_id,token_hash,code_hash,remember,expires_at) VALUES (?,?,?,?,?)')
        .run(user.id, sha256(challengeToken), sha256(`${challengeToken}:${code}`), remember ? 1 : 0, expiresAt);
      await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(user.id, 'manager_mfa_challenge_issued', ip);
    });
    try {
      await sendEmail(user.email, 'Código de verificação — Projeto Aprendiz', `Olá, ${user.name}.\n\nSeu código de verificação é: ${code}\n\nEle expira em 10 minutos. Se você não tentou entrar, altere sua senha e avise a administração.`, `manager-mfa/${user.id}/${sha256(challengeToken)}`);
    } catch (error) {
      await db.prepare('DELETE FROM manager_login_challenges WHERE token_hash=?').run(sha256(challengeToken));
      logger.error('manager_mfa_delivery_failed', error, { userId: user.id });
      return null;
    }
    return { challengeToken, expiresAt, destination: maskedEmail(user.email) };
  }

  return async function authRoutes(request, response, url, ip) {
      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const { email, password, remember = false, turnstileToken = '' } = await readJson(request);
        const normalized = cleanEmail(email);
        const limits = await loginRateLimitStatus({ ip, email: normalized });
        if (limits.ip.blocked) {
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(null, 'auth_rate_limited:login:ip', ip);
          return rateLimitResponse(response, limits.ip);
        }
        if (limits.email.blocked) {
          if (!turnstileSiteKey) {
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(null, 'auth_rate_limited:login:email', ip);
            return rateLimitResponse(response, limits.email);
          }
          if (!(await verifyTurnstile(turnstileToken, ip))) {
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(null, 'auth_turnstile_required:login', ip);
            return json(response, 403, { code: 'CAPTCHA_REQUIRED', message: 'Confirme que você não é um robô para continuar.', siteKey: turnstileSiteKey });
          }
        }

        let user = null;
        if (usesSupabaseAuth) {
          const { data, error } = await signInWithSupabasePassword({ email: normalized, password });
          const authUser = data?.user;
          if (!error && authUser?.id && authUser.email && authUser.email_confirmed_at) {
            user = await db.prepare('SELECT * FROM users WHERE auth_user_id=? AND active=1').get(authUser.id);
            if (!user) {
              user = await db.prepare('SELECT * FROM users WHERE email=? AND auth_user_id IS NULL AND active=1').get(cleanEmail(authUser.email));
              if (user) {
                await db.prepare('UPDATE users SET auth_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(authUser.id, user.id);
                user.auth_user_id = authUser.id;
              }
            }
          }
        } else {
          user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalized);
          if (user && !(await verifyPassword(password, user.password_hash))) user = null;
        }

        if (!user || !(await studentHasAccess(user))) {
          const failures = await recordLoginFailure({ ip, email: normalized });
          await new Promise(resolve => setTimeout(resolve, 350));
          const captchaRequired = Boolean(turnstileSiteKey) && failures.email.remaining === 0;
          return json(response, 401, {
            message: 'E-mail ou senha inválidos.',
            ...(captchaRequired ? { code: 'CAPTCHA_REQUIRED', siteKey: turnstileSiteKey } : {}),
          });
        }
        await resetLoginFailures(normalized);
        if (user.role === 'gestor' && managerMfaRequired) {
          const challenge = await issueManagerChallenge(user, remember, ip);
          if (!challenge) return json(response, 503, { message: 'Não foi possível enviar o código de verificação. Tente novamente.' });
          return json(response, 202, { mfaRequired: true, ...challenge });
        }
        const { token, csrfToken, maxAge } = await createAppSession(user, ip, remember, { userAgent: request.headers['user-agent'] });
        return json(response, 200, { user: publicUser(user), csrfToken }, { 'Set-Cookie': cookie('pa_session', token, maxAge) });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/mfa/verify') {
        const body = await readJson(request);
        const challengeToken = String(body.challengeToken || '');
        const code = String(body.code || '').replace(/\D/g, '').slice(0, 6);
        const rateLimit = await consumeAuthRateLimit({ route: 'manager_mfa', ip, includeEmail: false });
        if (rateLimit.blocked) return rateLimitResponse(response, rateLimit);
        if (challengeToken.length < 32 || !/^\d{6}$/.test(code)) return json(response, 400, { message: 'Código de verificação inválido.' });
        const challenge = await db.prepare(`SELECT manager_login_challenges.*,users.name,users.email,users.role,users.active
          FROM manager_login_challenges JOIN users ON users.id=manager_login_challenges.user_id
          WHERE manager_login_challenges.token_hash=? AND manager_login_challenges.consumed_at IS NULL
            AND manager_login_challenges.expires_at>? AND manager_login_challenges.attempts<5`)
          .get(sha256(challengeToken), new Date().toISOString());
        if (!challenge) return json(response, 400, { message: 'Este código expirou ou já foi utilizado. Faça login novamente.' });
        if (challenge.code_hash !== sha256(`${challengeToken}:${code}`)) {
          await db.prepare('UPDATE manager_login_challenges SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL').run(challenge.id);
          await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(challenge.user_id, 'manager_mfa_failed', ip);
          return json(response, 401, { message: 'Código de verificação incorreto.' });
        }
        const claimed = await db.prepare('UPDATE manager_login_challenges SET consumed_at=CURRENT_TIMESTAMP WHERE id=? AND consumed_at IS NULL AND attempts<5').run(challenge.id);
        if (!claimed.changes || challenge.role !== 'gestor' || challenge.active !== 1) return json(response, 400, { message: 'Este código não está mais disponível.' });
        const user = { id: challenge.user_id, name: challenge.name, email: challenge.email, role: challenge.role };
        const { token, csrfToken, maxAge } = await createAppSession(user, ip, Boolean(challenge.remember), { mfaVerified: true, userAgent: request.headers['user-agent'] });
        await db.prepare('INSERT INTO audit_log(user_id,action,ip) VALUES (?,?,?)').run(user.id, 'manager_mfa_verified', ip);
        return json(response, 200, { user: publicUser(user), csrfToken }, { 'Set-Cookie': cookie('pa_session', token, maxAge) });
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/exchange') {
        return json(response, 410, { message: 'Atualize a página e faça login novamente.' });
      }
    
      if (request.method === 'GET' && url.pathname === '/api/auth/me') {
        const session = await currentSession(request);
        if (!session || !session.active) return json(response, 401, { message: 'Sessão não autenticada.' });
        return json(response, 200, { user: publicUser({ id: session.user_id, ...session }), csrfToken: session.csrf_token });
      }
    
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        const session = await currentSession(request);
        if (session && request.headers['x-csrf-token'] === session.csrf_token) {
          await db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, 'logout', ip);
        }
        return json(response, 200, { success: true }, { 'Set-Cookie': cookie('pa_session', '', 0) });
      }
    
      if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
        const { email } = await readJson(request);
        const normalized = cleanEmail(email);
        const rateLimit = await consumeAuthRateLimit({ route: 'forgot_password', ip, email: normalized });
        if (rateLimit.blocked) return rateLimitResponse(response, rateLimit);
        const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalized);
        if (user && (!usesSupabaseAuth || user.auth_user_id)) {
          const token = randomBytes(32).toString('base64url');
          const expires = new Date(Date.now() + 30 * 60_000).toISOString();
          await db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(user.id);
          await db.prepare('INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES (?,?,?)').run(user.id, sha256(token), expires);
          const resetUrl = `${baseUrl}/reset-password#token=${encodeURIComponent(token)}`;
          const body = `Olá, ${user.name}. Use este link em até 30 minutos para redefinir sua senha:\n\n${resetUrl}\n\nSe você não solicitou a alteração, ignore esta mensagem.`;
          try { await sendEmail(user.email, 'Recuperação de senha — Projeto Aprendiz', body, `password-reset-${sha256(token)}`); }
          catch (error) { logger.error('password_recovery_email_failed', error, { userId: user.id }); }
        } else if (!user) {
          const pendingProfessor = await db.prepare(`
            SELECT professor_profiles.id,professor_profiles.name,professor_profiles.email,professor_invites.created_by
            FROM professor_profiles
            JOIN professor_invites ON professor_invites.professor_profile_id=professor_profiles.id
            WHERE professor_profiles.email=? AND professor_profiles.active=1 AND professor_profiles.user_id IS NULL
            ORDER BY professor_invites.id DESC LIMIT 1
          `).get(normalized);
          if (pendingProfessor) {
            await issueProfessorInvite({
              professorId: pendingProfessor.id,
              name: pendingProfessor.name,
              email: pendingProfessor.email,
              createdBy: pendingProfessor.created_by,
              ip,
              auditAction: 'professor_invite_requested_from_recovery',
            });
          }
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        return json(response, 200, { message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.', devMailbox: isProduction ? null : '/dev-mail' });
      }
    
      if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
        const { token, password } = await readJson(request);
        const ipRateLimit = await consumeAuthRateLimit({ route: 'reset_password', ip, includeEmail: false });
        if (ipRateLimit.blocked) return rateLimitResponse(response, ipRateLimit);
        const reset = await db.prepare(`
          SELECT password_resets.*,users.auth_user_id,users.email
          FROM password_resets JOIN users ON users.id=password_resets.user_id
          WHERE password_resets.token_hash=? AND password_resets.used_at IS NULL AND password_resets.expires_at>?
        `).get(sha256(String(token || '')), new Date().toISOString());
        if (!reset) return json(response, 400, { message: 'Este link é inválido, expirou ou já foi utilizado.' });
        const emailRateLimit = await consumeAuthRateLimit({ route: 'reset_password', ip, email: reset.email, includeIp: false });
        if (emailRateLimit.blocked) return rateLimitResponse(response, emailRateLimit);
        if (!strongPassword(password)) return json(response, 400, { message: 'A senha não atende aos requisitos de segurança.' });
        const claimed = await db.prepare('UPDATE password_resets SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL AND expires_at>?').run(reset.id,new Date().toISOString());
        if (!claimed.changes) return json(response, 400, { message: 'Este link é inválido, expirou ou já foi utilizado.' });
        if (usesSupabaseAuth) {
          if (!requireSupabaseAdmin(response)) return;
          if (!reset.auth_user_id) return json(response, 400, { message: 'Esta conta ainda não foi ativada. Solicite um novo convite.' });
          const { error } = await supabaseAdmin.auth.admin.updateUserById(reset.auth_user_id, { password });
          if (error) {
            await db.prepare('UPDATE password_resets SET used_at=NULL WHERE id=?').run(reset.id);
            logger.error('supabase_password_update_failed', error, { userId: reset.user_id });
            return json(response, 502, { message: 'Não foi possível alterar a senha agora. Tente novamente.' });
          }
        }
        const passwordHash = await hashPassword(usesSupabaseAuth ? randomBytes(48).toString('base64url') : password);
        await db.transaction(async () => {
          await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, reset.user_id);
          await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
          await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(reset.user_id, 'password_reset', ip);
        });
        return json(response, 200, { message: 'Senha alterada com sucesso.' });
      }
    
      if (request.method === 'GET' && url.pathname === '/api/invitations/validate') {
        const invitation = await db.prepare(`SELECT professor_invites.*,professor_profiles.name FROM professor_invites JOIN professor_profiles ON professor_profiles.id=professor_invites.professor_profile_id WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?`).get(sha256(String(url.searchParams.get('token') || '')),new Date().toISOString());
        if(!invitation)return json(response,400,{message:'Este convite é inválido, expirou ou já foi utilizado.'});
        return json(response,200,{nome:invitation.name,email:invitation.email,expiresAt:invitation.expires_at});
      }
    
      if (request.method === 'POST' && url.pathname === '/api/invitations/accept') {
        const body=await readJson(request),token=String(body.token||'');
        const ipRateLimit=await consumeAuthRateLimit({route:'invitation_accept',ip,includeEmail:false});
        if(ipRateLimit.blocked)return rateLimitResponse(response,ipRateLimit);
        const invitation=await db.prepare(`SELECT professor_invites.*,professor_profiles.name FROM professor_invites JOIN professor_profiles ON professor_profiles.id=professor_invites.professor_profile_id WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?`).get(sha256(token),new Date().toISOString());
        if(!invitation)return json(response,400,{message:'Este convite é inválido, expirou ou já foi utilizado.'});
        const emailRateLimit=await consumeAuthRateLimit({route:'invitation_accept',ip,email:invitation.email,includeIp:false});
        if(emailRateLimit.blocked)return rateLimitResponse(response,emailRateLimit);
        if(!strongPassword(body.password))return json(response,400,{message:'A senha não atende aos requisitos de segurança.'});
        if(await db.prepare('SELECT id FROM users WHERE email=?').get(invitation.email))return json(response,409,{message:'Já existe uma conta com este e-mail.'});
        if (usesSupabaseAuth && !requireSupabaseAdmin(response)) return;
        let authUserId = null;
        if (usesSupabaseAuth) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: invitation.email,
            password: body.password,
            email_confirm: true,
            user_metadata: { name: invitation.name },
            app_metadata: { role: 'professor' },
          });
          if (error) {
            logger.error('supabase_professor_creation_failed', error, { professorId: invitation.professor_profile_id });
            const duplicate = String(error.code || error.message).toLowerCase().includes('email') && String(error.code || error.message).toLowerCase().includes('exist');
            return json(response, duplicate ? 409 : 502, { message: duplicate ? 'Já existe uma conta de acesso com este e-mail. Use a recuperação de senha.' : 'Não foi possível ativar a conta agora. Tente novamente.' });
          }
          authUserId = data.user.id;
        }
        const passwordHash=await hashPassword(usesSupabaseAuth ? randomBytes(48).toString('base64url') : body.password);
        try {
          await db.transaction(async () => {
            const userResult=await db.prepare("INSERT INTO users (auth_user_id,name,email,password_hash,role) VALUES (?,?,?,?,'professor')").run(authUserId,invitation.name,invitation.email,passwordHash);
            const userId=Number(userResult.lastInsertRowid);
            await db.prepare('UPDATE professor_profiles SET user_id=? WHERE id=?').run(userId,invitation.professor_profile_id);
            await db.prepare('UPDATE professor_invites SET accepted_at=CURRENT_TIMESTAMP WHERE id=?').run(invitation.id);
            await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(userId,'professor_invite_accepted',ip);
          });
        } catch (error) {
          if (usesSupabaseAuth && authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
          if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response,409,{message:'Já existe uma conta com este e-mail.'});
          throw error;
        }
        return json(response,200,{message:'Conta ativada com sucesso. Você já pode entrar.'});
      }
    return json(response, 404, { message: 'Rota não encontrada.' });
  };
}
