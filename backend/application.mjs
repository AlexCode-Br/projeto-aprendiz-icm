import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  createHttpSecurity,
  createSlidingWindowRateLimiter,
  hashPassword,
  opaqueRateLimitKey,
  readJson,
  sha256,
  strongPassword,
  verifyPassword,
} from './security.mjs';
import { createApiHandler } from './routes/index.mjs';
import { createEmailService } from './email.mjs';
import { createStructuredLogger } from './logger.mjs';
import {
  ANNOUNCEMENT_ATTACHMENT_TOTAL_BYTES,
  ANNOUNCEMENT_ATTACHMENT_MAX_COUNT,
  createAnnouncementStorage,
  normalizeAnnouncementAttachments,
} from './storage.mjs';
import { createProfilePhotoStorage, normalizeProfilePhoto } from './profile-photos.mjs';
import { createNotificationService, normalizeNotificationPreferences } from './notifications.mjs';
import {
  catalogNameError,
  cleanText,
  emailError,
  hasValidationErrors,
  isCalendarDate,
  normalizeEmail,
  personNameError,
  phoneError,
  requiredTextError,
  validateStudent,
  validateProfessor,
  validateClassDetails,
  validateSchoolYear,
  validateSupportTicket,
  supportMessageError,
  supportClientMessageIdError,
  validateStudentContact,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
} from '../shared/validation.mjs';

export function isApiPath(pathname) {
  return pathname.startsWith('/api/') || ['/alunos', '/cursos', '/professores', '/frequencia']
    .some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Creates request handlers without opening connections, migrating data or starting a server. */
export function createApplication({
  db,
  env = process.env,
  logger = createStructuredLogger({ includeStack: env.NODE_ENV !== 'production' }),
  authRateLimiter = createSlidingWindowRateLimiter(),
} = {}) {
  if (!db) throw new TypeError('Uma conexão de banco de dados é obrigatória.');
  const port = Number(env.PORT || 4180);
  const baseUrl = env.APP_URL || (env.RENDER_EXTERNAL_HOSTNAME ? `https://${env.RENDER_EXTERNAL_HOSTNAME}` : `http://127.0.0.1:${port}`);
  const appOrigin = new URL(baseUrl).origin;
  const isProduction = env.NODE_ENV === 'production';
  const authProvider = env.AUTH_PROVIDER || (env.SUPABASE_URL ? 'supabase' : 'local');
  const usesSupabaseAuth = authProvider === 'supabase';
  const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (usesSupabaseAuth && (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error('SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórias com AUTH_PROVIDER=supabase.');
  }

  const supabaseAuth = usesSupabaseAuth
    ? createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      })
    : null;

  const supabaseAdmin = usesSupabaseAuth && supabaseSecretKey
    ? createClient(env.SUPABASE_URL, supabaseSecretKey, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      })
    : null;

  const currentTimestampSql = db.dialect === 'sqlite' ? `strftime('%Y-%m-%dT%H:%M:%fZ','now')` : 'CURRENT_TIMESTAMP';
  const announcementScheduledCondition = column => `${column} <= ${currentTimestampSql}`;
  const cleanEmail = normalizeEmail;
  const publicUser = user => ({ id: user.id, nome: user.name, email: user.email, role: user.role });

  function invalid(response, errors, fallback = 'Revise os campos informados.') {
    return json(response, 400, { message: Object.values(errors).find(Boolean) || fallback, errors });
  }

  function duplicateError(error) {
    return error?.code === '23505' || String(error).includes('UNIQUE');
  }

  const { sendEmail } = createEmailService({ db, isProduction, env });
  const notificationService = createNotificationService({ db, sendEmail, logger });

  function requireSupabaseAdmin(response) {
    if (!usesSupabaseAuth || supabaseAdmin) return true;
    json(response, 503, { message: 'A administração de contas ainda não está configurada no servidor.' });
    return false;
  }

  async function issueProfessorInvite({ professorId, name, email, createdBy, ip, auditAction = 'professor_invite_created' }) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const expires = new Date(Date.now() + 48 * 60 * 60_000).toISOString();
    const inviteUrl = `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;
    const emailBody = `Olá, ${name}. Você foi convidado para acessar o Projeto Aprendiz como Professor. Crie sua senha em até 48 horas:\n\n${inviteUrl}\n\nSe você não reconhece este convite, ignore esta mensagem.`;

    await db.transaction(async () => {
      await db.prepare('UPDATE professor_invites SET expires_at=CURRENT_TIMESTAMP WHERE professor_profile_id=? AND accepted_at IS NULL').run(professorId);
      await db.prepare('INSERT INTO professor_invites (professor_profile_id,email,token_hash,expires_at,created_by) VALUES (?,?,?,?,?)').run(professorId, email, tokenHash, expires, createdBy);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(createdBy, auditAction, ip);
    });

    try {
      await sendEmail(email, 'Convite de acesso — Projeto Aprendiz', emailBody, `professor-invite/${professorId}/${tokenHash.slice(0, 16)}`);
      return { inviteSent: true, expiresAt: expires };
    } catch (error) {
      logger.error('professor_invite_email_failed', error, { professorId });
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(createdBy, 'professor_invite_email_failed', ip);
      return { inviteSent: false, expiresAt: expires };
    }
  }

  const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
  const AUTH_RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';

  async function consumeAuthRateLimit({ route, ip, email = '', includeIp = true, includeEmail = true }) {
    const blockedScopes = [];
    let retryAfterMs = 0;
    if (includeIp) {
      const result = await authRateLimiter.consume({
        key: opaqueRateLimitKey(`auth:${route}:ip`, ip),
        limit: 20,
        windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
      });
      if (result.blocked) blockedScopes.push('ip');
      retryAfterMs = Math.max(retryAfterMs, result.retryAfterMs);
    }
    if (includeEmail && email) {
      const result = await authRateLimiter.consume({
        key: opaqueRateLimitKey(`auth:${route}:email`, email),
        limit: 5,
        windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
      });
      if (result.blocked) blockedScopes.push('email');
      retryAfterMs = Math.max(retryAfterMs, result.retryAfterMs);
    }
    if (!blockedScopes.length) return { blocked: false, retryAfterMs: 0 };
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)')
      .run(null, `auth_rate_limited:${route}:${blockedScopes.join('+')}`, ip);
    return { blocked: true, retryAfterMs };
  }

  function rateLimitResponse(response, result) {
    return json(response, 429, { message: AUTH_RATE_LIMIT_MESSAGE }, {
      'Retry-After': String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))),
    });
  }

  const { cookies, cookie, securityHeaders, json, originAllowed } = createHttpSecurity({ isProduction, appOrigin, env });

  async function currentSession(request) {
    const raw = cookies(request).pa_session;
    if (!raw) return null;
    return await db.prepare(`
      SELECT sessions.*, users.id AS user_id, users.name, users.email, users.role, users.active
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(sha256(raw), new Date().toISOString()) || null;
  }

  async function createAppSession(user, ip, remember = false) {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const maxAge = remember ? 30 * 86400 : 8 * 3600;
    const expires = new Date(Date.now() + maxAge * 1000).toISOString();
    await db.prepare('INSERT INTO sessions (user_id,token_hash,csrf_token,expires_at) VALUES (?,?,?,?)').run(user.id, sha256(token), csrfToken, expires);
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(user.id, 'login', ip);
    return { token, csrfToken, maxAge };
  }

  async function userFromSupabaseToken(request) {
    const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const { data, error } = await supabaseAuth.auth.getUser(match[1]);
    const authUser = data?.user;
    if (error || !authUser?.id || !authUser.email || !authUser.email_confirmed_at) return null;
    let user = await db.prepare('SELECT * FROM users WHERE auth_user_id=? AND active=1').get(authUser.id);
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE email=? AND auth_user_id IS NULL AND active=1').get(cleanEmail(authUser.email));
      if (user) {
        await db.prepare('UPDATE users SET auth_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(authUser.id,user.id);
        user.auth_user_id = authUser.id;
      }
    }
    return user || null;
  }

  async function authorize(request, response, roles = []) {
    const session = await currentSession(request);
    if (!session || !session.active) {
      json(response, 401, { message: 'Faça login para continuar.' });
      return null;
    }
    if (roles.length && !roles.includes(session.role)) {
      json(response, 403, { message: 'Você não tem permissão para esta operação.' });
      return null;
    }
    if (['POST','PUT','PATCH','DELETE'].includes(request.method) && request.headers['x-csrf-token'] !== session.csrf_token) {
      json(response, 403, { message: 'Validação de segurança expirada. Atualize a página.' });
      return null;
    }
    return session;
  }

  function schoolYearView(row) {
    return {
      id: Number(row.id),
      label: row.label,
      startDate: row.dates_confirmed === 1 ? String(row.start_date).slice(0, 10) : '',
      endDate: row.dates_confirmed === 1 ? String(row.end_date).slice(0, 10) : '',
      active: row.active === 1,
      datesConfirmed: row.dates_confirmed === 1,
      closed: Boolean(row.closed_at),
      closedAt: row.closed_at || null,
    };
  }

  async function selectedSchoolYear(request, response, { writable = false } = {}) {
    const supplied = String(request.headers['x-school-year-id'] || '').trim();
    let period;
    if (supplied) {
      const id = Number(supplied);
      if (!Number.isSafeInteger(id) || id < 1) {
        json(response, 400, { message: 'Período letivo inválido.' });
        return null;
      }
      period = await db.prepare('SELECT * FROM school_years WHERE id=?').get(id);
    } else {
      period = await db.prepare('SELECT * FROM school_years WHERE active=1 ORDER BY id DESC LIMIT 1').get();
    }
    if (!period) {
      json(response, 404, { message: 'Período letivo não encontrado.' });
      return null;
    }
    if (writable && (period.active !== 1 || period.closed_at)) {
      json(response, 409, { message: 'Este período foi encerrado e está disponível somente para consulta histórica.' });
      return null;
    }
    return period;
  }

  async function professorDeletionImpact(professorId) {
    const professor = await db.prepare(`
      SELECT professor_profiles.id,professor_profiles.name AS nome,professor_profiles.email,
        professor_profiles.active,professor_profiles.user_id,users.auth_user_id,
        locations.name AS local_principal
      FROM professor_profiles
      LEFT JOIN users ON users.id=professor_profiles.user_id
      LEFT JOIN locations ON locations.id=professor_profiles.home_location_id
      WHERE professor_profiles.id=?
    `).get(professorId);
    if (!professor) return null;

    const classes = await db.prepare(`
      SELECT classes.id,courses.name AS curso,locations.name AS local,classes.weekday,classes.start_time,
        classes.active,
        COUNT(DISTINCT CASE WHEN students.active=1 THEN students.id END) AS alunos,
        COUNT(DISTINCT enrollments.id) AS matriculas
      FROM classes
      JOIN courses ON courses.id=classes.course_id
      JOIN locations ON locations.id=classes.location_id
      LEFT JOIN enrollments ON enrollments.class_id=classes.id
      LEFT JOIN students ON students.id=enrollments.student_id
      WHERE classes.professor_id=?
      GROUP BY classes.id,courses.name,locations.name,classes.weekday,classes.start_time,classes.active
      ORDER BY courses.name,locations.name
    `).all(professorId);
    const studentSummary = await db.prepare(`
      SELECT COUNT(DISTINCT students.id) AS total
      FROM students
      JOIN enrollments ON enrollments.student_id=students.id
      JOIN classes ON classes.id=enrollments.class_id
      WHERE classes.professor_id=? AND students.active=1
    `).get(professorId);
    const enrollmentSummary = await db.prepare(`
      SELECT COUNT(*) AS total FROM enrollments
      JOIN classes ON classes.id=enrollments.class_id
      WHERE classes.professor_id=?
    `).get(professorId);
    return {
      professor: {
        id: professor.id,
        nome: professor.nome,
        localPrincipal: professor.local_principal || 'Não informado',
        possuiAcesso: Boolean(professor.user_id),
      },
      resumo: {
        turmas: classes.length,
        turmasAtivas: classes.filter(row => row.active === 1).length,
        locais: new Set(classes.map(row => row.local)).size,
        alunosAtivos: Number(studentSummary?.total || 0),
        matriculas: Number(enrollmentSummary?.total || 0),
      },
      turmas: classes.map(row => ({
        id: row.id,
        curso: row.curso,
        local: row.local,
        alunos: Number(row.alunos || 0),
        matriculas: Number(row.matriculas || 0),
        ativa: row.active === 1,
        horario: [row.weekday, row.start_time].filter(Boolean).join(' · ') || 'Horário não informado',
      })),
    };
  }

  function studentView(row) {
    const classes = row.class_offerings ? row.class_offerings.split('||').map(value => {
      const [id, nome, local] = value.split('::');
      return { id: Number(id), nome, local };
    }) : [];
    const courseNames = classes.map(item => item.nome);
    return {
      id: row.id, nome: row.name, email: row.email || '', contato: row.email || '',
      telefone: row.phone || '', igreja_id: row.church_id ? Number(row.church_id) : null, igreja: row.church_name || '', classe: row.age_group || '',
      guardian_name: row.guardian_name || '', guardian_phone: row.guardian_phone || '',
      guardian_consent_at: row.guardian_consent_at || '',
      instrumento: row.has_instrument ? 'Sim' : 'Não', curso: courseNames,
      local: row.church_id ? Number(row.church_id) : '', foto_url: row.photo_updated_at ? `/api/alunos/${row.id}/foto?v=${encodeURIComponent(row.photo_updated_at)}` : '',
      cursos: classes.map(({ nome, local }) => ({ nome, local })),
      turmas: classes,
      created_at: row.created_at,
    };
  }

  function studentClassIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(Number).filter(id => Number.isInteger(id) && id > 0))];
  }

  function studentCourseNames(value) {
    const courses = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(courses.map(course => cleanText(course, 100)).filter(Boolean))];
  }

  async function activeClassesForStudent(classIds, legacyCourseNames = [], schoolYearId, studentId = null) {
    let classes = [];
    if (classIds.length) {
      const placeholders = classIds.map(() => '?').join(',');
      classes = await db.prepare(`
        SELECT classes.id,classes.course_id,classes.professor_id,classes.capacity,courses.name AS course_name
        FROM classes
        JOIN courses ON courses.id=classes.course_id
        JOIN locations ON locations.id=classes.location_id
        WHERE classes.id IN (${placeholders})
          AND classes.school_year_id=? AND classes.active=1 AND courses.active=1 AND locations.active=1
        ORDER BY classes.id
      `).all(...classIds,schoolYearId);
      if (classes.length !== classIds.length) return { classes: [], error: 'Uma das turmas selecionadas não está mais disponível.' };
    } else if (legacyCourseNames.length) {
      const placeholders = legacyCourseNames.map(() => '?').join(',');
      classes = await db.prepare(`
        SELECT MIN(classes.id) AS id,courses.id AS course_id,MIN(classes.professor_id) AS professor_id,MAX(classes.capacity) AS capacity,courses.name AS course_name
        FROM classes
        JOIN courses ON courses.id=classes.course_id
        JOIN locations ON locations.id=classes.location_id
        WHERE courses.name IN (${placeholders})
          AND classes.school_year_id=? AND classes.active=1 AND courses.active=1 AND locations.active=1
        GROUP BY courses.id,courses.name
        ORDER BY courses.name
      `).all(...legacyCourseNames,schoolYearId);
      if (classes.length !== legacyCourseNames.length) return { classes: [], error: 'Um dos cursos selecionados não possui turma ativa.' };
    }
    if (new Set(classes.map(item => item.course_id)).size !== classes.length) {
      return { classes: [], error: 'Escolha apenas uma turma para cada curso.' };
    }
    if (db.dialect === 'postgres' && classes.length) {
      const ids = classes.map(item => Number(item.id)).sort((a, b) => a - b);
      const locked = await db.prepare(`SELECT id FROM classes WHERE id IN (${ids.map(() => '?').join(',')}) AND school_year_id=? AND active=1 ORDER BY id FOR UPDATE`).all(...ids,schoolYearId);
      if (locked.length !== ids.length) return { classes: [], error: 'Uma das turmas selecionadas não está mais disponível.' };
    }
    for(const classRow of classes){
      if(!classRow.capacity)continue;
      const enrollmentCount=await db.prepare("SELECT COUNT(*) AS total FROM enrollments WHERE class_id=? AND status='ativa' AND student_id<>?").get(classRow.id,studentId||0);
      if(Number(enrollmentCount.total)>=Number(classRow.capacity))return {classes:[],error:`A turma de ${classRow.course_name} atingiu a capacidade máxima.`};
    }
    return { classes, error: '' };
  }

  async function activeChurch(value) {
    const id=Number(value);
    if(Number.isInteger(id)&&id>0)return db.prepare('SELECT id,name FROM churches WHERE id=? AND active=1').get(id);
    const name=cleanText(value,100);
    return name?db.prepare('SELECT id,name FROM churches WHERE LOWER(name)=LOWER(?) AND active=1').get(name):null;
  }

  const studentSelect = `
    SELECT students.*,MAX(churches.name) AS church_name,
      MAX(profile_photos.updated_at) AS photo_updated_at,
      GROUP_CONCAT(classes.id || '::' || courses.name || '::' || locations.name, '||') AS class_offerings
    FROM students
    LEFT JOIN churches ON churches.id=students.church_id
    LEFT JOIN profile_photos ON profile_photos.owner_type='student' AND profile_photos.owner_id=students.id
    LEFT JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa'
    LEFT JOIN classes ON classes.id=enrollments.class_id AND classes.active=1 AND classes.school_year_id=?
    LEFT JOIN courses ON courses.id=classes.course_id
    LEFT JOIN locations ON locations.id=classes.location_id
  `;

  const supportStatusFromDatabase = status => status === 'Pendente' ? 'Em atendimento' : status;
  const supportStatusToDatabase = status => status === 'Em atendimento' ? 'Pendente' : status;
  const supportWaitingFor = role => role === 'professor' ? 'Gestor' : role === 'gestor' ? 'Professor' : '';

  function supportTicketView(row) {
    const status=supportStatusFromDatabase(row.status);
    return {
      id: Number(row.id),
      nome: row.requester_name,
      contato: row.requester_email,
      assunto: row.subject,
      categoria: row.category || 'Outro',
      status,
      data_abertura: row.created_at,
      atualizado_em: row.updated_at,
      ultima_mensagem: row.last_message || '',
      ultima_mensagem_em: row.last_message_at || row.updated_at,
      ultima_mensagem_por: row.last_author_role || '',
      aguardando: status==='Resolvido'?'':supportWaitingFor(row.last_author_role),
      nao_lidas: Number(row.unread_count || 0),
      total_mensagens: Number(row.message_count || 0),
    };
  }

  function sanitizeAnnouncementContent(value) {
    const allowed = new Set(['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a']);
    return String(value || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|iframe|object|embed|form|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (source, rawTag) => {
        const tag = rawTag.toLowerCase();
        if (!allowed.has(tag)) return '';
        if (source.startsWith('</')) return tag === 'br' ? '' : `</${tag}>`;
        if (tag !== 'a') return tag === 'br' ? '<br>' : `<${tag}>`;
        const hrefMatch = source.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const href = String(hrefMatch?.[1] || hrefMatch?.[2] || '').trim();
        try {
          const parsed = new URL(href);
          if (parsed.protocol !== 'https:') return '<a>';
          return `<a href="${escapeHtml(parsed.toString())}" target="_blank" rel="noopener noreferrer">`;
        } catch { return '<a>'; }
      })
      .replace(/<\/a>/gi, '</a>')
      .slice(0, 12000000);
  }

  const {
    announcementStorageBucket,
    useSupabaseAttachmentStorage,
    prepareStoredAttachments,
    insertAnnouncementAttachments,
    removeStoredAttachments,
  } = createAnnouncementStorage({ db, supabaseAdmin, logger, env });
  const profilePhotoStorage = createProfilePhotoStorage({ db, supabaseAdmin, logger, env });
  const ANNOUNCEMENT_RECIPIENT_MAX_COUNT = 200;

  function recipientIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(Number).filter(id => Number.isInteger(id) && id > 0))];
  }

  async function normalizeAnnouncementRecipients(value) {
    if (value == null || (typeof value === 'object' && !Array.isArray(value) && value.todos === true)) {
      return { items: [], audience: { todos: true, professores: [], cursos: [] } };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Os destinatários precisam ser uma seleção válida.' };
    const professores = recipientIds(value.professores);
    const cursos = recipientIds(value.cursos);
    if (professores.length + cursos.length > ANNOUNCEMENT_RECIPIENT_MAX_COUNT) return { error: `Selecione no máximo ${ANNOUNCEMENT_RECIPIENT_MAX_COUNT} destinatários.` };
    if (!professores.length && !cursos.length) return { error: 'Selecione ao menos um professor ou curso, ou escolha todos.' };

    const professorRows = professores.length
      ? await db.prepare(`SELECT id FROM professor_profiles WHERE id IN (${professores.map(() => '?').join(',')}) AND active=1`).all(...professores)
      : [];
    const courseRows = cursos.length
      ? await db.prepare(`SELECT id FROM courses WHERE id IN (${cursos.map(() => '?').join(',')}) AND active=1`).all(...cursos)
      : [];
    if (professorRows.length !== professores.length) return { error: 'Um dos professores selecionados não está mais ativo.' };
    if (courseRows.length !== cursos.length) return { error: 'Um dos cursos selecionados não está mais ativo.' };

    return {
      items: [
        ...professores.map(id => ({ recipient_type: 'professor', recipient_id: id })),
        ...cursos.map(id => ({ recipient_type: 'curso', recipient_id: id })),
      ],
      audience: { todos: false, professores, cursos },
    };
  }

  const appTimeZone = env.APP_TIMEZONE || 'America/Sao_Paulo';

  function zonedScheduleIso(date, time) {
    if (!isCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let candidate = target;
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: appTimeZone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
      const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      candidate += target - represented;
    }
    return new Date(candidate).toISOString();
  }

  function scheduleIsPast(date, time) {
    const scheduled = zonedScheduleIso(date, time);
    return Boolean(scheduled) && Date.parse(scheduled) < Date.now();
  }

  function zonedTodayDate(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: appTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function announcementScheduleParts(value) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: appTimeZone,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }

  async function supportTicketForSession(ticketId, session) {
    const where = session.role === 'professor' ? 'AND support_tickets.requester_user_id=?' : '';
    return db.prepare(`
      SELECT support_tickets.*,users.name AS requester_name,users.email AS requester_email
      FROM support_tickets
      JOIN users ON users.id=support_tickets.requester_user_id
      WHERE support_tickets.id=? ${where}
    `).get(ticketId, ...(session.role === 'professor' ? [session.user_id] : []));
  }

  async function markSupportTicketRead(ticketId, userId, requestedMessageId) {
    const latest = requestedMessageId
      ? await db.prepare('SELECT id FROM support_messages WHERE ticket_id=? AND id=?').get(ticketId,requestedMessageId)
      : await db.prepare('SELECT MAX(id) AS id FROM support_messages WHERE ticket_id=?').get(ticketId);
    if (!latest?.id) return;
    await db.prepare(`
      INSERT INTO support_ticket_reads (ticket_id,user_id,last_read_message_id,updated_at)
      VALUES (?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(ticket_id,user_id) DO UPDATE SET
        last_read_message_id=excluded.last_read_message_id,
        updated_at=CURRENT_TIMESTAMP
    `).run(ticketId,userId,latest.id);
  }

  async function listSupportTickets(session, url) {
    const clauses = [];
    const whereParams = [];
    if (session.role === 'professor') {
      clauses.push('support_tickets.requester_user_id=?');
      whereParams.push(session.user_id);
    }
    const search = cleanText(url.searchParams.get('search'),120);
    if (search) {
      clauses.push(`(
        CAST(support_tickets.id AS TEXT) LIKE ? OR support_tickets.subject LIKE ? OR users.name LIKE ? OR users.email LIKE ? OR
        EXISTS (SELECT 1 FROM support_messages searched_messages WHERE searched_messages.ticket_id=support_tickets.id AND searched_messages.body LIKE ?)
      )`);
      const pattern = `%${search}%`;
      whereParams.push(pattern,pattern,pattern,pattern,pattern);
    }
    const requestedStatus = cleanText(url.searchParams.get('status'),30);
    if (requestedStatus && SUPPORT_STATUSES.includes(requestedStatus)) {
      clauses.push('support_tickets.status=?');
      whereParams.push(supportStatusToDatabase(requestedStatus));
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.prepare(`
      SELECT support_tickets.*,users.name AS requester_name,users.email AS requester_email,
        last_message.body AS last_message,last_message.created_at AS last_message_at,
        last_author.role AS last_author_role,
        (SELECT COUNT(*) FROM support_messages counted_messages WHERE counted_messages.ticket_id=support_tickets.id) AS message_count,
        (SELECT COUNT(*) FROM support_messages unread_messages
          WHERE unread_messages.ticket_id=support_tickets.id
            AND unread_messages.author_user_id<>?
            AND unread_messages.id>COALESCE(ticket_read.last_read_message_id,0)) AS unread_count
      FROM support_tickets
      JOIN users ON users.id=support_tickets.requester_user_id
      LEFT JOIN support_ticket_reads ticket_read ON ticket_read.ticket_id=support_tickets.id AND ticket_read.user_id=?
      LEFT JOIN support_messages last_message ON last_message.id=(
        SELECT latest_message.id FROM support_messages latest_message
        WHERE latest_message.ticket_id=support_tickets.id
        ORDER BY latest_message.created_at DESC,latest_message.id DESC LIMIT 1
      )
      LEFT JOIN users last_author ON last_author.id=last_message.author_user_id
      ${where}
      ORDER BY support_tickets.updated_at DESC,support_tickets.id DESC
      LIMIT 200
    `).all(session.user_id,session.user_id,...whereParams);
    const tickets = rows.map(supportTicketView).filter(ticket => url.searchParams.get('unread') !== '1' || ticket.nao_lidas > 0);
    return tickets.sort((left,right) => {
      if (left.nao_lidas !== right.nao_lidas) return right.nao_lidas-left.nao_lidas;
      const expected = session.role === 'gestor' ? 'Gestor' : 'Professor';
      if ((left.aguardando===expected) !== (right.aguardando===expected)) return left.aguardando===expected ? -1 : 1;
      if ((left.status==='Resolvido') !== (right.status==='Resolvido')) return left.status==='Resolvido' ? 1 : -1;
      return new Date(right.ultima_mensagem_em)-new Date(left.ultima_mensagem_em);
    });
  }

  const api = createApiHandler({
    db,
    originAllowed,
    json,
    usesSupabaseAuth,
    readJson,
    cleanEmail,
    consumeAuthRateLimit,
    rateLimitResponse,
    verifyPassword,
    createAppSession,
    publicUser,
    cookie,
    currentSession,
    userFromSupabaseToken,
    baseUrl,
    sendEmail,
    notificationService,
    normalizeNotificationPreferences,
    sha256,
    isProduction,
    issueProfessorInvite,
    strongPassword,
    requireSupabaseAdmin,
    supabaseAdmin,
    hashPassword,
    randomBytes,
    randomUUID,
    authorize,
    cleanText,
    personNameError,
    emailError,
    hasValidationErrors,
    invalid,
    phoneError,
    validateSchoolYear,
    isCalendarDate,
    schoolYearView,
    duplicateError,
    selectedSchoolYear,
    catalogNameError,
    validateStudentContact,
    activeChurch,
    studentSelect,
    studentView,
    validateStudent,
    studentClassIds,
    studentCourseNames,
    activeClassesForStudent,
    validateClassDetails,
    professorDeletionImpact,
    validateProfessor,
    zonedTodayDate,
    announcementScheduledCondition,
    appTimeZone,
    announcementScheduleParts,
    sanitizeAnnouncementContent,
    normalizeAnnouncementRecipients,
    normalizeAnnouncementAttachments,
    prepareStoredAttachments,
    insertAnnouncementAttachments,
    removeStoredAttachments,
    announcementStorageBucket,
    useSupabaseAttachmentStorage,
    profilePhotoStorage,
    normalizeProfilePhoto,
    ANNOUNCEMENT_ATTACHMENT_TOTAL_BYTES,
    ANNOUNCEMENT_ATTACHMENT_MAX_COUNT,
    supportTicketForSession,
    markSupportTicketRead,
    listSupportTickets,
    supportTicketView,
    supportStatusToDatabase,
    validateSupportTicket,
    supportMessageError,
    supportClientMessageIdError,
    SUPPORT_CATEGORIES,
    SUPPORT_STATUSES,
    requiredTextError,
    supportStatusFromDatabase,
    securityHeaders,
    zonedScheduleIso,
    scheduleIsPast,
    logger,
  });
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
  }

  function handleError(request, response, error) {
    const requestId = randomUUID();
    let pathname = 'desconhecido';
    try { pathname = new URL(request.url, baseUrl).pathname; } catch {}
    logger.error('http_request_failed', error, { requestId, method: request.method, path: pathname });
    if (!response.headersSent) {
      if (error.code === 'PAYLOAD_TOO_LARGE') json(response, 413, { message: 'A solicitação excede o tamanho permitido.', requestId }, { 'X-Request-Id': requestId });
      else if (error.code === 'INVALID_JSON') json(response, 400, { message: 'O corpo da solicitação contém JSON inválido.', requestId }, { 'X-Request-Id': requestId });
      else json(response, 500, { message: 'Erro interno do servidor.', requestId }, { 'X-Request-Id': requestId });
    } else response.destroy();
  }

  async function handler(request, response, url) {
    try {
      return await api(request, response, url || new URL(request.url, baseUrl));
    } catch (error) {
      return handleError(request, response, error);
    }
  }

  return { handler, isApiPath, securityHeaders, json, handleError };
}
