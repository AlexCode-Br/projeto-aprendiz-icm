import http from 'node:http';
import { initializeClassSchedules } from './class-schedules.mjs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createDatabase } from './database.mjs';
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

const logger = createStructuredLogger();
await mkdir(dataRoot, { recursive: true });
const db = await createDatabase({ sqlitePath, logger });
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
  CREATE TABLE IF NOT EXISTS profile_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('user','professor','student')),
    owner_id INTEGER NOT NULL CHECK(owner_id > 0),
    mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
    size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 5242880),
    data_url TEXT,
    storage_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_type,owner_id),
    CHECK((data_url IS NOT NULL AND storage_path IS NULL) OR (data_url IS NULL AND storage_path IS NOT NULL))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS profile_photos_storage_path_unique ON profile_photos(storage_path) WHERE storage_path IS NOT NULL;
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
  CREATE TABLE IF NOT EXISTS churches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT COLLATE NOCASE,
    phone TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    guardian_consent_at TEXT,
    church_id INTEGER REFERENCES churches(id),
    age_group TEXT,
    has_instrument INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    anonymized_at TEXT,
    anonymized_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_unique ON students(LOWER(email)) WHERE email IS NOT NULL;
  CREATE INDEX IF NOT EXISTS students_church_id_idx ON students(church_id);
  CREATE INDEX IF NOT EXISTS students_anonymized_at_idx ON students(anonymized_at);
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS school_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE COLLATE NOCASE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
    dates_confirmed INTEGER NOT NULL DEFAULT 1 CHECK(dates_confirmed IN (0,1)),
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK(start_date < end_date)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS school_years_single_active_unique ON school_years(active) WHERE active=1;
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_year_id INTEGER NOT NULL REFERENCES school_years(id),
    course_id INTEGER NOT NULL REFERENCES courses(id),
    professor_id INTEGER NOT NULL REFERENCES professor_profiles(id),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    label TEXT,
    weekday TEXT,
    start_time TEXT,
    capacity INTEGER CHECK(capacity IS NULL OR (capacity BETWEEN 1 AND 500)),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS classes_distinct_offering_unique ON classes(school_year_id,course_id,professor_id,location_id,LOWER(COALESCE(label,'')),COALESCE(weekday,''),COALESCE(start_time,''));
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','concluida','cancelada')),
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    transferred_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    UNIQUE(student_id, class_id)
  );
  CREATE INDEX IF NOT EXISTS enrollments_transferred_to_class_id_idx ON enrollments(transferred_to_class_id);
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
    reason_category TEXT NOT NULL DEFAULT 'outro' CHECK(reason_category IN ('mudanca','desinteresse','horario','saude','familia','outro')),
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS student_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    note TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('contatado','sem_resposta','retorno_agendado','outro')),
    contacted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS student_contacts_student_date_idx ON student_contacts(student_id,contacted_at DESC,id DESC);
  CREATE INDEX IF NOT EXISTS student_contacts_user_id_idx ON student_contacts(user_id);
  CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_type TEXT NOT NULL CHECK(notification_type IN ('attendance_reminder','weekly_manager_summary')),
    reference_key TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
    last_error TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_type,reference_key,recipient)
  );
  CREATE INDEX IF NOT EXISTS scheduled_notifications_status_idx ON scheduled_notifications(status,updated_at);
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
  await db.prepare(`INSERT OR IGNORE INTO school_years (label,start_date,end_date,active,dates_confirmed)
    VALUES ('Período atual — datas pendentes','1900-01-01','1900-01-02',1,0)`).run();
  const classColumns = await db.prepare('PRAGMA table_info(classes)').all();
  if (!classColumns.some(column => column.name === 'school_year_id')) {
    await db.exec('ALTER TABLE classes ADD COLUMN school_year_id INTEGER REFERENCES school_years(id);');
  }
  await db.prepare('UPDATE classes SET school_year_id=(SELECT id FROM school_years WHERE active=1 LIMIT 1) WHERE school_year_id IS NULL').run();
  const classTable = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='classes'").get();
  if (!classColumns.some(column=>column.name==='capacity') && !String(classTable?.sql || '').replace(/\s+/g,'').includes('UNIQUE(school_year_id,course_id,professor_id,location_id)')) {
    await db.exec(`
      PRAGMA foreign_keys=OFF;
      CREATE TABLE classes_period_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_year_id INTEGER NOT NULL REFERENCES school_years(id),
        course_id INTEGER NOT NULL REFERENCES courses(id),
        professor_id INTEGER NOT NULL REFERENCES professor_profiles(id),
        location_id INTEGER NOT NULL REFERENCES locations(id),
        label TEXT,
        weekday TEXT,
        start_time TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(school_year_id,course_id,professor_id,location_id)
      );
      INSERT INTO classes_period_migration (id,school_year_id,course_id,professor_id,location_id,label,weekday,start_time,active,created_at)
        SELECT id,school_year_id,course_id,professor_id,location_id,label,weekday,start_time,active,created_at FROM classes;
      DROP TABLE classes;
      ALTER TABLE classes_period_migration RENAME TO classes;
      PRAGMA foreign_keys=ON;
    `);
  }
  await db.exec('CREATE INDEX IF NOT EXISTS classes_school_year_id_idx ON classes(school_year_id);');
  if(!classColumns.some(column=>column.name==='capacity'))await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS classes_period_offering_unique ON classes(school_year_id,course_id,professor_id,location_id);');
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
  if (studentColumns.some(column=>column.name==='church') || studentColumns.find(column=>column.name==='email')?.notnull===1) {
    await db.exec(`
      INSERT OR IGNORE INTO churches (name)
        SELECT DISTINCT TRIM(church) FROM students WHERE church IS NOT NULL AND TRIM(church)<>'';
      PRAGMA foreign_keys=OFF;
      DROP INDEX IF EXISTS students_email_lower_unique;
      DROP INDEX IF EXISTS students_church_id_idx;
      CREATE TABLE students_model_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT COLLATE NOCASE,
        phone TEXT,
        guardian_name TEXT,
        guardian_phone TEXT,
        guardian_consent_at TEXT,
        church_id INTEGER REFERENCES churches(id),
        age_group TEXT,
        has_instrument INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        anonymized_at TEXT,
        anonymized_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO students_model_migration (id,name,email,phone,church_id,age_group,has_instrument,active,created_at,updated_at)
        SELECT students.id,students.name,NULLIF(TRIM(students.email),''),students.phone,churches.id,students.age_group,students.has_instrument,students.active,students.created_at,students.updated_at
        FROM students LEFT JOIN churches ON LOWER(churches.name)=LOWER(TRIM(students.church));
      DROP TABLE students;
      ALTER TABLE students_model_migration RENAME TO students;
      PRAGMA foreign_keys=ON;
    `);
  }
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS students_email_lower_unique ON students(LOWER(email)) WHERE email IS NOT NULL; CREATE INDEX IF NOT EXISTS students_church_id_idx ON students(church_id);');
  const privacyStudentColumns=await db.prepare('PRAGMA table_info(students)').all();
  if(!privacyStudentColumns.some(column=>column.name==='guardian_consent_at'))await db.exec('ALTER TABLE students ADD COLUMN guardian_consent_at TEXT;');
  if(!privacyStudentColumns.some(column=>column.name==='anonymized_at'))await db.exec('ALTER TABLE students ADD COLUMN anonymized_at TEXT;');
  if(!privacyStudentColumns.some(column=>column.name==='anonymized_by'))await db.exec('ALTER TABLE students ADD COLUMN anonymized_by INTEGER REFERENCES users(id) ON DELETE SET NULL;');
  await db.exec('CREATE INDEX IF NOT EXISTS students_anonymized_at_idx ON students(anonymized_at);');

  const academicClassColumns=await db.prepare('PRAGMA table_info(classes)').all();
  const academicClassTable=await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='classes'").get();
  if(!academicClassColumns.some(column=>column.name==='capacity')||String(academicClassTable?.sql||'').replace(/\s+/g,'').includes('UNIQUE(school_year_id,course_id,professor_id,location_id)')){
    await db.exec(`
      PRAGMA foreign_keys=OFF;
      DROP INDEX IF EXISTS classes_period_offering_unique;
      DROP INDEX IF EXISTS classes_distinct_offering_unique;
      CREATE TABLE classes_model_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_year_id INTEGER NOT NULL REFERENCES school_years(id),
        course_id INTEGER NOT NULL REFERENCES courses(id),
        professor_id INTEGER NOT NULL REFERENCES professor_profiles(id),
        location_id INTEGER NOT NULL REFERENCES locations(id),
        label TEXT,
        weekday TEXT,
        start_time TEXT,
        capacity INTEGER CHECK(capacity IS NULL OR (capacity BETWEEN 1 AND 500)),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO classes_model_migration (id,school_year_id,course_id,professor_id,location_id,label,weekday,start_time,active,created_at)
        SELECT id,school_year_id,course_id,professor_id,location_id,label,weekday,start_time,active,created_at FROM classes;
      DROP TABLE classes;
      ALTER TABLE classes_model_migration RENAME TO classes;
      PRAGMA foreign_keys=ON;
    `);
  }
  await db.exec(`
    DROP INDEX IF EXISTS classes_period_offering_unique;
    CREATE INDEX IF NOT EXISTS classes_school_year_id_idx ON classes(school_year_id);
    CREATE UNIQUE INDEX IF NOT EXISTS classes_distinct_offering_unique ON classes(school_year_id,course_id,professor_id,location_id,LOWER(COALESCE(label,'')),COALESCE(weekday,''),COALESCE(start_time,''));
  `);

  const enrollmentColumns=await db.prepare('PRAGMA table_info(enrollments)').all();
  if(!enrollmentColumns.some(column=>column.name==='completed_at'))await db.exec('ALTER TABLE enrollments ADD COLUMN completed_at TEXT;');
  if(!enrollmentColumns.some(column=>column.name==='transferred_to_class_id'))await db.exec('ALTER TABLE enrollments ADD COLUMN transferred_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;');
  await db.exec('CREATE INDEX IF NOT EXISTS enrollments_transferred_to_class_id_idx ON enrollments(transferred_to_class_id);');
  const dropoutColumns=await db.prepare('PRAGMA table_info(dropout_events)').all();
  if(!dropoutColumns.some(column=>column.name==='reason_category'))await db.exec("ALTER TABLE dropout_events ADD COLUMN reason_category TEXT NOT NULL DEFAULT 'outro' CHECK(reason_category IN ('mudanca','desinteresse','horario','saude','familia','outro')); UPDATE dropout_events SET reason_category=CASE WHEN LOWER(reason) LIKE '%horário%' OR LOWER(reason) LIKE '%horario%' THEN 'horario' WHEN LOWER(reason) LIKE '%pessoais%' OR LOWER(reason) LIKE '%familia%' THEN 'familia' ELSE 'outro' END;");
}

const cleanEmail = normalizeEmail;
const publicUser = user => ({ id: user.id, nome: user.name, email: user.email, role: user.role });

function invalid(response, errors, fallback = 'Revise os campos informados.') {
  return json(response, 400, { message: Object.values(errors).find(Boolean) || fallback, errors });
}

function duplicateError(error) {
  return error?.code === '23505' || String(error).includes('UNIQUE');
}

const { sendEmail } = createEmailService({ db, isProduction });
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
  const schoolYear = await db.prepare('SELECT id FROM school_years WHERE active=1 ORDER BY id DESC LIMIT 1').get();
  if (!schoolYear) throw new Error('Nenhum período letivo ativo foi configurado.');
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
    await db.prepare('INSERT OR IGNORE INTO classes (school_year_id,course_id,professor_id,location_id,label,weekday,start_time) VALUES (?,?,?,?,?,?,?)')
      .run(schoolYear.id,courseId,professorId,locationId,`${course} — ${location}`,'Sábado','09:00');
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
    await db.prepare('INSERT OR IGNORE INTO churches (name) VALUES (?)').run(church);
    const churchId=(await db.prepare('SELECT id FROM churches WHERE name=?').get(church)).id;
    await db.prepare('INSERT OR IGNORE INTO students (name,email,phone,church_id,age_group,has_instrument) VALUES (?,?,?,?,?,?)')
      .run(name,email,phone,churchId,ageGroup,instrument);
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

await initializeClassSchedules(db);

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const AUTH_RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
const authRateLimiter = createSlidingWindowRateLimiter();

async function consumeAuthRateLimit({ route, ip, email = '', includeIp = true, includeEmail = true }) {
  const blockedScopes = [];
  let retryAfterMs = 0;
  if (includeIp) {
    const result = authRateLimiter.consume({
      key: opaqueRateLimitKey(`auth:${route}:ip`, ip),
      limit: 20,
      windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    });
    if (result.blocked) blockedScopes.push('ip');
    retryAfterMs = Math.max(retryAfterMs, result.retryAfterMs);
  }
  if (includeEmail && email) {
    const result = authRateLimiter.consume({
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

const { cookies, cookie, securityHeaders, json, originAllowed } = createHttpSecurity({ isProduction, appOrigin });

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
    if (!Number.isInteger(id) || id < 1) {
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
} = createAnnouncementStorage({ db, supabaseAdmin, logger });
const profilePhotoStorage = createProfilePhotoStorage({ db, supabaseAdmin, logger });
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
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.txt':'text/plain; charset=utf-8' };
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
    const requestId=randomUUID();
    let pathname='desconhecido';
    try{pathname=new URL(request.url,baseUrl).pathname}catch{}
    logger.error('http_request_failed',error,{requestId,method:request.method,path:pathname});
    if(!response.headersSent)json(response, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500, { message: 'Erro interno do servidor.', requestId }, { 'X-Request-Id': requestId });
    else response.destroy();
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
