import http from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { createDatabase } from './database.mjs';
import {
  catalogNameError,
  cleanText,
  emailError,
  hasValidationErrors,
  normalizeEmail,
  personNameError,
  phoneError,
  requiredTextError,
  validateStudent,
  validateProfessor,
  validateClassSchedule,
  validateSupportTicket,
  supportMessageError,
  supportClientMessageIdError,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
} from '../shared/validation.mjs';

const scrypt = promisify(scryptCallback);
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const distRoot = join(projectRoot, 'dist');
const dataRoot = join(here, 'data');
const sqlitePath = process.env.SQLITE_PATH || join(dataRoot, 'projeto-aprendiz.db');
const port = Number(process.env.PORT || 4180);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const baseUrl = process.env.APP_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : `http://127.0.0.1:${port}`);
const appOrigin = new URL(baseUrl).origin;
const isProduction = process.env.NODE_ENV === 'production';
const authProvider = process.env.AUTH_PROVIDER || (process.env.SUPABASE_URL ? 'supabase' : 'local');
const usesSupabaseAuth = authProvider === 'supabase';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (usesSupabaseAuth && (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)) {
  throw new Error('SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY são obrigatórias com AUTH_PROVIDER=supabase.');
}

const supabaseAuth = usesSupabaseAuth
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    })
  : null;

const supabaseAdmin = usesSupabaseAuth && supabaseSecretKey
  ? createClient(process.env.SUPABASE_URL, supabaseSecretKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    })
  : null;

await mkdir(dataRoot, { recursive: true });
const db = await createDatabase({ sqlitePath });
const currentTimestampSql = db.dialect === 'sqlite' ? `strftime('%Y-%m-%dT%H:%M:%fZ','now')` : 'CURRENT_TIMESTAMP';
const announcementScheduledCondition = column => `${column} <= ${currentTimestampSql}`;
if (db.dialect === 'sqlite') await db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    auth_user_id TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('gestor','professor')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS dev_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS professor_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT,
    home_location_id INTEGER REFERENCES locations(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS professor_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professor_profile_id INTEGER NOT NULL REFERENCES professor_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT,
    church TEXT,
    location_id INTEGER REFERENCES locations(id),
    age_group TEXT,
    has_instrument INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    professor_id INTEGER NOT NULL REFERENCES professor_profiles(id),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    label TEXT,
    weekday TEXT,
    start_time TEXT,
    capacity INTEGER,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','concluida','cancelada')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','concluida','cancelada')),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    end_reason TEXT,
    created_by INTEGER REFERENCES users(id),
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    class_date TEXT NOT NULL,
    recorded_by INTEGER NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, class_date)
  );
  CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id),
    status TEXT NOT NULL CHECK(status IN ('presente','ausente','justificado')),
    UNIQUE(session_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pinned INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(announcement_id,user_id)
  );
  CREATE TABLE IF NOT EXISTS announcement_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp','image/heic','image/heif','application/pdf')),
    size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 10485760),
    data_url TEXT,
    storage_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(data_url IS NOT NULL OR storage_path IS NOT NULL)
  );
  CREATE INDEX IF NOT EXISTS announcement_attachments_announcement_id_idx ON announcement_attachments(announcement_id);
  CREATE UNIQUE INDEX IF NOT EXISTS announcement_attachments_storage_path_unique ON announcement_attachments(storage_path) WHERE storage_path IS NOT NULL;
  CREATE TABLE IF NOT EXISTS announcement_recipients (
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    recipient_type TEXT NOT NULL CHECK(recipient_type IN ('professor','curso')),
    recipient_id INTEGER NOT NULL,
    PRIMARY KEY (announcement_id, recipient_type, recipient_id)
  );
  CREATE INDEX IF NOT EXISTS announcement_recipients_lookup_idx ON announcement_recipients(recipient_type, recipient_id, announcement_id);
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_user_id INTEGER NOT NULL REFERENCES users(id),
    subject TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Outro' CHECK(category IN ('Acesso ao sistema','Alunos','Turmas','Frequência','Cursos','Relatórios','Outro')),
    status TEXT NOT NULL DEFAULT 'Aberto' CHECK(status IN ('Aberto','Pendente','Resolvido')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_user_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    client_message_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS support_ticket_reads (
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id INTEGER REFERENCES support_messages(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(ticket_id,user_id)
  );
  CREATE INDEX IF NOT EXISTS support_ticket_reads_user_id_idx ON support_ticket_reads(user_id);
  CREATE TABLE IF NOT EXISTS support_ticket_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('status_changed')),
    from_status TEXT,
    to_status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_activity_idx ON support_ticket_events(ticket_id,created_at,id);
  CREATE INDEX IF NOT EXISTS support_ticket_events_actor_user_id_idx ON support_ticket_events(actor_user_id);
  CREATE TABLE IF NOT EXISTS dropout_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    reason TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS student_followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    reason TEXT NOT NULL,
    contact_type TEXT,
    outcome TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS waitlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    status TEXT DEFAULT 'aguardando',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS student_followups_student_id_idx ON student_followups(student_id);
  CREATE INDEX IF NOT EXISTS student_followups_class_id_idx ON student_followups(class_id);
`);
if (db.dialect === 'sqlite') {
  const userColumns = await db.prepare('PRAGMA table_info(users)').all();
  if (!userColumns.some(column => column.name === 'auth_user_id')) {
    await db.exec('ALTER TABLE users ADD COLUMN auth_user_id TEXT; CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_unique ON users(auth_user_id);');
  }
  const supportTicketColumns = await db.prepare('PRAGMA table_info(support_tickets)').all();
  if (!supportTicketColumns.some(column => column.name === 'category')) {
    await db.exec("ALTER TABLE support_tickets ADD COLUMN category TEXT NOT NULL DEFAULT 'Outro';");
  }
  const supportMessageColumns = await db.prepare('PRAGMA table_info(support_messages)').all();
  if (!supportMessageColumns.some(column => column.name === 'client_message_id')) {
    await db.exec('ALTER TABLE support_messages ADD COLUMN client_message_id TEXT;');
  }
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS support_messages_author_client_message_unique ON support_messages(author_user_id,client_message_id) WHERE client_message_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS support_messages_ticket_activity_idx ON support_messages(ticket_id,created_at,id);
  `);
  const attachmentTable = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='announcement_attachments'").get();
  if (!String(attachmentTable?.sql || '').includes('application/pdf')) {
    await db.exec(`
      DROP INDEX IF EXISTS announcement_attachments_announcement_id_idx;
      DROP INDEX IF EXISTS announcement_attachments_storage_path_unique;
      ALTER TABLE announcement_attachments RENAME TO announcement_attachments_legacy;
      CREATE TABLE announcement_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp','image/heic','image/heif','application/pdf')),
        size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 10485760),
        data_url TEXT,
        storage_path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK(data_url IS NOT NULL OR storage_path IS NOT NULL)
      );
      INSERT INTO announcement_attachments (id,announcement_id,filename,mime_type,size_bytes,data_url,created_at)
        SELECT id,announcement_id,filename,mime_type,size_bytes,data_url,created_at FROM announcement_attachments_legacy;
      DROP TABLE announcement_attachments_legacy;
      CREATE INDEX announcement_attachments_announcement_id_idx ON announcement_attachments(announcement_id);
      CREATE UNIQUE INDEX announcement_attachments_storage_path_unique ON announcement_attachments(storage_path) WHERE storage_path IS NOT NULL;
    `);
  }
  const studentColumns = await db.prepare('PRAGMA table_info(students)').all();
  if (!studentColumns.some(c => c.name === 'location_id')) {
    await db.exec('ALTER TABLE students ADD COLUMN location_id INTEGER REFERENCES locations(id);');
    await db.exec('UPDATE students SET location_id = (SELECT id FROM locations WHERE LOWER(locations.name) = LOWER(students.church));');
  }
  const classesColumns = await db.prepare('PRAGMA table_info(classes)').all();
  if (!classesColumns.some(c => c.name === 'capacity')) {
    await db.exec(`
      ALTER TABLE classes ADD COLUMN capacity INTEGER;
      ALTER TABLE classes ADD COLUMN start_date TEXT;
      ALTER TABLE classes ADD COLUMN end_date TEXT;
      ALTER TABLE classes ADD COLUMN status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','concluida','cancelada'));
      -- SQLite não permite DROP CONSTRAINT nativo sem recrear a tabela. Vamos deixar a constraint lá por enquanto se for DB antigo
    `);
  }
  const enrollmentsColumns = await db.prepare('PRAGMA table_info(enrollments)').all();
  if (!enrollmentsColumns.some(c => c.name === 'started_at')) {
    await db.exec(`
      ALTER TABLE enrollments RENAME TO enrollments_legacy;
      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        class_id INTEGER NOT NULL REFERENCES classes(id),
        status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','concluida','cancelada')),
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at TEXT,
        end_reason TEXT,
        created_by INTEGER REFERENCES users(id),
        enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO enrollments (id,student_id,class_id,status,enrolled_at,started_at)
        SELECT id,student_id,class_id,status,enrolled_at,enrolled_at FROM enrollments_legacy;
      DROP TABLE enrollments_legacy;
    `);
  }
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const cleanEmail = normalizeEmail;
const publicUser = user => ({ id: user.id, nome: user.name, email: user.email, role: user.role });
const strongPassword = value => typeof value === 'string' && value.length >= 10 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

function invalid(response, errors, fallback = 'Revise os campos informados.') {
  return json(response, 400, { message: Object.values(errors).find(Boolean) || fallback, errors });
}

function duplicateError(error) {
  return error?.code === '23505' || String(error).includes('UNIQUE');
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [, saltHex, hashHex] = String(encoded).split('$');
  if (!saltHex || !hashHex) return false;
  const derived = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

async function sendEmail(recipient, subject, body, idempotencyKey) {
  if (!isProduction) {
    await db.prepare('INSERT INTO dev_emails (recipient,subject,body) VALUES (?,?,?)').run(recipient, subject, body);
    return { local: true };
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('RESEND_API_KEY e EMAIL_FROM são obrigatórias para enviar e-mails em produção.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [recipient], subject, text: body,
    }),
  });
  if (!response.ok) {
    const providerResponse = await response.json().catch(() => ({}));
    const error = new Error(`Falha no envio de e-mail (${response.status}).`);
    error.code = 'EMAIL_DELIVERY_FAILED';
    error.providerMessage = String(providerResponse?.message || '').slice(0, 300);
    throw error;
  }
  return response.json();
}

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
    console.error('Não foi possível enviar o convite do professor:', error.message, error.providerMessage || '');
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(createdBy, 'professor_invite_email_failed', ip);
    return { inviteSent: false, expiresAt: expires };
  }
}

async function seedUser(name, email, password, role) {
  if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return;
  await db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run(name, email, await hashPassword(password || randomBytes(48).toString('base64url')), role);
}

const seedDemoData = process.env.SEED_DEMO_DATA === 'true' || !isProduction;
if (seedDemoData) {
  await seedUser('Admin Regional', 'gestor@projetoaprendiz.local', 'Gestor@2026!', 'gestor');
  await seedUser('Marina Oliveira', 'professor@projetoaprendiz.local', 'Professor@2026!', 'professor');
} else if (process.env.BOOTSTRAP_ADMIN_EMAIL && (usesSupabaseAuth || process.env.BOOTSTRAP_ADMIN_PASSWORD)) {
  if (!usesSupabaseAuth && !strongPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD)) throw new Error('BOOTSTRAP_ADMIN_PASSWORD não atende aos requisitos de segurança.');
  await seedUser(process.env.BOOTSTRAP_ADMIN_NAME || 'Administrador', cleanEmail(process.env.BOOTSTRAP_ADMIN_EMAIL), process.env.BOOTSTRAP_ADMIN_PASSWORD, 'gestor');
}
if (!seedDemoData && !(await db.prepare('SELECT id FROM users LIMIT 1').get())) {
  throw new Error(usesSupabaseAuth ? 'Defina BOOTSTRAP_ADMIN_EMAIL com o e-mail do primeiro Gestor criado no Supabase Auth.' : 'Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD para criar o primeiro Gestor.');
}

async function seedAcademicData() {
  const locationNames = ['Pituba', 'Brotas', 'Lauro de Freitas', 'Guarani', 'Boca do Rio', 'Alto de Coutos', 'Remoto'];
  const courseNames = ['Violão I', 'Teclado', 'Bateria', 'Canto Coral', 'Violino', 'Flauta Transversal', 'Saxofone', 'Contrabaixo', 'Violão II', 'Teoria Musical'];
  for (const name of locationNames) await db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(name);
  for (const name of courseNames) await db.prepare('INSERT OR IGNORE INTO courses (name) VALUES (?)').run(name);

  const professorUser = await db.prepare('SELECT id FROM users WHERE email = ?').get('professor@projetoaprendiz.local');
  const profiles = [
    ['Marina Oliveira','professor@projetoaprendiz.local','(71) 98888-1000','Pituba',professorUser.id],
    ['João Silva','joao.silva@projetoaprendiz.local','(71) 98888-1111','Pituba',null],
    ['Carlos Souza','carlos.souza@projetoaprendiz.local','(71) 98888-3333','Lauro de Freitas',null],
    ['Ana Costa','ana.costa@projetoaprendiz.local','(71) 98888-4444','Pituba',null],
    ['Pedro Santos','pedro.santos@projetoaprendiz.local','(71) 98888-5555','Brotas',null],
  ];
  for (const [name,email,phone,location,userId] of profiles) {
    const locationId = (await db.prepare('SELECT id FROM locations WHERE name = ?').get(location)).id;
    await db.prepare('INSERT OR IGNORE INTO professor_profiles (user_id,name,email,phone,home_location_id) VALUES (?,?,?,?,?)').run(userId,name,email,phone,locationId);
  }

  const offerings = [
    ['Violão I','Pituba','Marina Oliveira'], ['Teclado','Brotas','Marina Oliveira'],
    ['Bateria','Lauro de Freitas','Carlos Souza'], ['Canto Coral','Pituba','Ana Costa'],
    ['Violino','Brotas','Pedro Santos'], ['Flauta Transversal','Boca do Rio','Marina Oliveira'],
    ['Saxofone','Brotas','Pedro Santos'], ['Contrabaixo','Alto de Coutos','Carlos Souza'],
    ['Violão II','Pituba','João Silva'], ['Teoria Musical','Remoto','Marina Oliveira'],
  ];
  for (const [course,location,professor] of offerings) {
    const courseId = (await db.prepare('SELECT id FROM courses WHERE name = ?').get(course)).id;
    const locationId = (await db.prepare('SELECT id FROM locations WHERE name = ?').get(location)).id;
    const professorId = (await db.prepare('SELECT id FROM professor_profiles WHERE name = ?').get(professor)).id;
    await db.prepare('INSERT OR IGNORE INTO classes (course_id,professor_id,location_id,label,weekday,start_time) VALUES (?,?,?,?,?,?)')
      .run(courseId,professorId,locationId,`${course} — ${location}`,'Sábado','09:00');
  }

  const studentRows = [
    ['João Pereira','joao.pereira@email.com','(71) 98821-1040','ICM Pituba','Jovem',1,'Violão I','Pituba'],
    ['Maria Clara','maria.clara@email.com','(71) 97732-2151','ICM Brotas','Adolescente',0,'Teclado','Brotas'],
    ['Pedro Almeida','pedro.almeida@email.com','(71) 96643-3262','ICM Lauro','Jovem',1,'Bateria','Lauro de Freitas'],
    ['Ana Beatriz','ana.beatriz@email.com','(71) 95554-4373','ICM Pituba','Jovem',0,'Canto Coral','Pituba'],
    ['Lucas Guimarães','lucas.guimaraes@email.com','(71) 94465-5484','ICM Brotas','Adolescente',1,'Violino','Brotas'],
    ['Gabriela Santos','gabriela.santos@email.com','(71) 93376-6595','ICM Boca do Rio','Jovem',1,'Flauta Transversal','Boca do Rio'],
    ['Rafael Souza','rafael.souza@email.com','(71) 92287-7606','ICM Alto de Coutos','Varão',1,'Contrabaixo','Alto de Coutos'],
    ['Juliana Costa','juliana.costa@email.com','(71) 91198-8717','ICM Remoto','Senhora',0,'Teoria Musical','Remoto'],
    ['Ricardo Alves','ricardo.alves@email.com','(71) 90019-9828','ICM Pituba','Varão',1,'Violão II','Pituba'],
    ['Camila Rocha','camila.rocha@email.com','(71) 98920-0939','ICM Brotas','Jovem',1,'Saxofone','Brotas'],
    ['Bruno Lima','bruno.lima@email.com','(71) 97831-1050','ICM Pituba','Adolescente',0,'Violão I','Pituba'],
    ['Larissa Melo','larissa.melo@email.com','(71) 96742-2161','ICM Brotas','Jovem',0,'Teclado','Brotas'],
  ];
  for (const [name,email,phone,church,ageGroup,instrument,course,location] of studentRows) {
    await db.prepare('INSERT OR IGNORE INTO students (name,email,phone,church,age_group,has_instrument) VALUES (?,?,?,?,?,?)')
      .run(name,email,phone,church,ageGroup,instrument);
    const studentId = (await db.prepare('SELECT id FROM students WHERE email = ?').get(email)).id;
    const classRow = await db.prepare(`SELECT classes.id FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE courses.name=? AND locations.name=?`).get(course,location);
    if (classRow) await db.prepare('INSERT OR IGNORE INTO enrollments (student_id,class_id) VALUES (?,?)').run(studentId,classRow.id);
  }
}

if (seedDemoData) await seedAcademicData();

async function seedCommunicationData() {
  const gestor = await db.prepare('SELECT id FROM users WHERE role=? ORDER BY id LIMIT 1').get('gestor');
  const professor = await db.prepare('SELECT id FROM users WHERE email=?').get('professor@projetoaprendiz.local');
  if (!await db.prepare('SELECT id FROM announcements LIMIT 1').get()) {
    const rows = [
      ['Reunião pedagógica','Urgente','A reunião mensal será realizada na sexta-feira, às 18h.','2026-08-24T12:00:00Z',1],
      ['Recital de primavera','Eventos','As inscrições para apresentações estão abertas até 5 de setembro.','2026-08-20T12:00:00Z',1],
      ['Atualização do calendário','Geral','O calendário de aulas e reposições do próximo mês já está disponível.','2026-08-17T12:00:00Z',0],
      ['Novos materiais didáticos','Inscrições','Os materiais complementares foram adicionados à biblioteca.','2026-08-12T12:00:00Z',0],
    ];
    for (const [title,category,content,scheduled,pinned] of rows) {
      await db.prepare('INSERT INTO announcements (author_user_id,title,category,content,scheduled_at,published_at,pinned) VALUES (?,?,?,?,?,?,?)')
        .run(gestor.id,title,category,content,scheduled,scheduled,pinned);
    }
  }
  if (!await db.prepare('SELECT id FROM support_tickets LIMIT 1').get()) {
    const tickets = [
      ['Ajuste na lista de chamada','Alunos','Um aluno novo ainda não aparece na turma de Violão I.','Aberto','2026-08-23T14:30:00Z'],
      ['Projetor da sala 3','Outro','O projetor está com a imagem oscilando.','Pendente','2026-08-18T09:15:00Z'],
      ['Material de teoria musical','Cursos','Solicitação de novas cópias das apostilas.','Resolvido','2026-08-02T10:00:00Z'],
    ];
    for (const [subject,category,message,status,created] of tickets) {
      const result=await db.prepare('INSERT INTO support_tickets (requester_user_id,subject,category,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(professor.id,subject,category,status,created,created);
      await db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,created_at) VALUES (?,?,?,?)').run(result.lastInsertRowid,professor.id,message,created);
    }
  }
  if (!await db.prepare('SELECT id FROM dropout_events LIMIT 1').get()) {
    const historical = [
      ['Fernando Mendes','fernando.mendes@email.com','Saxofone','Brotas','Conflito de horários','2026-04-22'],
      ['Gustavo Rocha','gustavo.rocha@email.com','Contrabaixo','Alto de Coutos','Questões pessoais','2026-03-30'],
    ];
    for(const [name,email,course,location,reason,date] of historical){
      await db.prepare('INSERT OR IGNORE INTO students (name,email,active) VALUES (?,?,0)').run(name,email);
      const studentId=(await db.prepare('SELECT id FROM students WHERE email=?').get(email)).id;
      const classRow=await db.prepare(`SELECT classes.id FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE courses.name=? AND locations.name=?`).get(course,location);
      await db.prepare("INSERT OR IGNORE INTO enrollments (student_id,class_id,status,enrolled_at) VALUES (?,?,'cancelada','2026-02-01')").run(studentId,classRow.id);
      await db.prepare('INSERT INTO dropout_events (student_id,class_id,reason,occurred_at) VALUES (?,?,?,?)').run(studentId,classRow.id,reason,date);
    }
  }
}

if (seedDemoData) await seedCommunicationData();
await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
await db.prepare('DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL').run(new Date().toISOString());

const attempts = new Map();
function limited(key, maximum, windowMs) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(time => now - time < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > maximum;
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2));
}

function cookie(name, value, maxAge = null) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${maxAge !== null ? `; Max-Age=${maxAge}` : ''}${isProduction ? '; Secure' : ''}`;
}

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  const connectSources = ["'self'"];
  if (process.env.SUPABASE_URL) connectSources.push(new URL(process.env.SUPABASE_URL).origin);
  const headers = {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src ${connectSources.join(' ')}; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`,
    'Cache-Control': 'no-store',
  };
  if (isProduction) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}

function json(response, status, data, extra = {}) {
  response.writeHead(status, { ...securityHeaders(), ...extra });
  response.end(JSON.stringify(data));
}

async function readJson(request, maxBytes = 32768) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maxBytes) throw new Error('PAYLOAD_TOO_LARGE');
  }
  return body ? JSON.parse(body) : {};
}

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
  const sessionDuration = remember ? 30 * 86400 : 8 * 3600;
  const expires = new Date(Date.now() + sessionDuration * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (user_id,token_hash,csrf_token,expires_at) VALUES (?,?,?,?)').run(user.id, sha256(token), csrfToken, expires);
  await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(user.id, 'login', ip);
  return { token, csrfToken, maxAge: remember ? sessionDuration : null };
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

function originAllowed(request) {
  const origin = request.headers.origin;
  return !origin || origin === appOrigin;
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
  const attendanceSummary = await db.prepare(`
    SELECT COUNT(*) AS total FROM attendance_records
    JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id
    JOIN classes ON classes.id=attendance_sessions.class_id
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
      frequencias: Number(attendanceSummary?.total || 0),
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
    id: row.id, nome: row.name, email: row.email, contato: row.email,
    telefone: row.phone || '', igreja: row.church || '', classe: row.age_group || '',
    instrumento: row.has_instrument ? 'Sim' : 'Não', curso: courseNames,
    local: row.church || '', foto_url: '',
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

async function activeClassesForStudent(classIds, legacyCourseNames = []) {
  let classes = [];
  if (classIds.length) {
    const placeholders = classIds.map(() => '?').join(',');
    classes = await db.prepare(`
      SELECT classes.id,classes.course_id,courses.name AS course_name
      FROM classes
      JOIN courses ON courses.id=classes.course_id
      JOIN locations ON locations.id=classes.location_id
      WHERE classes.id IN (${placeholders})
        AND classes.active=1 AND courses.active=1 AND locations.active=1
      ORDER BY classes.id
    `).all(...classIds);
    if (classes.length !== classIds.length) return { classes: [], error: 'Uma das turmas selecionadas não está mais disponível.' };
  } else if (legacyCourseNames.length) {
    const placeholders = legacyCourseNames.map(() => '?').join(',');
    classes = await db.prepare(`
      SELECT MIN(classes.id) AS id,courses.id AS course_id,courses.name AS course_name
      FROM classes
      JOIN courses ON courses.id=classes.course_id
      JOIN locations ON locations.id=classes.location_id
      WHERE courses.name IN (${placeholders})
        AND classes.active=1 AND courses.active=1 AND locations.active=1
      GROUP BY courses.id,courses.name
      ORDER BY courses.name
    `).all(...legacyCourseNames);
    if (classes.length !== legacyCourseNames.length) return { classes: [], error: 'Um dos cursos selecionados não possui turma ativa.' };
  }
  if (new Set(classes.map(item => item.course_id)).size !== classes.length) {
    return { classes: [], error: 'Escolha apenas uma turma para cada curso.' };
  }
  return { classes, error: '' };
}

const studentSelect = `
  SELECT students.*,
    GROUP_CONCAT(classes.id || '::' || courses.name || '::' || locations.name, '||') AS class_offerings
  FROM students
  LEFT JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa'
  LEFT JOIN classes ON classes.id=enrollments.class_id AND classes.active=1
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

const ANNOUNCEMENT_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);
const ANNOUNCEMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ANNOUNCEMENT_PDF_MAX_BYTES = 10 * 1024 * 1024;
const ANNOUNCEMENT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
const ANNOUNCEMENT_ATTACHMENT_MAX_COUNT = 5;
const announcementStorageBucket = process.env.SUPABASE_ANNOUNCEMENT_BUCKET || 'announcement-attachments';
const useSupabaseAttachmentStorage = Boolean(supabaseAdmin) && process.env.ANNOUNCEMENT_STORAGE_PROVIDER !== 'database';
let announcementBucketPromise;

const attachmentExtensions = {
  'image/png': new Set(['.png']),
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/webp': new Set(['.webp']),
  'image/heic': new Set(['.heic']),
  'image/heif': new Set(['.heif']),
  'application/pdf': new Set(['.pdf']),
};

function detectedAttachmentMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (['heic','heix','hevc','hevx'].includes(brand)) return 'image/heic';
    if (['heif','mif1','msf1'].includes(brand)) return 'image/heif';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 5).toString('ascii') === '%PDF-' && buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from('%%EOF'))) return 'application/pdf';
  return '';
}

function safeAttachmentFilename(value, mime) {
  const extension = extname(String(value || '')).toLowerCase();
  if (!attachmentExtensions[mime]?.has(extension)) return '';
  const withoutControls = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleanText(withoutControls, 180) || `anexo${extension}`;
}

function normalizeAnnouncementAttachments(value, existingAttachments = new Map()) {
  const source = value == null ? [] : value;
  if (!Array.isArray(source)) return { error: 'Os anexos precisam ser uma lista de arquivos.' };
  if (source.length > ANNOUNCEMENT_ATTACHMENT_MAX_COUNT) return { error: `Adicione no máximo ${ANNOUNCEMENT_ATTACHMENT_MAX_COUNT} arquivos por informativo.` };
  const items = [];
  const fingerprints = new Set();
  const retainedIds = new Set();
  let totalBytes = 0;
  for (const item of source) {
    const mime = String(item?.tipo || '').trim().toLowerCase();
    const dataUrl = String(item?.dataUrl || '').trim();
    if (!dataUrl && item?.id != null) {
      const existing = existingAttachments.get(Number(item.id));
      if (existing) {
        if (retainedIds.has(Number(existing.id))) return { error: 'O mesmo anexo foi informado mais de uma vez.' };
        retainedIds.add(Number(existing.id));
        totalBytes += Number(existing.size_bytes);
        items.push({ ...existing, id: Number(existing.id), existing: true });
        continue;
      }
      return { error: 'Um dos anexos não pertence a este informativo.' };
    }
    const match = dataUrl.match(/^data:([a-z0-9.+/-]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!ANNOUNCEMENT_ATTACHMENT_TYPES.has(mime) || !match || match[1].toLowerCase() !== mime) {
      return { error: 'Cada anexo precisa ser uma imagem PNG, JPG/JPEG, WEBP, HEIC/HEIF ou um PDF válido.' };
    }
    const base64 = match[2].replace(/\s/g, '');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.toString('base64').replace(/=+$/,'') !== base64.replace(/=+$/,'')) return { error: 'Um dos anexos possui conteúdo Base64 inválido.' };
    const detectedMime = detectedAttachmentMime(buffer);
    if (detectedMime !== mime) return { error: 'O conteúdo de um dos arquivos não corresponde ao tipo informado.' };
    const maxBytes = mime === 'application/pdf' ? ANNOUNCEMENT_PDF_MAX_BYTES : ANNOUNCEMENT_IMAGE_MAX_BYTES;
    if (!buffer.length || buffer.length > maxBytes) return { error: mime === 'application/pdf' ? 'Cada PDF deve ter no máximo 10 MB.' : 'Cada imagem deve ter no máximo 5 MB.' };
    const filename = safeAttachmentFilename(item?.nome, mime);
    if (!filename) return { error: 'A extensão de um dos arquivos não corresponde ao seu conteúdo.' };
    const fingerprint = sha256(buffer);
    if (fingerprints.has(fingerprint)) return { error: 'O mesmo arquivo foi selecionado mais de uma vez.' };
    fingerprints.add(fingerprint);
    totalBytes += buffer.length;
    items.push({ filename, mime_type: mime, size_bytes: buffer.length, data_url: dataUrl, buffer, fingerprint, existing: false });
  }
  if (totalBytes > ANNOUNCEMENT_ATTACHMENT_TOTAL_BYTES) return { error: 'O total dos anexos deve ter no máximo 20 MB.' };
  return { items, existingItems: items.filter(item => item.existing), newItems: items.filter(item => !item.existing) };
}

async function ensureAnnouncementBucket() {
  if (!useSupabaseAttachmentStorage) return;
  announcementBucketPromise ||= (async () => {
    const { data, error } = await supabaseAdmin.storage.getBucket(announcementStorageBucket);
    if (data && !error) return;
    const { error: createError } = await supabaseAdmin.storage.createBucket(announcementStorageBucket, {
      public: false,
      fileSizeLimit: ANNOUNCEMENT_PDF_MAX_BYTES,
      allowedMimeTypes: [...ANNOUNCEMENT_ATTACHMENT_TYPES],
    });
    if (createError && !/already exists/i.test(createError.message || '')) throw createError;
  })();
  return announcementBucketPromise;
}

async function storeAnnouncementAttachment(announcementId, item) {
  if (!useSupabaseAttachmentStorage) return { data_url: item.data_url, storage_path: null };
  await ensureAnnouncementBucket();
  const extension = extname(item.filename).toLowerCase();
  const storagePath = `informativos/${announcementId}/${randomUUID()}${extension}`;
  const { error } = await supabaseAdmin.storage.from(announcementStorageBucket).upload(storagePath, item.buffer, {
    contentType: item.mime_type,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw new Error(`Falha ao armazenar ${item.filename}: ${error.message}`);
  return { data_url: null, storage_path: storagePath };
}

async function removeStoredAttachments(paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!useSupabaseAttachmentStorage || !uniquePaths.length) return;
  const { error } = await supabaseAdmin.storage.from(announcementStorageBucket).remove(uniquePaths);
  if (error) throw new Error(`Falha ao remover anexos do storage: ${error.message}`);
}

async function prepareStoredAttachments(announcementId, items) {
  const stored = [];
  try {
    for (const item of items) {
      const location = await storeAnnouncementAttachment(announcementId, item);
      stored.push({ ...item, ...location });
    }
    return stored;
  } catch (error) {
    await removeStoredAttachments(stored.map(item => item.storage_path)).catch(cleanupError => console.error(cleanupError));
    throw error;
  }
}

async function insertAnnouncementAttachments(announcementId, items) {
  for (const item of items) {
    await db.prepare('INSERT INTO announcement_attachments (announcement_id,filename,mime_type,size_bytes,data_url,storage_path) VALUES (?,?,?,?,?,?)')
      .run(announcementId,item.filename,item.mime_type,item.size_bytes,item.data_url || null,item.storage_path || null);
  }
}

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

const appTimeZone = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

function zonedScheduleIso(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
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

async function api(request, response, url) {
  const ip = String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'local').split(',')[0].trim();
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && !originAllowed(request)) {
    return json(response, 403, { message: 'Origem não autorizada.' });
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    await db.prepare('SELECT 1 AS ready').get();
    return json(response, 200, { status: 'ok', database: db.dialect });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    if (usesSupabaseAuth) return json(response, 409, { message: 'Use o login seguro do Supabase.' });
    const { email, password, remember = false } = await readJson(request);
    const normalized = cleanEmail(email);
    if (limited(`login:${ip}:${normalized}`, 5, 15 * 60_000)) return json(response, 429, { message: 'Muitas tentativas. Aguarde alguns minutos.' });
    const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalized);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return json(response, 401, { message: 'E-mail ou senha inválidos.' });
    }
    const { token, csrfToken, maxAge } = await createAppSession(user, ip, remember);
    return json(response, 200, { user: publicUser(user), csrfToken }, { 'Set-Cookie': cookie('pa_session', token, maxAge) });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/exchange') {
    if (!usesSupabaseAuth) return json(response, 404, { message: 'Rota não disponível.' });
    const body = await readJson(request);
    const user = await userFromSupabaseToken(request);
    if (!user) return json(response, 403, { message: 'Conta autenticada, mas sem acesso ativo ao Projeto Aprendiz.' });
    const { token, csrfToken, maxAge } = await createAppSession(user, ip, Boolean(body.remember));
    return json(response, 200, { user: publicUser(user), csrfToken }, { 'Set-Cookie': cookie('pa_session', token, maxAge) });
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
    if (!limited(`reset:${ip}:${normalized}`, 3, 30 * 60_000)) {
      const user = await db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalized);
      if (user && (!usesSupabaseAuth || user.auth_user_id)) {
        const token = randomBytes(32).toString('base64url');
        const expires = new Date(Date.now() + 30 * 60_000).toISOString();
        await db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(user.id);
        await db.prepare('INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES (?,?,?)').run(user.id, sha256(token), expires);
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const body = `Olá, ${user.name}. Use este link em até 30 minutos para redefinir sua senha:\n\n${resetUrl}\n\nSe você não solicitou a alteração, ignore esta mensagem.`;
        try { await sendEmail(user.email, 'Recuperação de senha — Projeto Aprendiz', body, `password-reset-${sha256(token)}`); }
        catch (error) { console.error('Não foi possível enviar recuperação de senha:', error.message, error.providerMessage || ''); }
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
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    return json(response, 200, { message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.', devMailbox: isProduction ? null : '/dev-mail' });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    const { token, password } = await readJson(request);
    if (!strongPassword(password)) return json(response, 400, { message: 'A senha não atende aos requisitos de segurança.' });
    const reset = await db.prepare(`
      SELECT password_resets.*,users.auth_user_id
      FROM password_resets JOIN users ON users.id=password_resets.user_id
      WHERE password_resets.token_hash=? AND password_resets.used_at IS NULL AND password_resets.expires_at>?
    `).get(sha256(String(token || '')), new Date().toISOString());
    if (!reset) return json(response, 400, { message: 'Este link é inválido, expirou ou já foi utilizado.' });
    if (usesSupabaseAuth) {
      if (!requireSupabaseAdmin(response)) return;
      if (!reset.auth_user_id) return json(response, 400, { message: 'Esta conta ainda não foi ativada. Solicite um novo convite.' });
      const { error } = await supabaseAdmin.auth.admin.updateUserById(reset.auth_user_id, { password });
      if (error) {
        console.error('Não foi possível atualizar a senha no Supabase:', error.message);
        return json(response, 502, { message: 'Não foi possível alterar a senha agora. Tente novamente.' });
      }
    }
    const passwordHash = await hashPassword(password);
    await db.transaction(async () => {
      await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, reset.user_id);
      await db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(reset.id);
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
    if(!strongPassword(body.password))return json(response,400,{message:'A senha não atende aos requisitos de segurança.'});
    const invitation=await db.prepare(`SELECT professor_invites.*,professor_profiles.name FROM professor_invites JOIN professor_profiles ON professor_profiles.id=professor_invites.professor_profile_id WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?`).get(sha256(token),new Date().toISOString());
    if(!invitation)return json(response,400,{message:'Este convite é inválido, expirou ou já foi utilizado.'});
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
        console.error('Não foi possível criar o usuário do professor no Supabase:', error.message);
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

  if(request.method==='GET'&&url.pathname==='/api/account'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const row=await db.prepare('SELECT preferences_json FROM user_settings WHERE user_id=?').get(session.user_id);
    let preferences={};try{preferences=JSON.parse(row?.preferences_json||'{}')}catch{}
    return json(response,200,{user:publicUser({id:session.user_id,...session}),preferences});
  }
  if(request.method==='PUT'&&url.pathname==='/api/account/profile'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const body=await readJson(request),name=cleanText(body.nome,100),email=cleanEmail(body.email);
    const errors={nome:personNameError(name,'nome completo'),email:emailError(email)};
    if(hasValidationErrors(errors))return invalid(response,errors);
    const user=await db.prepare('SELECT auth_user_id,email FROM users WHERE id=?').get(session.user_id);
    if(usesSupabaseAuth && user?.auth_user_id && user.email !== email){
      if(!supabaseAdmin)return json(response,503,{message:'Supabase admin indisponível.'});
      const {error}=await supabaseAdmin.auth.admin.updateUserById(user.auth_user_id,{email,email_confirm:true});
      if(error)return json(response,502,{message:'Erro no provedor de autenticação.'});
    }
    try{
      await db.transaction(async () => {
        await db.prepare('UPDATE users SET name=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,email,session.user_id);
        if(session.role==='professor')await db.prepare('UPDATE professor_profiles SET name=?,email=? WHERE user_id=?').run(name,email,session.user_id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'profile_updated',ip);
      });
    }catch(error){if(String(error).includes('UNIQUE'))return json(response,409,{message:'Este e-mail já está em uso.'});throw error;}
    return json(response,200,{user:{id:session.user_id,nome:name,email,role:session.role}});
  }
  if(request.method==='PUT'&&url.pathname==='/api/account/password'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    if(usesSupabaseAuth)return json(response,409,{message:'A senha desta conta é gerenciada pelo Supabase.'});
    const body=await readJson(request),user=await db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
    if(!(await verifyPassword(body.currentPassword,user.password_hash)))return json(response,400,{message:'A senha atual está incorreta.'});
    if(!strongPassword(body.newPassword))return json(response,400,{message:'A nova senha não atende aos requisitos de segurança.'});
    await db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(await hashPassword(body.newPassword),session.user_id);
    await db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').run(session.user_id,session.id);
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'password_changed',ip);
    return json(response,200,{message:'Senha alterada com sucesso.'});
  }
  if(request.method==='PUT'&&url.pathname==='/api/account/preferences'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const body=await readJson(request),preferences=body.preferences&&typeof body.preferences==='object'?body.preferences:{};
    await db.prepare(`INSERT INTO user_settings (user_id,preferences_json) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,updated_at=CURRENT_TIMESTAMP`).run(session.user_id,JSON.stringify(preferences));
    return json(response,200,{preferences});
  }

  if (request.method === 'GET' && url.pathname === '/alunos') {
    if (!await authorize(request, response, ['gestor'])) return;
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
    const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
    const total = (await db.prepare('SELECT COUNT(*) AS total FROM students WHERE active=1 AND (name LIKE ? OR email LIKE ?)').get(search,search)).total;
    const rows = await db.prepare(`${studentSelect} WHERE students.active=1 AND (students.name LIKE ? OR students.email LIKE ?) GROUP BY students.id ORDER BY students.name LIMIT ? OFFSET ?`).all(search,search,limit,(page-1)*limit);
    return json(response, 200, { alunos: rows.map(studentView), total });
  }

  if (request.method === 'POST' && url.pathname === '/alunos') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const body = await readJson(request);
    const name = cleanText(body.nome,100), email = cleanEmail(body.contato || body.email), phone=cleanText(body.telefone,30);
    const rawClassIds=Array.isArray(body.turmas)?body.turmas:[],classIds=studentClassIds(rawClassIds),courseNames=studentCourseNames(body.curso),locationName=cleanText(body.local,100);
    const selections=rawClassIds.length?rawClassIds:courseNames;
    const errors=validateStudent({...body,nome:name,contato:email,telefone:phone,turmas:selections,local:locationName});
    if(rawClassIds.some(value => !Number.isInteger(Number(value)) || Number(value) <= 0))errors.curso='Selecione somente turmas válidas.';
    if(hasValidationErrors(errors))return invalid(response,errors);
    const { classes: classRows, error: classError } = await activeClassesForStudent(classIds, courseNames);
    if (classError) return invalid(response, { curso: classError });
    const location = await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
    const locationId = location ? location.id : null;
    try {
      const studentId=await db.transaction(async()=>{
        const result = await db.prepare('INSERT INTO students (name,email,phone,church,location_id,age_group,has_instrument) VALUES (?,?,?,?,?,?,?)').run(name,email,phone,locationName,locationId,body.classe,body.instrumento === 'Sim' ? 1 : 0);
        for (const classRow of classRows) {
          await db.prepare('INSERT INTO enrollments (student_id,class_id,created_by) VALUES (?,?,?)').run(result.lastInsertRowid,classRow.id,session.user_id);
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_created',ip);
        return Number(result.lastInsertRowid);
      });
      return json(response, 201, { id: studentId });
    } catch (error) {
      if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
      throw error;
    }
  }

  const studentMatch = url.pathname.match(/^\/alunos\/(\d+)$/);
  if (studentMatch && request.method === 'PUT') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const id = Number(studentMatch[1]), body = await readJson(request);
    const name=cleanText(body.nome,100),email=cleanEmail(body.contato||body.email),phone=cleanText(body.telefone,30),rawClassIds=Array.isArray(body.turmas)?body.turmas:[],classIds=studentClassIds(rawClassIds),courseNames=studentCourseNames(body.curso),locationName=cleanText(body.local,100);
    const selections=rawClassIds.length?rawClassIds:courseNames;
    const errors=validateStudent({...body,nome:name,contato:email,telefone:phone,turmas:selections,local:locationName});
    if(rawClassIds.some(value => !Number.isInteger(Number(value)) || Number(value) <= 0))errors.curso='Selecione somente turmas válidas.';
    if(hasValidationErrors(errors))return invalid(response,errors);
    const { classes: classRows, error: classError } = await activeClassesForStudent(classIds, courseNames);
    if (classError) return invalid(response, { curso: classError });
    const currentStudent=await db.prepare('SELECT id FROM students WHERE id=? AND active=1').get(id);
    if(!currentStudent)return json(response,404,{message:'Aluno ativo não encontrado.'});
    const location = await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
    const locationId = location ? location.id : null;
    try {
      await db.transaction(async()=>{
        await db.prepare(`UPDATE students SET name=?,email=?,phone=?,church=?,location_id=?,age_group=?,has_instrument=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1`)
          .run(name,email,phone,locationName,locationId,body.classe,body.instrumento==='Sim'?1:0,id);

        const currentActive = await db.prepare("SELECT class_id FROM enrollments WHERE student_id=? AND status='ativa'").all(id);
        const currentActiveIds = currentActive.map(c => c.class_id);
        const newClassIds = classRows.map(c => c.id);
        for (const cid of currentActiveIds) {
          if (!newClassIds.includes(cid)) {
             await db.prepare("UPDATE enrollments SET status='cancelada', ended_at=CURRENT_TIMESTAMP, end_reason='Alteração de matrícula' WHERE student_id=? AND class_id=? AND status='ativa'").run(id, cid);
          }
        }
        for (const classRow of classRows) {
          if (!currentActiveIds.includes(classRow.id)) {
             await db.prepare(`INSERT INTO enrollments (student_id,class_id,status,created_by) VALUES (?,?,'ativa',?)`).run(id, classRow.id, session.user_id);
          }
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_updated',ip);
      });
      return json(response, 200, { success: true });
    } catch (error) {
      if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
      throw error;
    }
  }

  const student360Match = url.pathname.match(/^\/alunos\/(\d+)\/360$/);
  if (student360Match && request.method === 'GET') {
    const session = await authorize(request, response, ['gestor', 'professor']); if (!session) return;
    const id = Number(student360Match[1]);
    const student = await db.prepare('SELECT id, name, email, phone, church, location_id, age_group, has_instrument FROM students WHERE id=? AND active=1').get(id);
    if (!student) return json(response, 404, { message: 'Aluno não encontrado' });

    if (session.role === 'professor') {
       const hasAccess = await db.prepare("SELECT 1 FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE enrollments.student_id=? AND pp.user_id=? LIMIT 1").get(id, session.user_id);
       if (!hasAccess) return json(response, 403, { message: 'Você não tem acesso a este aluno.' });
    }

    const professorOnly = session.role === 'professor';
    const scopedParams = professorOnly ? [id, session.user_id] : [id];
    const enrollmentScope = professorOnly ? ' AND p.user_id=?' : '';
    const enrollments = await db.prepare(`SELECT e.id, e.class_id, e.status, e.started_at, e.ended_at, e.end_reason, c.label as class_name, p.name as professor_name FROM enrollments e JOIN classes c ON c.id=e.class_id JOIN professor_profiles p ON p.id=c.professor_id WHERE e.student_id=?${enrollmentScope} ORDER BY e.started_at DESC`).all(...scopedParams);
    const followups = await db.prepare(`SELECT f.id, f.class_id, f.reason, f.contact_type, f.outcome, f.notes, f.created_at, u.name as created_by_name FROM student_followups f JOIN classes c ON c.id=f.class_id JOIN professor_profiles p ON p.id=c.professor_id LEFT JOIN users u ON u.id=f.created_by WHERE f.student_id=?${enrollmentScope} ORDER BY f.created_at DESC`).all(...scopedParams);
    const attendance = await db.prepare(`SELECT ar.status, asess.class_date, c.label as class_name FROM attendance_records ar JOIN attendance_sessions asess ON asess.id=ar.session_id JOIN classes c ON c.id=asess.class_id JOIN professor_profiles p ON p.id=c.professor_id WHERE ar.student_id=?${enrollmentScope} ORDER BY asess.class_date DESC`).all(...scopedParams);

    return json(response, 200, { student, enrollments, followups, attendance });
  }

  const studentFollowupMatch = url.pathname.match(/^\/alunos\/(\d+)\/acompanhamentos$/);
  if (studentFollowupMatch && request.method === 'POST') {
    const session = await authorize(request, response, ['gestor', 'professor']); if (!session) return;
    const id = Number(studentFollowupMatch[1]), body = await readJson(request);

    if (!body.class_id || !body.reason) return json(response, 400, { message: 'Turma e motivo são obrigatórios.' });
    const classId = Number(body.class_id);
    const allowedClass = session.role === 'professor'
      ? await db.prepare("SELECT 1 FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE enrollments.student_id=? AND enrollments.class_id=? AND pp.user_id=? LIMIT 1").get(id, classId, session.user_id)
      : await db.prepare('SELECT 1 FROM enrollments WHERE student_id=? AND class_id=? LIMIT 1').get(id, classId);
    if (!allowedClass) return json(response, 403, { message: 'Você não tem acesso a esta turma deste aluno.' });

    await db.prepare(`INSERT INTO student_followups (student_id, class_id, reason, contact_type, outcome, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, classId, cleanText(body.reason, 100), cleanText(body.contact_type||'', 50), cleanText(body.outcome||'', 100), cleanText(body.notes||'', 500), session.user_id
    );
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'followup_created',ip);
    return json(response, 201, { success: true });
  }

  const studentEndEnrollmentMatch = url.pathname.match(/^\/alunos\/(\d+)\/encerrar-matricula$/);
  if (studentEndEnrollmentMatch && request.method === 'POST') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const id = Number(studentEndEnrollmentMatch[1]), body = await readJson(request);
    if (!body.class_id || !body.reason) return json(response, 400, { message: 'Turma e motivo são obrigatórios.' });

    await db.transaction(async () => {
      await db.prepare(`UPDATE enrollments SET status='cancelada', ended_at=CURRENT_TIMESTAMP, end_reason=? WHERE student_id=? AND class_id=? AND status='ativa'`).run(cleanText(body.reason, 100), id, Number(body.class_id));
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'enrollment_ended',ip);
    });
    return json(response, 200, { success: true });
  }
  if (studentMatch && request.method === 'DELETE') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const id = Number(studentMatch[1]);
    const student = await db.prepare('SELECT id FROM students WHERE id=? AND active=1').get(id);
    if (!student) return json(response, 404, { message: 'Aluno ativo não encontrado.' });
    await db.transaction(async () => {
      const enrollments = await db.prepare("SELECT class_id FROM enrollments WHERE student_id=? AND status='ativa'").all(id);
      await db.prepare('UPDATE students SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
      await db.prepare("UPDATE enrollments SET status='cancelada', ended_at=CURRENT_TIMESTAMP, end_reason='Aluno inativado' WHERE student_id=? AND status='ativa'").run(id);
      for (const enrollment of enrollments) {
        await db.prepare('INSERT INTO dropout_events (student_id,class_id,reason,occurred_at) VALUES (?,?,?,?)').run(id,enrollment.class_id,'Excluído pelo gestor',new Date().toISOString().slice(0,10));
      }
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_deactivated',ip);
    });
    return json(response, 200, { success: true });
  }

  if (request.method === 'GET' && (url.pathname === '/professores/meus-alunos' || url.pathname === '/api/professores/me/alunos')) {
    const session = await authorize(request, response, ['professor']); if (!session) return;
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = url.pathname.startsWith('/api/') ? 100 : Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
    const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
    const profile = await db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
    if (!profile) return json(response, 403, { message: 'Perfil de professor não configurado.' });
    const total = (await db.prepare(`SELECT COUNT(DISTINCT students.id) AS total FROM students JOIN enrollments ON enrollments.student_id=students.id JOIN classes ON classes.id=enrollments.class_id WHERE students.active=1 AND enrollments.status='ativa' AND classes.active=1 AND classes.professor_id=? AND (students.name LIKE ? OR students.email LIKE ?)`).get(profile.id,search,search)).total;
    const sort = url.searchParams.get('sort') === 'recent' ? 'students.id DESC' : 'students.name';
    const rows = await db.prepare(`${studentSelect} WHERE students.active=1 AND students.id IN (SELECT enrollments.student_id FROM enrollments JOIN classes ON classes.id=enrollments.class_id WHERE enrollments.status='ativa' AND classes.active=1 AND classes.professor_id=?) AND (students.name LIKE ? OR students.email LIKE ?) GROUP BY students.id ORDER BY ${sort} LIMIT ? OFFSET ?`).all(profile.id,search,search,limit,(page-1)*limit);
    return json(response, 200, { alunos: rows.map(studentView), total });
  }

  if (request.method === 'GET' && url.pathname === '/api/catalogos') {
    if (!await authorize(request, response, ['gestor'])) return;
    const cursos = await db.prepare(`
      SELECT courses.id,courses.name AS nome,courses.active,
        COUNT(DISTINCT classes.id) AS turmas_total,
        COUNT(DISTINCT CASE WHEN classes.active=1 THEN classes.id END) AS turmas_ativas,
        COUNT(DISTINCT enrollments.id) AS matriculas_total,
        COUNT(DISTINCT attendance_records.id) AS frequencias_total
      FROM courses
      LEFT JOIN classes ON classes.course_id=courses.id
      LEFT JOIN enrollments ON enrollments.class_id=classes.id
      LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id
      LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id
      GROUP BY courses.id,courses.name,courses.active ORDER BY courses.name
    `).all();
    const locais = await db.prepare(`
      SELECT locations.id,locations.name AS nome,locations.active,
        COUNT(DISTINCT classes.id) AS turmas_total,
        COUNT(DISTINCT CASE WHEN classes.active=1 THEN classes.id END) AS turmas_ativas,
        COUNT(DISTINCT enrollments.id) AS matriculas_total,
        COUNT(DISTINCT attendance_records.id) AS frequencias_total,
        COUNT(DISTINCT professor_profiles.id) AS professores_total,
        COUNT(DISTINCT CASE WHEN professor_profiles.active=1 THEN professor_profiles.id END) AS professores_ativos
      FROM locations
      LEFT JOIN classes ON classes.location_id=locations.id
      LEFT JOIN enrollments ON enrollments.class_id=classes.id
      LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id
      LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id
      LEFT JOIN professor_profiles ON professor_profiles.home_location_id=locations.id
      GROUP BY locations.id,locations.name,locations.active ORDER BY locations.name
    `).all();
    return json(response, 200, {
      cursos: cursos.map(row => ({ ...row, ativo: row.active === 1, turmas: Number(row.turmas_total || 0), turmasAtivas: Number(row.turmas_ativas || 0), matriculas: Number(row.matriculas_total || 0), frequencias: Number(row.frequencias_total || 0) })),
      locais: locais.map(row => ({ ...row, ativo: row.active === 1, turmas: Number(row.turmas_total || 0), turmasAtivas: Number(row.turmas_ativas || 0), matriculas: Number(row.matriculas_total || 0), frequencias: Number(row.frequencias_total || 0), professores: Number(row.professores_total || 0), professoresAtivos: Number(row.professores_ativos || 0) })),
    });
  }

  const catalogMatch = url.pathname.match(/^\/api\/catalogos\/(cursos|locais)(?:\/(\d+))?$/);
  if (catalogMatch && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const [, kind, idText] = catalogMatch;
    const table = kind === 'cursos' ? 'courses' : 'locations';
    const entity = kind === 'cursos' ? 'curso' : 'igreja';
    const id = idText ? Number(idText) : null;
    if (request.method === 'POST') {
      const body = await readJson(request);
      const name = cleanText(body.nome, 100);
      const errorMessage = catalogNameError(name, entity);
      if (errorMessage) return invalid(response, { nome: errorMessage });
      const existing = await db.prepare(`SELECT id,active FROM ${table} WHERE LOWER(name)=LOWER(?)`).get(name);
      if (existing?.active === 1) return json(response, 409, { message: `Este ${entity} já está cadastrado.` });
      if (existing) {
        await db.prepare(`UPDATE ${table} SET name=?,active=1 WHERE id=?`).run(name, existing.id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_reactivated`, ip);
        return json(response, 200, { id: existing.id, message: `${entity[0].toUpperCase()}${entity.slice(1)} reativado com sucesso.` });
      }
      const result = await db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_created`, ip);
      return json(response, 201, { id: Number(result.lastInsertRowid) });
    }
    if (!id) return json(response, 404, { message: 'Cadastro não encontrado.' });
    const current = await db.prepare(`SELECT id,active FROM ${table} WHERE id=?`).get(id);
    if (!current) return json(response, 404, { message: `${entity[0].toUpperCase()}${entity.slice(1)} não encontrado.` });
    if (request.method === 'PUT') {
      const body = await readJson(request);
      const name = cleanText(body.nome, 100);
      const errorMessage = catalogNameError(name, entity);
      if (errorMessage) return invalid(response, { nome: errorMessage });
      try {
        await db.prepare(`UPDATE ${table} SET name=? WHERE id=?`).run(name, id);
      } catch (error) {
        if (duplicateError(error)) return json(response, 409, { message: `Já existe outro ${entity} com este nome.` });
        throw error;
      }
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_updated`, ip);
      return json(response, 200, { success: true });
    }
    const classFilter = kind === 'cursos' ? 'course_id' : 'location_id';
    const summary = await db.prepare(`SELECT
      COUNT(DISTINCT classes.id) AS turmas,
      COUNT(DISTINCT enrollments.id) AS matriculas,
      COUNT(DISTINCT attendance_records.id) AS frequencias
      FROM classes
      LEFT JOIN enrollments ON enrollments.class_id=classes.id
      LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id
      LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id
      WHERE classes.${classFilter}=?`).get(id);
    await db.transaction(async()=>{
      await db.prepare(`UPDATE enrollments SET status='cancelada', ended_at=CURRENT_TIMESTAMP, end_reason='Turma inativada via catálogo' WHERE class_id IN (
        SELECT id FROM classes WHERE ${classFilter}=?
      ) AND status='ativa'`).run(id);
      await db.prepare(`UPDATE classes SET active=0 WHERE ${classFilter}=?`).run(id);
      if(kind === 'locais')await db.prepare('UPDATE professor_profiles SET home_location_id=NULL WHERE home_location_id=?').run(id);
      await db.prepare(`UPDATE ${table} SET active=0 WHERE id=?`).run(id);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, `${entity}_deactivated`, ip);
    });
    return json(response, 200, {
      success: true,
      permanentlyDeleted: true,
      resumo: { turmas: Number(summary?.turmas || 0), matriculas: Number(summary?.matriculas || 0), frequencias: Number(summary?.frequencias || 0) },
      message: `${entity[0].toUpperCase()}${entity.slice(1)} e todos os vínculos foram excluídos definitivamente.`,
    });
  }

  if (request.method === 'GET' && url.pathname === '/cursos') {
    if (!await authorize(request, response, ['gestor'])) return;
    const rows = await db.prepare(`SELECT classes.id,courses.name AS nome,locations.name AS local,professor_profiles.name AS professor,classes.weekday,classes.start_time,CASE classes.active WHEN 1 THEN 'Ativo' ELSE 'Inativo' END AS status,COUNT(CASE WHEN enrollments.status='ativa' AND students.active=1 THEN 1 END) AS alunos FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id LEFT JOIN enrollments ON enrollments.class_id=classes.id LEFT JOIN students ON students.id=enrollments.student_id GROUP BY classes.id,courses.name,locations.name,professor_profiles.name,classes.weekday,classes.start_time ORDER BY courses.name,locations.name`).all();
    const professores = (await db.prepare('SELECT name FROM professor_profiles WHERE active=1 ORDER BY name').all()).map(row=>row.name);
    const locais = (await db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all()).map(row=>row.name);
    return json(response, 200, { cursos: rows, professores, locais });
  }

  if (request.method === 'POST' && url.pathname === '/cursos') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const body = await readJson(request);
    const courseName = cleanText(body.nome, 100), locationName = cleanText(body.local, 100), professorName = cleanText(body.professor, 100);
    const weekday = cleanText(body.weekday, 20), startTime = cleanText(body.start_time, 10);
    const errors = {
      nome: catalogNameError(courseName, 'curso'),
      local: locationName ? '' : 'Selecione uma igreja cadastrada.',
      professor: professorName ? '' : 'Selecione um professor cadastrado.',
      ...validateClassSchedule({ weekday, start_time: startTime }),
    };
    if (hasValidationErrors(errors)) return invalid(response, errors);
    const professor = await db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(professorName);
    if (!professor) return json(response, 400, { message: 'Professor não encontrado.' });
    const course = await db.prepare('SELECT id FROM courses WHERE name=? AND active=1').get(courseName);
    const location = await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
    if (!course || !location) return json(response, 400, { message: 'Selecione somente cursos e locais ativos cadastrados pelo gestor.' });
    try {
      const result=await db.prepare('INSERT INTO classes (course_id,professor_id,location_id,label,weekday,start_time) VALUES (?,?,?,?,?,?)').run(course.id,professor.id,location.id,`${courseName} — ${locationName}`,weekday||null,startTime||null);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_created',ip);
      return json(response,201,{id:Number(result.lastInsertRowid)});
    } catch (error) {
      if (error.code === '23505' || String(error).includes('UNIQUE')) return json(response,409,{message:'Esta turma já existe.'});
      throw error;
    }
  }
  const courseMatch=url.pathname.match(/^\/cursos\/(\d+)$/);
  if (courseMatch && request.method==='PUT') {
    const session=await authorize(request,response,['gestor']); if(!session)return;
    const id=Number(courseMatch[1]),body=await readJson(request);
    const courseName=cleanText(body.nome,100),locationName=cleanText(body.local,100),professorName=cleanText(body.professor,100);
    const weekday = cleanText(body.weekday, 20), startTime = cleanText(body.start_time, 10);
    const errors={nome:catalogNameError(courseName,'curso'),local:locationName?'':'Selecione uma igreja cadastrada.',professor:professorName?'':'Selecione um professor cadastrado.',...validateClassSchedule({weekday,start_time:startTime})};
    if(hasValidationErrors(errors))return invalid(response,errors);
    const professor=await db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(professorName);
    if(!professor)return json(response,400,{message:'Professor não encontrado.'});
    const course=await db.prepare('SELECT id FROM courses WHERE name=? AND active=1').get(courseName),location=await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
    if(!course||!location)return json(response,400,{message:'Selecione somente cursos e locais ativos cadastrados pelo gestor.'});
    try{
      const result=await db.prepare('UPDATE classes SET course_id=?,professor_id=?,location_id=?,label=?,weekday=?,start_time=? WHERE id=?').run(course.id,professor.id,location.id,`${courseName} — ${locationName}`,weekday||null,startTime||null,id);
      if(!result.changes)return json(response,404,{message:'Turma não encontrada.'});
    }catch(error){if(duplicateError(error))return json(response,409,{message:'Esta turma já existe.'});throw error;}
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_updated',ip);
    return json(response,200,{success:true});
  }
  if(courseMatch&&request.method==='DELETE'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    await db.prepare('UPDATE classes SET active=0 WHERE id=?').run(Number(courseMatch[1]));
    await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_deactivated',ip);
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/professores'){
    if(!await authorize(request,response,['gestor']))return;
    const rows=(await db.prepare(`
      SELECT professor_profiles.id,professor_profiles.name AS nome,professor_profiles.email AS contato,
        professor_profiles.phone AS telefone,locations.name AS local,
        CASE professor_profiles.active WHEN 1 THEN 'Ativo' ELSE 'Inativo' END AS status,
        users.active AS user_active,
        MAX(CASE WHEN professor_invites.accepted_at IS NULL AND professor_invites.expires_at>CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS has_valid_invite,
        GROUP_CONCAT(DISTINCT courses.name) AS course_names
      FROM professor_profiles
      LEFT JOIN locations ON locations.id=professor_profiles.home_location_id
      LEFT JOIN users ON users.id=professor_profiles.user_id
      LEFT JOIN professor_invites ON professor_invites.professor_profile_id=professor_profiles.id
      LEFT JOIN classes ON classes.professor_id=professor_profiles.id AND classes.active=1
      LEFT JOIN courses ON courses.id=classes.course_id
      GROUP BY professor_profiles.id,locations.name,users.active
      ORDER BY professor_profiles.name
    `).all()).map(row=>({
      ...row,
      cursos:row.course_names?row.course_names.split(','):[],
      acesso:row.status==='Inativo'?'Desativado':row.user_active===1?'Ativo':row.has_valid_invite===1?'Convite pendente':'Envio pendente',
    }));
    const cursos=(await db.prepare('SELECT name FROM courses WHERE active=1 ORDER BY name').all()).map(row=>row.name);
    const locais=(await db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all()).map(row=>row.name);
    return json(response,200,{professores:rows,cursos,locais});
  }

  if(request.method==='POST'&&url.pathname==='/professores'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const body=await readJson(request),name=cleanText(body.nome,100),email=cleanEmail(body.contato),phone=cleanText(body.telefone,30);
    const locationName=cleanText(body.local,100),courseNames=[...new Set((Array.isArray(body.cursos)?body.cursos:[]).map(value=>cleanText(value,100)).filter(Boolean))];
    const errors=validateProfessor({...body,nome:name,contato:email,telefone:phone,local:locationName,cursos:courseNames});
    if(hasValidationErrors(errors))return invalid(response,errors);
    const location=await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
    if(!location)return invalid(response,{local:'Selecione uma igreja ativa cadastrada em Cursos e igrejas.'});
    const catalogCourses=[];
    for(const courseName of courseNames){
      const course=await db.prepare('SELECT id,name FROM courses WHERE name=? AND active=1').get(courseName);
      if(!course)return invalid(response,{cursos:`O curso “${courseName}” não está cadastrado ou está inativo.`});
      catalogCourses.push(course);
    }
    const existing=await db.prepare('SELECT id,user_id,active FROM professor_profiles WHERE email=?').get(email);
    if(existing?.active!==undefined&&existing.active!==1)return json(response,409,{message:'Este professor está desativado. Reative o cadastro existente em vez de criar outro.'});
    if(existing?.user_id)return json(response,409,{message:'Este professor já possui uma conta ativa.'});
    try{
      const professorId=await db.transaction(async()=>{
        let targetProfessorId=existing?.id;
        if(targetProfessorId){
          await db.prepare('UPDATE professor_profiles SET name=?,phone=?,home_location_id=?,active=1 WHERE id=?').run(name,phone,location.id,targetProfessorId);
        }else{
          const result=await db.prepare('INSERT INTO professor_profiles (name,email,phone,home_location_id) VALUES (?,?,?,?)').run(name,email,phone,location.id);
          targetProfessorId=Number(result.lastInsertRowid);
        }
        for(const course of catalogCourses){
          await db.prepare('INSERT OR IGNORE INTO classes (course_id,professor_id,location_id,label) VALUES (?,?,?,?)').run(course.id,targetProfessorId,location.id,`${course.name} — ${locationName}`);
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,existing?'professor_registration_resumed':'professor_created',ip);
        return targetProfessorId;
      });
      const invitation=await issueProfessorInvite({professorId,name,email,createdBy:session.user_id,ip,auditAction:existing?'professor_invite_reissued':'professor_invite_created'});
      return json(response,existing?200:201,{
        id:professorId,
        inviteSent:invitation.inviteSent,
        message:invitation.inviteSent
          ? (existing?'Cadastro existente atualizado e novo convite enviado.':'Professor cadastrado e convite enviado.')
          : 'Professor cadastrado, mas o convite não pôde ser enviado. Use “Reenviar convite” após revisar o remetente de e-mail.',
        devMailbox:isProduction?null:'/dev-mail',
      });
    }catch(error){
      if(error.code === '23505' || String(error).includes('UNIQUE'))return json(response,409,{message:'Já existe um professor com este e-mail.'});
      throw error;
    }
  }

  const professorInviteMatch=url.pathname.match(/^\/professores\/(\d+)\/reenviar-convite$/);
  if(professorInviteMatch&&request.method==='POST'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const id=Number(professorInviteMatch[1]);
    const professor=await db.prepare('SELECT id,name,email,user_id,active FROM professor_profiles WHERE id=?').get(id);
    if(!professor||professor.active!==1)return json(response,404,{message:'Professor ativo não encontrado.'});
    if(professor.user_id)return json(response,409,{message:'Este professor já ativou a conta.'});
    const invitation=await issueProfessorInvite({professorId:id,name:professor.name,email:professor.email,createdBy:session.user_id,ip,auditAction:'professor_invite_reissued'});
    if(!invitation.inviteSent)return json(response,502,{message:'O convite foi renovado, mas o provedor de e-mail recusou o envio. Revise o remetente configurado e tente novamente.'});
    return json(response,200,{message:'Novo convite enviado com sucesso.',expiresAt:invitation.expiresAt});
  }

  const professorImpactMatch=url.pathname.match(/^\/professores\/(\d+)\/impacto-exclusao$/);
  if(professorImpactMatch&&request.method==='GET'){
    if(!await authorize(request,response,['gestor']))return;
    const impact=await professorDeletionImpact(Number(professorImpactMatch[1]));
    if(!impact)return json(response,404,{message:'Professor não encontrado.'});
    return json(response,200,impact);
  }

  const professorMatch=url.pathname.match(/^\/professores\/(\d+)$/);
  if(professorMatch&&request.method==='PUT'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const id=Number(professorMatch[1]),body=await readJson(request);
    const name=cleanText(body.nome,100),email=cleanEmail(body.contato),phone=cleanText(body.telefone,30),locationName=cleanText(body.local,100);
    const courseNames=[...new Set((Array.isArray(body.cursos)?body.cursos:[]).map(value=>cleanText(value,100)).filter(Boolean))];
    const errors=validateProfessor({...body,nome:name,contato:email,telefone:phone,local:locationName,cursos:courseNames});
    if(hasValidationErrors(errors))return invalid(response,errors);
    const current=await db.prepare('SELECT p.id, p.user_id, p.email, u.auth_user_id FROM professor_profiles p LEFT JOIN users u ON u.id = p.user_id WHERE p.id=? AND p.active=1').get(id);
    if(!current)return json(response,404,{message:'Professor ativo não encontrado.'});
    const location=await db.prepare('SELECT id FROM locations WHERE name=? AND active=1').get(locationName);
    if(!location)return invalid(response,{local:'Selecione uma igreja ativa cadastrada em Cursos e igrejas.'});
    const catalogCourses=[];
    for(const courseName of courseNames){
      const course=await db.prepare('SELECT id,name FROM courses WHERE name=? AND active=1').get(courseName);
      if(!course)return invalid(response,{cursos:`O curso “${courseName}” não está cadastrado ou está inativo.`});
      catalogCourses.push(course);
    }

    if (usesSupabaseAuth && current.auth_user_id && current.email !== email) {
      if (!supabaseAdmin) return json(response, 503, { message: 'Supabase admin indisponível.' });
      const { error } = await supabaseAdmin.auth.admin.updateUserById(current.auth_user_id, { email, email_confirm: true });
      if (error) return json(response, 502, { message: 'Erro ao sincronizar e-mail no provedor de autenticação.' });
    }

    try{
      await db.transaction(async()=>{
        await db.prepare('UPDATE professor_profiles SET name=?,email=?,phone=?,home_location_id=? WHERE id=?').run(name,email,phone,location.id,id);
        if (current.user_id) {
          await db.prepare('UPDATE users SET email=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(email, current.user_id);
        }
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_updated',ip);
      });
      return json(response,200,{success:true});
    }catch(error){
      if(duplicateError(error))return json(response,409,{message:'Já existe um professor com este e-mail.'});
      throw error;
    }
  }
  if(professorMatch&&request.method==='DELETE'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const id=Number(professorMatch[1]);
    const professor=await db.prepare(`
      SELECT professor_profiles.id,professor_profiles.user_id,users.auth_user_id
      FROM professor_profiles LEFT JOIN users ON users.id=professor_profiles.user_id
      WHERE professor_profiles.id=?
    `).get(id);
    if(!professor)return json(response,404,{message:'Professor não encontrado.'});
    const impact=await professorDeletionImpact(id);

    if(professor.auth_user_id&&usesSupabaseAuth&&!supabaseAdmin){
      return json(response,503,{message:'A exclusão definitiva não está disponível porque a chave administrativa do Supabase não foi configurada.'});
    }
    if(professor.auth_user_id&&supabaseAdmin){
      const { error }=await supabaseAdmin.auth.admin.deleteUser(professor.auth_user_id,false);
      const authAlreadyAbsent=error&&(error.status===404||/not found|does not exist/i.test(error.message || ''));
      if(error&&!authAlreadyAbsent){
        console.error('Não foi possível excluir definitivamente o usuário do Supabase:',error.message);
        return json(response,502,{message:'Não foi possível apagar a conta de autenticação. Nenhum dado local foi excluído; tente novamente.'});
      }
    }

    await db.transaction(async()=>{
      if(professor.user_id){
        await db.prepare('DELETE FROM sessions WHERE user_id=?').run(professor.user_id);
        await db.prepare('DELETE FROM password_resets WHERE user_id=?').run(professor.user_id);
        await db.prepare('UPDATE users SET active=0 WHERE id=?').run(professor.user_id);
      }

      await db.prepare(`UPDATE enrollments SET status='cancelada', ended_at=CURRENT_TIMESTAMP, end_reason='Professor desativado' WHERE class_id IN (
        SELECT id FROM classes WHERE professor_id=?
      ) AND status='ativa'`).run(id);
      await db.prepare('UPDATE classes SET active=0 WHERE professor_id=?').run(id);
      await db.prepare('DELETE FROM professor_invites WHERE professor_profile_id=?').run(id);
      await db.prepare('UPDATE professor_profiles SET active=0 WHERE id=?').run(id);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_deactivated',ip);
    });
    return json(response,200,{
      success:true,
      permanentlyDeleted:false,
      authAccountRemoved:!!professor.auth_user_id,
      resumo:impact?.resumo,
      message:'Professor desativado com sucesso.',
    });
  }

  if(request.method==='GET'&&url.pathname==='/professores/meus-cursos'){
    const session=await authorize(request,response,['professor']);if(!session)return;
    const rows=await db.prepare(`SELECT classes.id,courses.name AS nome,locations.name AS local FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.active=1 ORDER BY courses.name`).all(session.user_id);
    return json(response,200,rows);
  }

  if(request.method==='GET'&&url.pathname==='/frequencia'){
    const session=await authorize(request,response,['professor']);if(!session)return;
    const classId=Number(url.searchParams.get('curso_id')),date=url.searchParams.get('data');
    const owned=await db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1`).get(classId,session.user_id);
    if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
    const rows=await db.prepare(`SELECT students.id,students.name AS nome,attendance_records.status AS status FROM students JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa' LEFT JOIN attendance_sessions ON attendance_sessions.class_id=enrollments.class_id AND attendance_sessions.class_date=? LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id AND attendance_records.student_id=students.id WHERE enrollments.class_id=? AND students.active=1 ORDER BY students.name`).all(date,classId);
    return json(response,200,rows);
  }

  if(request.method==='POST'&&url.pathname==='/frequencia'){
    const session=await authorize(request,response,['professor']);if(!session)return;
    const body=await readJson(request),classId=Number(body.curso_id),date=String(body.data_aula||'');
    if(!Number.isInteger(classId)||classId<1||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00Z`)))return json(response,400,{message:'Selecione uma turma e uma data válidas.'});
    if(!Array.isArray(body.frequencias))return json(response,400,{message:'A lista de frequência é inválida.'});
    const owned=await db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1`).get(classId,session.user_id);
    if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
    await db.transaction(async () => {
      await db.prepare(`INSERT INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?) ON CONFLICT(class_id,class_date) DO UPDATE SET recorded_by=excluded.recorded_by,updated_at=CURRENT_TIMESTAMP`).run(classId,date,session.user_id);
      const attendanceSession=await db.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(classId,date);
      const enrolled=(await db.prepare(`SELECT student_id FROM enrollments WHERE class_id=? AND started_at <= ? AND (ended_at IS NULL OR ended_at >= ?)`).all(classId, date + 'T23:59:59Z', date + 'T00:00:00Z')).map(row=>row.student_id);
      const allowed=new Set(enrolled);
      for(const item of body.frequencias||[]){
        const studentId=Number(item.aluno_id),status=String(item.status);
        if(!allowed.has(studentId)||!['presente','ausente','justificado'].includes(status))continue;
        await db.prepare(`INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status`).run(attendanceSession.id,studentId,status);
      }
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'attendance_saved',ip);
    });
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/api/informativos/nao-lidos'){
    const session=await authorize(request,response,['professor']);if(!session)return;
    const result=await db.prepare(`SELECT COUNT(*) AS total FROM announcements
      WHERE announcements.active=1
        AND ${announcementScheduledCondition('announcements.scheduled_at')}
        AND NOT EXISTS (SELECT 1 FROM announcement_reads WHERE announcement_reads.announcement_id=announcements.id AND announcement_reads.user_id=?)
        AND (
          NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
          OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
            (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
            OR (ar.recipient_type='curso' AND ar.recipient_id IN (
              SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id
              WHERE pp.user_id=? AND pp.active=1 AND classes.active=1
            ))
          ))
        )`).get(session.user_id,session.user_id,session.user_id);
    return json(response,200,{total:Number(result?.total||0)});
  }

  if(request.method==='GET'&&url.pathname==='/api/informativos'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const visibility=session.role==='professor' ? `
      AND ${announcementScheduledCondition('announcements.scheduled_at')}
      AND (
        NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
        OR EXISTS (
          SELECT 1 FROM announcement_recipients ar
          WHERE ar.announcement_id=announcements.id
            AND (
              (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
              OR (ar.recipient_type='curso' AND ar.recipient_id IN (
                SELECT classes.course_id
                FROM classes
                JOIN professor_profiles pp ON pp.id=classes.professor_id
                WHERE pp.user_id=? AND pp.active=1 AND classes.active=1
              ))
            )
        )
      )` : '';
    const rows=await db.prepare(`SELECT announcements.*,COUNT(read_users.id) AS read_count,MAX(CASE WHEN announcement_reads.user_id=? THEN 1 ELSE 0 END) AS has_read FROM announcements LEFT JOIN announcement_reads ON announcement_reads.announcement_id=announcements.id LEFT JOIN users read_users ON read_users.id=announcement_reads.user_id AND read_users.role='professor' WHERE announcements.active=1${visibility} GROUP BY announcements.id ORDER BY announcements.pinned DESC,announcements.scheduled_at DESC`).all(...(session.role==='professor' ? [session.user_id,session.user_id,session.user_id] : [session.user_id]));
    const attachmentsByAnnouncement = new Map();
    const recipientsByAnnouncement = new Map();
    if (rows.length) {
      const ids = rows.map(row => Number(row.id));
      const placeholders = ids.map(() => '?').join(',');
      const attachmentRows = await db.prepare(`SELECT id,announcement_id,filename,mime_type,size_bytes FROM announcement_attachments WHERE announcement_id IN (${placeholders}) ORDER BY id`).all(...ids);
      for (const attachment of attachmentRows) {
        const list = attachmentsByAnnouncement.get(Number(attachment.announcement_id)) || [];
        list.push({ id: Number(attachment.id), nome: attachment.filename, tipo: attachment.mime_type, tamanho: Number(attachment.size_bytes), url: `/api/informativos/${Number(attachment.announcement_id)}/anexos/${Number(attachment.id)}` });
        attachmentsByAnnouncement.set(Number(attachment.announcement_id), list);
      }
      const recipientRows = await db.prepare(`SELECT announcement_id,recipient_type,recipient_id FROM announcement_recipients WHERE announcement_id IN (${placeholders}) ORDER BY announcement_id,recipient_type,recipient_id`).all(...ids);
      for (const recipient of recipientRows) {
        const audience = recipientsByAnnouncement.get(Number(recipient.announcement_id)) || { todos: false, professores: [], cursos: [] };
        if (recipient.recipient_type === 'professor') audience.professores.push(Number(recipient.recipient_id));
        if (recipient.recipient_type === 'curso') audience.cursos.push(Number(recipient.recipient_id));
        recipientsByAnnouncement.set(Number(recipient.announcement_id), audience);
      }
    }
    const mapped=rows.map(row=>{
      const schedule=announcementScheduleParts(row.scheduled_at);
      const isScheduled=Date.parse(row.scheduled_at)>Date.now();
      return {id:row.id,titulo:row.title,categoria:row.category,tipo:row.category==='Urgente'?'Urgente':row.category==='Eventos'?'Evento':'Comunicado',conteudo:sanitizeAnnouncementContent(row.content),data_publicacao:row.scheduled_at,agendado_em:row.scheduled_at,data:schedule.date.split('-').reverse().join('/'),hora:schedule.time,status:isScheduled?'Agendado':'Publicado',lido:Number(row.read_count||0),fixado:Boolean(row.pinned),hasRead:Boolean(row.has_read),anexos:attachmentsByAnnouncement.get(Number(row.id)) || [],destinatarios:recipientsByAnnouncement.get(Number(row.id)) || { todos: true, professores: [], cursos: [] }};
    });
    return json(response,200,mapped);
  }
  if(request.method==='GET'&&url.pathname==='/api/informativos/destinatarios'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const [professores,cursos,professorCourses]=await Promise.all([
      db.prepare('SELECT id,name AS nome FROM professor_profiles WHERE active=1 ORDER BY name').all(),
      db.prepare('SELECT id,name AS nome FROM courses WHERE active=1 ORDER BY name').all(),
      db.prepare(`
        SELECT DISTINCT classes.professor_id,classes.course_id
        FROM classes
        JOIN professor_profiles ON professor_profiles.id=classes.professor_id AND professor_profiles.active=1
        JOIN courses ON courses.id=classes.course_id AND courses.active=1
        WHERE classes.active=1
      `).all(),
    ]);
    const coursesByProfessor=new Map();
    for(const relation of professorCourses){
      const professorId=Number(relation.professor_id),courseId=Number(relation.course_id);
      if(!Number.isInteger(professorId)||!Number.isInteger(courseId))continue;
      const current=coursesByProfessor.get(professorId)||[];
      current.push(courseId);
      coursesByProfessor.set(professorId,current);
    }
    return json(response,200,{
      professores:professores.map(row=>({id:Number(row.id),nome:row.nome,cursos:[...new Set(coursesByProfessor.get(Number(row.id))||[])]})),
      cursos:cursos.map(row=>({id:Number(row.id),nome:row.nome})),
    });
  }
  const attachmentMatch=url.pathname.match(/^\/api\/informativos\/(\d+)\/anexos\/(\d+)$/);
  if(attachmentMatch&&request.method==='GET'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const visibility=session.role==='professor' ? ` AND ${announcementScheduledCondition('announcements.scheduled_at')}
      AND (NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
        OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
          (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
          OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1))
        )))` : '';
    const attachment=await db.prepare(`SELECT announcement_attachments.filename,announcement_attachments.mime_type,announcement_attachments.data_url,announcement_attachments.storage_path FROM announcement_attachments JOIN announcements ON announcements.id=announcement_attachments.announcement_id WHERE announcement_attachments.id=? AND announcement_attachments.announcement_id=? AND announcements.active=1${visibility}`).get(...([Number(attachmentMatch[2]),Number(attachmentMatch[1]),...(session.role==='professor' ? [session.user_id,session.user_id] : [])]));
    if(!attachment)return json(response,404,{message:'Anexo não encontrado.'});
    let buffer;
    if(attachment.storage_path){
      if(!supabaseAdmin)return json(response,503,{message:'O storage de anexos não está disponível.'});
      const {data,error}=await supabaseAdmin.storage.from(announcementStorageBucket).download(attachment.storage_path);
      if(error||!data)return json(response,502,{message:'Não foi possível carregar o anexo.'});
      buffer=Buffer.from(await data.arrayBuffer());
    }else{
      const base64=String(attachment.data_url||'').split(',')[1] || '';
      buffer=Buffer.from(base64,'base64');
    }
    const disposition=url.searchParams.get('download')==='1'?'attachment':'inline';
    response.writeHead(200,{...securityHeaders(attachment.mime_type),'Content-Disposition':`${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,'Content-Length':String(buffer.length),'Cache-Control':'private, max-age=300'});
    return response.end(buffer);
  }
  if(request.method==='POST'&&url.pathname==='/api/informativos'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const body=await readJson(request, 32 * 1024 * 1024),title=cleanText(body.titulo,120),content=sanitizeAnnouncementContent(body.conteudo),attachmentResult=normalizeAnnouncementAttachments(body.anexos),recipientResult=await normalizeAnnouncementRecipients(body.destinatarios);
    const scheduled=zonedScheduleIso(body.dataAgendamento,body.horaAgendamento);
    const errors={titulo:requiredTextError(title,'O título',3,120),categoria:['Geral','Inscrições','Eventos','Urgente'].includes(body.categoria)?'':'Selecione uma categoria válida.',conteudo:requiredTextError(content.replace(/<[^>]+>/g,' '),'O conteúdo',10,5000),dataAgendamento:/^\d{4}-\d{2}-\d{2}$/.test(body.dataAgendamento||'')?'':'Informe uma data válida.',horaAgendamento:/^([01]\d|2[0-3]):[0-5]\d$/.test(body.horaAgendamento||'')?'':'Informe uma hora válida.',anexos:attachmentResult.error || '',destinatarios:recipientResult.error || ''};
    if(scheduleIsPast(body.dataAgendamento, body.horaAgendamento))errors.dataAgendamento='A data e hora devem ser futuras.';
    if(hasValidationErrors(errors)||!scheduled||Number.isNaN(Date.parse(scheduled)))return invalid(response,errors);
    let result;
    let stored=[];
    try{
      await db.transaction(async () => {
        result=await db.prepare("INSERT INTO announcements (author_user_id,title,category,content,scheduled_at,published_at,pinned) VALUES (?,?,?,?,?,?,?)").run(session.user_id,title,body.categoria,content,scheduled,scheduled,body.fixarNoTopo?1:0);
        for (const recipient of recipientResult.items) await db.prepare('INSERT INTO announcement_recipients (announcement_id,recipient_type,recipient_id) VALUES (?,?,?)').run(result.lastInsertRowid,recipient.recipient_type,recipient.recipient_id);
      });
      stored=await prepareStoredAttachments(Number(result.lastInsertRowid),attachmentResult.newItems);
      await db.transaction(async()=>{
        await insertAnnouncementAttachments(Number(result.lastInsertRowid),stored);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_created',ip);
      });
    }catch(error){
      await removeStoredAttachments(stored.map(item=>item.storage_path)).catch(cleanupError=>console.error(cleanupError));
      if(result?.lastInsertRowid)await db.prepare('DELETE FROM announcements WHERE id=?').run(Number(result.lastInsertRowid)).catch(cleanupError=>console.error(cleanupError));
      console.error('Falha ao criar informativo:',error);
      return json(response,502,{message:'Não foi possível armazenar os anexos. O informativo não foi publicado.'});
    }
    return json(response,201,{id:Number(result.lastInsertRowid),destinatarios:recipientResult.audience});
  }
  const announcementMatch=url.pathname.match(/^\/api\/informativos\/(\d+)$/);
  if(announcementMatch&&request.method==='PUT'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const announcementId=Number(announcementMatch[1]);
    const announcement=await db.prepare('SELECT id,scheduled_at FROM announcements WHERE id=? AND active=1').get(announcementId);
    if(!announcement)return json(response,404,{message:'Informativo não encontrado.'});
    const existingAttachments=new Map((await db.prepare('SELECT id,filename,mime_type,size_bytes,data_url,storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId)).map(row => [Number(row.id), row]));
    const body=await readJson(request, 32 * 1024 * 1024),title=cleanText(body.titulo,120),content=sanitizeAnnouncementContent(body.conteudo),scheduled=zonedScheduleIso(body.dataAgendamento,body.horaAgendamento),attachmentResult=normalizeAnnouncementAttachments(body.anexos, existingAttachments),recipientResult=await normalizeAnnouncementRecipients(body.destinatarios);
    const errors={titulo:requiredTextError(title,'O título',3,120),categoria:['Geral','Inscrições','Eventos','Urgente'].includes(body.categoria)?'':'Selecione uma categoria válida.',conteudo:requiredTextError(content.replace(/<[^>]+>/g,' '),'O conteúdo',10,5000),dataAgendamento:/^\d{4}-\d{2}-\d{2}$/.test(body.dataAgendamento||'')?'':'Informe uma data válida.',horaAgendamento:/^([01]\d|2[0-3]):[0-5]\d$/.test(body.horaAgendamento||'')?'':'Informe uma hora válida.',anexos:attachmentResult.error || '',destinatarios:recipientResult.error || ''};
    if(scheduleIsPast(body.dataAgendamento, body.horaAgendamento) && scheduled!==new Date(announcement.scheduled_at).toISOString())errors.dataAgendamento='A data e hora devem ser futuras.';
    if(hasValidationErrors(errors)||!scheduled||Number.isNaN(Date.parse(scheduled)))return invalid(response,errors);
    const retainedIds=attachmentResult.existingItems.map(item=>Number(item.id));
    const removed=[...existingAttachments.values()].filter(item=>!retainedIds.includes(Number(item.id)));
    let stored=[];
    let result;
    try{
      stored=await prepareStoredAttachments(announcementId,attachmentResult.newItems);
      await db.transaction(async () => {
        result=await db.prepare("UPDATE announcements SET title=?,category=?,content=?,scheduled_at=?,published_at=?,pinned=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1").run(title,body.categoria,content,scheduled,scheduled,body.fixarNoTopo?1:0,announcementId);
        if(retainedIds.length)await db.prepare(`DELETE FROM announcement_attachments WHERE announcement_id=? AND id NOT IN (${retainedIds.map(()=>'?').join(',')})`).run(announcementId,...retainedIds);
        else await db.prepare('DELETE FROM announcement_attachments WHERE announcement_id=?').run(announcementId);
        await insertAnnouncementAttachments(announcementId,stored);
        await db.prepare('DELETE FROM announcement_recipients WHERE announcement_id=?').run(announcementId);
        for (const recipient of recipientResult.items) await db.prepare('INSERT INTO announcement_recipients (announcement_id,recipient_type,recipient_id) VALUES (?,?,?)').run(announcementId,recipient.recipient_type,recipient.recipient_id);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_updated',ip);
      });
    }catch(error){
      await removeStoredAttachments(stored.map(item=>item.storage_path)).catch(cleanupError=>console.error(cleanupError));
      console.error('Falha ao atualizar informativo:',error);
      return json(response,502,{message:'Não foi possível atualizar os anexos. O informativo anterior foi preservado.'});
    }
    await removeStoredAttachments(removed.map(item=>item.storage_path)).catch(error=>console.error('Cleanup de anexo pendente:',error));
    return json(response,200,{success:true,destinatarios:recipientResult.audience});
  }
  if(announcementMatch&&request.method==='DELETE'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const announcementId=Number(announcementMatch[1]);
    const attachments=await db.prepare('SELECT storage_path FROM announcement_attachments WHERE announcement_id=?').all(announcementId);
    const result=await db.transaction(async()=>{
      const deleted=await db.prepare('DELETE FROM announcements WHERE id=?').run(announcementId);
      if(deleted.changes)await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_deleted',ip);
      return deleted;
    });
    if(!result.changes)return json(response,404,{message:'Informativo não encontrado.'});
    await removeStoredAttachments(attachments.map(item=>item.storage_path)).catch(error=>console.error('Cleanup de anexo pendente:',error));
    return json(response,200,{success:true});
  }
  const readMatch = url.pathname.match(/^\/api\/informativos\/(\d+)\/lida$/);
  if (readMatch && request.method === 'POST') {
    const session = await authorize(request, response, ['professor']); if (!session) return;
    const announcementId=Number(readMatch[1]);
    const visibility=`
      AND (NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
        OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
          (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
          OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1))
        )))`;
    const announcement=await db.prepare(`SELECT announcements.id FROM announcements WHERE announcements.id=? AND announcements.active=1 AND ${announcementScheduledCondition('announcements.scheduled_at')}${visibility}`).get(announcementId,session.user_id,session.user_id);
    if(!announcement)return json(response,404,{message:'Informativo não encontrado.'});
    await db.prepare('INSERT INTO announcement_reads (announcement_id,user_id) VALUES (?,?) ON CONFLICT(announcement_id,user_id) DO UPDATE SET read_at=CURRENT_TIMESTAMP').run(announcementId,session.user_id);
    return json(response, 200, { success: true });
  }

  const readersMatch = url.pathname.match(/^\/api\/informativos\/(\d+)\/leituras$/);
  if (readersMatch && request.method === 'GET') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const rows = await db.prepare(`
      SELECT users.name, users.email, professor_profiles.phone, announcement_reads.read_at
      FROM announcement_reads
      JOIN users ON users.id = announcement_reads.user_id
      LEFT JOIN professor_profiles ON professor_profiles.user_id = users.id
      WHERE announcement_reads.announcement_id = ? AND users.role='professor'
      ORDER BY announcement_reads.read_at DESC
    `).all(Number(readersMatch[1]));
    return json(response, 200, rows);
  }


  if(request.method==='GET'&&url.pathname==='/api/suporte'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    return json(response,200,await listSupportTickets(session,url));
  }
  if(request.method==='GET'&&url.pathname==='/api/suporte/nao-lidos'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const ownership=session.role==='professor'?'AND support_tickets.requester_user_id=?':'';
    const params=[session.user_id,session.user_id,...(session.role==='professor'?[session.user_id]:[])];
    const result=await db.prepare(`
      SELECT COUNT(*) AS total FROM support_tickets
      LEFT JOIN support_ticket_reads ON support_ticket_reads.ticket_id=support_tickets.id AND support_ticket_reads.user_id=?
      WHERE EXISTS (
        SELECT 1 FROM support_messages
        WHERE support_messages.ticket_id=support_tickets.id
          AND support_messages.author_user_id<>?
          AND support_messages.id>COALESCE(support_ticket_reads.last_read_message_id,0)
      ) ${ownership}
    `).get(...params);
    return json(response,200,{total:Number(result.total||0)});
  }
  if(request.method==='POST'&&url.pathname==='/api/suporte'){
    const session=await authorize(request,response,['professor']);if(!session)return;
    const body=await readJson(request),rawSubject=String(body.assunto||''),rawMessage=String(body.mensagem||''),category=cleanText(body.categoria,40);
    const subject=cleanText(rawSubject,120),message=rawMessage.trim();
    const suppliedClientId=String(body.client_message_id||'').trim(),clientMessageId=suppliedClientId||`server_${randomBytes(18).toString('base64url')}`;
    const errors={...validateSupportTicket({assunto:rawSubject,mensagem:rawMessage,categoria:category}),client_message_id:suppliedClientId?supportClientMessageIdError(suppliedClientId):''};
    if(message.length>4000)errors.mensagem='A mensagem deve ter entre 10 e 4000 caracteres.';
    if(hasValidationErrors(errors))return invalid(response,errors);
    if(suppliedClientId){
      const existing=await db.prepare('SELECT ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
      if(existing)return json(response,200,{id:Number(existing.ticket_id),duplicate:true});
    }
    try{
      const created=await db.transaction(async()=>{
        const ticketResult=await db.prepare('INSERT INTO support_tickets (requester_user_id,subject,category) VALUES (?,?,?)').run(session.user_id,subject,category);
        const ticketId=Number(ticketResult.lastInsertRowid);
        const messageResult=await db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,client_message_id) VALUES (?,?,?,?)').run(ticketId,session.user_id,message,clientMessageId);
        await db.prepare('INSERT INTO support_ticket_reads (ticket_id,user_id,last_read_message_id) VALUES (?,?,?)').run(ticketId,session.user_id,Number(messageResult.lastInsertRowid));
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_created:${ticketId}`,ip);
        return ticketId;
      });
      return json(response,201,{id:created});
    }catch(error){
      if(duplicateError(error)&&suppliedClientId){
        const existing=await db.prepare('SELECT ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
        if(existing)return json(response,200,{id:Number(existing.ticket_id),duplicate:true});
      }
      throw error;
    }
  }
  const ticketDetailMatch=url.pathname.match(/^\/api\/suporte\/(\d+)$/);
  if(ticketDetailMatch&&request.method==='GET'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const ticketId=Number(ticketDetailMatch[1]),ticket=await supportTicketForSession(ticketId,session);
    if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
    const [messages,events]=await Promise.all([
      db.prepare(`
        SELECT support_messages.id,support_messages.author_user_id,support_messages.body,support_messages.created_at,
          users.name AS author_name,users.role AS author_role
        FROM support_messages JOIN users ON users.id=support_messages.author_user_id
        WHERE support_messages.ticket_id=?
        ORDER BY support_messages.created_at,support_messages.id
      `).all(ticketId),
      db.prepare(`
        SELECT support_ticket_events.id,support_ticket_events.event_type,support_ticket_events.from_status,
          support_ticket_events.to_status,support_ticket_events.created_at,users.name AS actor_name
        FROM support_ticket_events LEFT JOIN users ON users.id=support_ticket_events.actor_user_id
        WHERE support_ticket_events.ticket_id=?
        ORDER BY support_ticket_events.created_at,support_ticket_events.id
      `).all(ticketId),
    ]);
    return json(response,200,{
      ticket:{...supportTicketView({...ticket,last_message_at:ticket.updated_at}),status:supportStatusFromDatabase(ticket.status)},
      messages:messages.map(item=>({id:Number(item.id),author_user_id:Number(item.author_user_id),author_name:item.author_name,author_role:item.author_role,body:item.body,created_at:item.created_at})),
      events:events.map(item=>({...item,id:Number(item.id),from_status:supportStatusFromDatabase(item.from_status),to_status:supportStatusFromDatabase(item.to_status)})),
    });
  }
  if(ticketDetailMatch&&request.method==='DELETE'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const ticketId=Number(ticketDetailMatch[1]);
    const ticket=await supportTicketForSession(ticketId,session);
    if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
    await db.transaction(async()=>{
      await db.prepare('DELETE FROM support_tickets WHERE id=?').run(ticketId);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_deleted:${ticketId}`,ip);
    });
    return json(response,200,{success:true});
  }
  const ticketReadMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/lido$/);
  if(ticketReadMatch&&request.method==='POST'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const ticketId=Number(ticketReadMatch[1]),ticket=await supportTicketForSession(ticketId,session);
    if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
    const body=await readJson(request),lastMessageId=Number(body.last_message_id||0);
    if(body.last_message_id!==undefined&&(!Number.isInteger(lastMessageId)||lastMessageId<1))return json(response,400,{message:'Mensagem de leitura inválida.'});
    if(lastMessageId&&!(await db.prepare('SELECT id FROM support_messages WHERE ticket_id=? AND id=?').get(ticketId,lastMessageId)))return json(response,400,{message:'Mensagem de leitura não pertence a este chamado.'});
    await markSupportTicketRead(ticketId,session.user_id,lastMessageId);
    return json(response,200,{success:true});
  }
  const replyMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/responder$/);
  if(replyMatch&&request.method==='POST'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const ticketId=Number(replyMatch[1]),ticket=await supportTicketForSession(ticketId,session);
    if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
    if(ticket.status==='Resolvido'&&session.role==='gestor')return json(response,409,{message:'Reabra o chamado antes de responder.'});
    const body=await readJson(request),message=String(body.mensagem||'').trim(),suppliedClientId=String(body.client_message_id||'').trim();
    const clientMessageId=suppliedClientId||`server_${randomBytes(18).toString('base64url')}`;
    const errors={mensagem:supportMessageError(message,'A resposta'),client_message_id:suppliedClientId?supportClientMessageIdError(suppliedClientId):''};
    if(message.length>4000)errors.mensagem='A resposta deve ter entre 2 e 4000 caracteres.';
    if(hasValidationErrors(errors))return invalid(response,errors);
    if(suppliedClientId){
      const existing=await db.prepare('SELECT id,ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
      if(existing)return Number(existing.ticket_id)===ticketId?json(response,200,{success:true,id:Number(existing.id),duplicate:true}):json(response,409,{message:'Este identificador de envio já foi utilizado.'});
    }
    const nextStatus=session.role==='gestor'?'Pendente':'Aberto';
    try{
      const messageId=await db.transaction(async()=>{
        const inserted=await db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,client_message_id) VALUES (?,?,?,?)').run(ticketId,session.user_id,message,clientMessageId);
        const id=Number(inserted.lastInsertRowid);
        await db.prepare(`INSERT INTO support_ticket_reads (ticket_id,user_id,last_read_message_id,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(ticket_id,user_id) DO UPDATE SET last_read_message_id=excluded.last_read_message_id,updated_at=CURRENT_TIMESTAMP`).run(ticketId,session.user_id,id);
        await db.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(nextStatus,ticketId);
        if(ticket.status!==nextStatus)await db.prepare('INSERT INTO support_ticket_events (ticket_id,actor_user_id,event_type,from_status,to_status) VALUES (?,?,\'status_changed\',?,?)').run(ticketId,session.user_id,ticket.status,nextStatus);
        await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_replied:${ticketId}`,ip);
        return id;
      });
      return json(response,201,{success:true,id:messageId,status:supportStatusFromDatabase(nextStatus)});
    }catch(error){
      if(duplicateError(error)&&suppliedClientId){
        const existing=await db.prepare('SELECT id,ticket_id FROM support_messages WHERE author_user_id=? AND client_message_id=?').get(session.user_id,clientMessageId);
        if(existing&&Number(existing.ticket_id)===ticketId)return json(response,200,{success:true,id:Number(existing.id),duplicate:true});
      }
      throw error;
    }
  }
  const ticketStatusMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/status$/);
  if(ticketStatusMatch&&request.method==='PUT'){
    const session=await authorize(request,response,['gestor']);if(!session)return;
    const ticketId=Number(ticketStatusMatch[1]),body=await readJson(request),requestedStatus=cleanText(body.status,30);
    if(!SUPPORT_STATUSES.includes(requestedStatus))return json(response,400,{message:'Status inválido.'});
    const ticket=await supportTicketForSession(ticketId,session);if(!ticket)return json(response,404,{message:'Chamado não encontrado.'});
    const nextStatus=supportStatusToDatabase(requestedStatus);
    if(ticket.status!==nextStatus)await db.transaction(async()=>{
      await db.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(nextStatus,ticketId);
      await db.prepare('INSERT INTO support_ticket_events (ticket_id,actor_user_id,event_type,from_status,to_status) VALUES (?,?,\'status_changed\',?,?)').run(ticketId,session.user_id,ticket.status,nextStatus);
      await db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,`ticket_status_changed:${ticketId}`,ip);
    });
    return json(response,200,{success:true,status:requestedStatus});
  }

  if(request.method==='GET'&&url.pathname==='/api/dashboard/gestor'){
    if(!await authorize(request,response,['gestor']))return;
    const stats={
      totalAlunos:(await db.prepare('SELECT COUNT(*) AS total FROM students WHERE active=1').get()).total,
      cursosAtivos:(await db.prepare('SELECT COUNT(*) AS total FROM classes WHERE active=1').get()).total,
      professores:(await db.prepare('SELECT COUNT(*) AS total FROM professor_profiles WHERE active=1').get()).total,
      ticketsPendentes:(await db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status<>'Resolvido'").get()).total,
    };
    const inscricoesPorCurso=await db.prepare("SELECT courses.name AS curso,COUNT(enrollments.id) AS total FROM courses LEFT JOIN classes ON classes.course_id=courses.id AND classes.active=1 LEFT JOIN enrollments ON enrollments.class_id=classes.id AND enrollments.status='ativa' WHERE courses.active=1 GROUP BY courses.id ORDER BY total DESC,courses.name").all();
    const ultimasInscricoes=await db.prepare("SELECT students.name AS nome,courses.name AS curso,locations.name AS local,enrollments.enrolled_at FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE enrollments.status='ativa' ORDER BY enrollments.enrolled_at DESC,enrollments.id DESC LIMIT 6").all();
    const baixaFrequencia=(await db.prepare(`SELECT students.id,students.name AS nome,students.email AS contato,students.phone AS telefone,students.church AS igreja,students.age_group AS classe,students.has_instrument,courses.name AS curso,locations.name AS local,ROUND(100.0*SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END)/NULLIF(COUNT(attendance_records.id),0)) AS frequencia FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN students ON students.id=attendance_records.student_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE students.active=1 GROUP BY students.id,classes.id,courses.name,locations.name HAVING ROUND(100.0*SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END)/NULLIF(COUNT(attendance_records.id),0))<75 ORDER BY frequencia,students.name`).all()).map(row=>({...row,curso:[row.curso],instrumento:row.has_instrument?'Sim':'Não',status:'Ativo'}));
    return json(response,200,{stats,inscricoesPorCurso,ultimasInscricoes,baixaFrequencia});
  }
  if(request.method==='GET'&&url.pathname==='/api/dashboard/professor'){
    const session=await authorize(request,response,['professor']);if(!session)return;
    const totalAlunos=(await db.prepare("SELECT COUNT(DISTINCT enrollments.student_id) AS total FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id JOIN students ON students.id=enrollments.student_id WHERE professor_profiles.user_id=? AND enrollments.status='ativa' AND students.active=1 AND classes.active=1").get(session.user_id)).total;
    const allClasses=await db.prepare('SELECT courses.name AS curso,locations.name AS local,classes.weekday,classes.start_time FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.active=1').all(session.user_id);
    const dayMap = { 'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2, 'quarta-feira': 3, 'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6 };
    const now = new Date();
    const currentDay = now.getDay(), currentTime = now.toTimeString().slice(0,5);
    let proxima = null, minDiff = Infinity;
    for (const c of allClasses) {
      if (!c.weekday || !c.start_time) continue;
      const classDay = dayMap[c.weekday.toLowerCase()];
      if (classDay === undefined) continue;
      let diffDays = classDay - currentDay;
      if (diffDays < 0 || (diffDays === 0 && c.start_time <= currentTime)) diffDays += 7;
      const classTimeMinutes = parseInt(c.start_time.split(':')[0]) * 60 + parseInt(c.start_time.split(':')[1]);
      const currentTimeMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1]);
      const diffMinutes = diffDays * 24 * 60 + (classTimeMinutes - currentTimeMinutes);
      if (diffMinutes < minDiff) { minDiff = diffMinutes; proxima = c; }
    }
    const frequency=await db.prepare("SELECT COUNT(attendance_records.id) AS total,COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=?").get(session.user_id);
    const frequenciaMedia=frequency.total?Math.round(100*frequency.presencas/frequency.total):null;
    const informativos=(await db.prepare(`SELECT COUNT(*) AS total FROM announcements WHERE active=1 AND ${announcementScheduledCondition('scheduled_at')} AND (
      NOT EXISTS (SELECT 1 FROM announcement_recipients ar_all WHERE ar_all.announcement_id=announcements.id)
      OR EXISTS (SELECT 1 FROM announcement_recipients ar WHERE ar.announcement_id=announcements.id AND (
        (ar.recipient_type='professor' AND ar.recipient_id=(SELECT pp.id FROM professor_profiles pp WHERE pp.user_id=? AND pp.active=1))
        OR (ar.recipient_type='curso' AND ar.recipient_id IN (SELECT classes.course_id FROM classes JOIN professor_profiles pp ON pp.id=classes.professor_id WHERE pp.user_id=? AND pp.active=1 AND classes.active=1))
      ))
    )`).get(session.user_id,session.user_id)).total;
    const ticketsAbertos=(await db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE requester_user_id=? AND status<>'Resolvido'").get(session.user_id)).total;
    return json(response,200,{stats:{totalAlunos,informativos,ticketsAbertos,frequenciaMedia},proximaAula:proxima?{...proxima,descricao:`${proxima.weekday||'A definir'}, ${proxima.start_time||'horário a definir'}`} : null});
  }

  if(request.method==='GET'&&url.pathname==='/api/relatorios/opcoes'){
    if(!await authorize(request,response,['gestor','professor']))return;
    const [courses, locations, professors] = await Promise.all([
      db.prepare('SELECT name FROM courses WHERE active=1 ORDER BY name').all(),
      db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all(),
      db.prepare('SELECT name FROM professor_profiles WHERE active=1 ORDER BY name').all(),
    ]);
    return json(response,200,{cursos:courses.map(row=>row.name),locais:locations.map(row=>row.name),professores:professors.map(row=>row.name)});
  }
  if(request.method==='GET'&&url.pathname==='/api/relatorios/frequencia'){
    const session=await authorize(request,response,['gestor','professor']);if(!session)return;
    const conditions=["enrollments.status='ativa'","students.active=1","classes.active=1"],whereParams=[],joinParams=[];
    const filters={curso:url.searchParams.get('curso'),local:url.searchParams.get('local'),professor:url.searchParams.get('professor'),classId:url.searchParams.get('curso_id')};
    if(filters.curso){conditions.push('courses.name=?');whereParams.push(filters.curso)}
    if(filters.local){conditions.push('locations.name=?');whereParams.push(filters.local)}
    if(filters.professor){conditions.push('professor_profiles.name=?');whereParams.push(filters.professor)}
    if(filters.classId){conditions.push('classes.id=?');whereParams.push(Number(filters.classId))}
    if(session.role==='professor'){conditions.push('professor_profiles.user_id=?');whereParams.push(session.user_id)}
    const start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
    let dateJoin='';
    if(start){dateJoin+=' AND attendance_sessions.class_date>=?';joinParams.push(start)}
    if(end){dateJoin+=' AND attendance_sessions.class_date<=?';joinParams.push(end)}
    const sql="SELECT courses.name AS curso,students.name AS aluno,professor_profiles.name AS professor,locations.name AS local,COUNT(DISTINCT attendance_sessions.id) AS aulas,COALESCE(SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END),0) AS presencas FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id"+dateJoin+" LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id AND attendance_records.student_id=students.id WHERE "+conditions.join(' AND ')+" GROUP BY enrollments.id,courses.name,students.name,professor_profiles.name,locations.name ORDER BY courses.name,students.name";
    const rows=await db.prepare(sql).all(...joinParams,...whereParams);
    return json(response,200,rows.map(row=>({curso:row.curso,aluno:row.aluno,professor:row.professor,local:row.local,frequencia:row.aulas?(Math.round(100*row.presencas/row.aulas)+'%'):'Sem aulas'})));
  }
  if(request.method==='GET'&&url.pathname==='/api/relatorios/evasao'){
    if(!await authorize(request,response,['gestor']))return;
    const conditions=['1=1'],params=[],course=url.searchParams.get('curso'),start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
    if(course){conditions.push('courses.name=?');params.push(course)}
    if(start){conditions.push('dropout_events.occurred_at>=?');params.push(start)}
    if(end){conditions.push('dropout_events.occurred_at<=?');params.push(end)}
    const sql="SELECT courses.name AS curso,students.name AS aluno,enrollments.enrolled_at AS dataInscricao,dropout_events.occurred_at AS dataEvasao,dropout_events.reason AS motivo FROM dropout_events JOIN students ON students.id=dropout_events.student_id JOIN classes ON classes.id=dropout_events.class_id JOIN courses ON courses.id=classes.course_id LEFT JOIN enrollments ON enrollments.student_id=students.id AND enrollments.class_id=classes.id WHERE "+conditions.join(' AND ')+" ORDER BY dropout_events.occurred_at DESC";
    return json(response,200,await db.prepare(sql).all(...params));
  }

  if (request.method === 'GET' && url.pathname === '/api/radar') {
    const session = await authorize(request, response, ['gestor']); if (!session) return;
    const enrollments = await db.prepare(`
      SELECT e.student_id, e.class_id, c.label as class_name, s.name as student_name, s.phone as student_phone
      FROM enrollments e
      JOIN students s ON s.id=e.student_id
      JOIN classes c ON c.id=e.class_id
      WHERE e.status='ativa' AND s.active=1
    `).all();
    const attendance = await db.prepare(`
      SELECT ar.student_id, ar.status, asess.class_date, asess.class_id
      FROM attendance_records ar
      JOIN attendance_sessions asess ON asess.id=ar.session_id
      WHERE asess.class_date >= ${db.dialect === 'sqlite' ? "date('now', '-3 months')" : "CURRENT_DATE - INTERVAL '3 months'"}
      ORDER BY asess.class_date DESC
    `).all();
    const alerts = [];
    for (const e of enrollments) {
      const records = attendance.filter(a => a.student_id === e.student_id && a.class_id === e.class_id);
      if (records.length === 0) continue;
      let consecutiveAbsences = 0;
      for (const r of records) {
        if (r.status === 'ausente') consecutiveAbsences++;
        else break;
      }
      const totalClasses = records.length;
      const presentClasses = records.filter(r => r.status === 'presente').length;
      const frequency = totalClasses > 0 ? presentClasses / totalClasses : 1;
      const riskReasons = [];
      if (consecutiveAbsences >= 3) riskReasons.push(`${consecutiveAbsences} faltas consecutivas`);
      if (totalClasses >= 4 && frequency < 0.75) riskReasons.push(`Frequência global baixa (${Math.round(frequency*100)}%)`);
      if (riskReasons.length > 0) {
        alerts.push({
          student_id: e.student_id,
          class_id: e.class_id,
          student_name: e.student_name,
          student_phone: e.student_phone,
          class_name: e.class_name,
          reasons: riskReasons
        });
      }
    }
    return json(response, 200, { radar: alerts });
  }

  return json(response, 404, { message: 'Rota não encontrada.' });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
}

async function serve(request, response, url) {
  if (!isProduction && request.method === 'GET' && url.pathname === '/dev-mail') {
    const emails = await db.prepare('SELECT * FROM dev_emails ORDER BY id DESC LIMIT 20').all();
    const cards = emails.map(email => {
      const body = escapeHtml(email.body).replace(/(http:\/\/127\.0\.0\.1:\d+\/(?:reset-password|accept-invite)\?token=[A-Za-z0-9_%.-]+)/g, '<a href="$1">$1</a>');
      return `<article><h2>${escapeHtml(email.subject)}</h2><p><strong>Para:</strong> ${escapeHtml(email.recipient)}</p><pre>${body}</pre></article>`;
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>Caixa de e-mail de testes</title><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px;background:#f5f5f5}article{background:white;padding:24px;margin:20px 0;border-radius:12px;box-shadow:0 2px 10px #0001}pre{white-space:pre-wrap;line-height:1.5}</style><h1>Caixa de e-mail de testes</h1><p>Mensagens geradas apenas neste ambiente local.</p>${cards || '<p>Nenhuma mensagem.</p>'}`;
    response.writeHead(200, securityHeaders('text/html; charset=utf-8'));
    return response.end(html);
  }
  let file = join(distRoot, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, ''));
  try { if (!(await stat(file)).isFile()) throw new Error(); } catch { file = join(distRoot, 'index.html'); }
  try {
    const content = await readFile(file);
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' };
    response.writeHead(200, { ...securityHeaders(types[extname(file)] || 'application/octet-stream'), 'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable' });
    response.end(content);
  } catch { json(response, 503, { message: 'Frontend ainda não compilado.' }); }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, baseUrl);
    if (url.pathname.startsWith('/api/') || ['/alunos','/cursos','/professores','/frequencia'].some(prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
      return await api(request, response, url);
    }
    return await serve(request, response, url);
  } catch (error) {
    console.error(error);
    json(response, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500, { message: 'Erro interno do servidor.' });
  }
});

server.listen(port, host, () => {
  console.log(`Projeto Aprendiz Aprimorado em ${baseUrl}`);
  if (!isProduction) console.log('Caixa de e-mail de testes em /dev-mail');
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Encerrando servidor após ${signal}...`);
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async () => {
    try { await db.close(); }
    finally { process.exit(0); }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
