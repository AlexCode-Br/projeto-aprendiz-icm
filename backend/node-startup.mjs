import { randomBytes } from 'node:crypto';
import { initializeClassSchedules } from './class-schedules.mjs';
import { hashPassword, strongPassword } from './security.mjs';
import { normalizeEmail } from '../shared/validation.mjs';

// Local/Node bootstrap only. Workers use the existing migrated production database.
export async function initializeNodeApplication({ db, env = process.env }) {
  const isProduction = env.NODE_ENV === 'production';
  const usesSupabaseAuth = (env.AUTH_PROVIDER || (env.SUPABASE_URL ? 'supabase' : 'local')) === 'supabase';
  const cleanEmail = normalizeEmail;
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
    CREATE INDEX IF NOT EXISTS enrollments_recent_active_idx ON enrollments(enrolled_at DESC,id DESC) WHERE status='ativa';
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
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
      CREATE INDEX IF NOT EXISTS classes_course_id_idx ON classes(course_id);
    `);
    const remoteLocation=await db.prepare("SELECT id FROM locations WHERE LOWER(TRIM(name))='remoto' ORDER BY id LIMIT 1").get();
    if(remoteLocation){
      const eadLocation=await db.prepare("SELECT id FROM locations WHERE LOWER(TRIM(name))='ead' AND id<>? ORDER BY id LIMIT 1").get(remoteLocation.id);
      await db.transaction(async()=>{
        if(eadLocation){
          await db.prepare("UPDATE classes SET location_id=?,label=CASE WHEN label IS NULL THEN NULL ELSE REPLACE(label,'Remoto','EAD') END WHERE location_id=?").run(eadLocation.id,remoteLocation.id);
          await db.prepare('UPDATE professor_profiles SET home_location_id=? WHERE home_location_id=?').run(eadLocation.id,remoteLocation.id);
          await db.prepare('DELETE FROM locations WHERE id=?').run(remoteLocation.id);
          await db.prepare("UPDATE locations SET name='EAD',active=1 WHERE id=?").run(eadLocation.id);
        }else{
          await db.prepare("UPDATE locations SET name='EAD',active=1 WHERE id=?").run(remoteLocation.id);
          await db.prepare("UPDATE classes SET label=REPLACE(label,'Remoto','EAD') WHERE location_id=? AND label IS NOT NULL").run(remoteLocation.id);
        }
      });
    }

    const enrollmentColumns=await db.prepare('PRAGMA table_info(enrollments)').all();
    if(!enrollmentColumns.some(column=>column.name==='completed_at'))await db.exec('ALTER TABLE enrollments ADD COLUMN completed_at TEXT;');
    if(!enrollmentColumns.some(column=>column.name==='transferred_to_class_id'))await db.exec('ALTER TABLE enrollments ADD COLUMN transferred_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;');
    await db.exec("CREATE INDEX IF NOT EXISTS enrollments_recent_active_idx ON enrollments(enrolled_at DESC,id DESC) WHERE status='ativa';");
    await db.exec('CREATE INDEX IF NOT EXISTS enrollments_transferred_to_class_id_idx ON enrollments(transferred_to_class_id);');
    const dropoutColumns=await db.prepare('PRAGMA table_info(dropout_events)').all();
    if(!dropoutColumns.some(column=>column.name==='reason_category'))await db.exec("ALTER TABLE dropout_events ADD COLUMN reason_category TEXT NOT NULL DEFAULT 'outro' CHECK(reason_category IN ('mudanca','desinteresse','horario','saude','familia','outro')); UPDATE dropout_events SET reason_category=CASE WHEN LOWER(reason) LIKE '%horário%' OR LOWER(reason) LIKE '%horario%' THEN 'horario' WHEN LOWER(reason) LIKE '%pessoais%' OR LOWER(reason) LIKE '%familia%' THEN 'familia' ELSE 'outro' END;");
  }

  async function seedUser(name, email, password, role) {
    if (await db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return;
    await db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
      .run(name, email, await hashPassword(password || randomBytes(48).toString('base64url')), role);
  }

  const seedDemoData = env.SEED_DEMO_DATA === 'true' || !isProduction;
  if (seedDemoData) {
    await seedUser('Admin Regional', 'gestor@projetoaprendiz.local', 'Gestor@2026!', 'gestor');
    await seedUser('Marina Oliveira', 'professor@projetoaprendiz.local', 'Professor@2026!', 'professor');
  } else if (env.BOOTSTRAP_ADMIN_EMAIL && (usesSupabaseAuth || env.BOOTSTRAP_ADMIN_PASSWORD)) {
    if (!usesSupabaseAuth && !strongPassword(env.BOOTSTRAP_ADMIN_PASSWORD)) throw new Error('BOOTSTRAP_ADMIN_PASSWORD não atende aos requisitos de segurança.');
    await seedUser(env.BOOTSTRAP_ADMIN_NAME || 'Administrador', cleanEmail(env.BOOTSTRAP_ADMIN_EMAIL), env.BOOTSTRAP_ADMIN_PASSWORD, 'gestor');
  }
  if (!seedDemoData && !(await db.prepare('SELECT id FROM users LIMIT 1').get())) {
    throw new Error(usesSupabaseAuth ? 'Defina BOOTSTRAP_ADMIN_EMAIL com o e-mail do primeiro Gestor criado no Supabase Auth.' : 'Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD para criar o primeiro Gestor.');
  }

  async function seedAcademicData() {
    const schoolYear = await db.prepare('SELECT id FROM school_years WHERE active=1 ORDER BY id DESC LIMIT 1').get();
    if (!schoolYear) throw new Error('Nenhum período letivo ativo foi configurado.');
    const locationNames = ['Pituba', 'Brotas', 'Lauro de Freitas', 'Guarani', 'Boca do Rio', 'Alto de Coutos', 'EAD'];
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
      ['Violão II','Pituba','João Silva'], ['Teoria Musical','EAD','Marina Oliveira'],
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
      ['Juliana Costa','juliana.costa@email.com','(71) 91198-8717','ICM Pituba','Senhora',0,'Teoria Musical','EAD'],
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

}
