// SQLite is used only for development/tests; production uses migration 020.
export async function initializeStudentSchema(db) {
  if (db.dialect !== 'sqlite') return;
  const table = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!table.sql.includes("'aluno'")) {
    const indexes = await db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL").all();
    const columns = (await db.prepare('PRAGMA table_info(users)').all()).map(row => `"${row.name}"`).join(',');
    const definition = table.sql.replace(/CREATE TABLE\s+"?users"?/i, 'CREATE TABLE users_student_migration').replace("'gestor','professor'", "'gestor','professor','aluno'");
    if (!definition.includes("'aluno'")) throw new Error('Unsupported local users schema; student role migration aborted.');
    await db.exec('PRAGMA foreign_keys=OFF');
    try {
      await db.transaction(async () => {
        await db.exec(definition);
        await db.exec(`INSERT INTO users_student_migration (${columns}) SELECT ${columns} FROM users`);
        await db.exec('DROP TABLE users; ALTER TABLE users_student_migration RENAME TO users;');
        for (const index of indexes) await db.exec(index.sql);
        if ((await db.prepare('PRAGMA foreign_key_check').all()).length) throw new Error('Foreign key check failed during student role migration.');
      });
    } finally { await db.exec('PRAGMA foreign_keys=ON'); }
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS student_accounts (
      student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS student_invites (
      token_hash TEXT PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS student_invites_student_idx ON student_invites(student_id);
    CREATE INDEX IF NOT EXISTS student_invites_creator_idx ON student_invites(created_by);
    CREATE TABLE IF NOT EXISTS student_announcement_audiences (
      announcement_id INTEGER PRIMARY KEY REFERENCES announcements(id) ON DELETE CASCADE,
      all_students INTEGER NOT NULL DEFAULT 0 CHECK(all_students IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS student_announcement_classes (
      announcement_id INTEGER NOT NULL REFERENCES student_announcement_audiences(announcement_id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      PRIMARY KEY(announcement_id,class_id)
    );
    CREATE INDEX IF NOT EXISTS student_announcement_classes_class_idx ON student_announcement_classes(class_id,announcement_id);
    CREATE TABLE IF NOT EXISTS student_notice_deliveries (
      announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lease_until TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      finished INTEGER NOT NULL DEFAULT 0 CHECK(finished IN (0,1)),
      PRIMARY KEY(announcement_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS student_notice_deliveries_user_idx ON student_notice_deliveries(user_id);
    CREATE TABLE IF NOT EXISTS student_email_changes (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      old_email TEXT NOT NULL,
      new_email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS student_email_changes_user_idx ON student_email_changes(user_id);
    CREATE TABLE IF NOT EXISTS student_course_announcements (
      announcement_id INTEGER PRIMARY KEY REFERENCES announcements(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      requires_acknowledgement INTEGER NOT NULL DEFAULT 0 CHECK(requires_acknowledgement IN (0,1))
    );
    CREATE INDEX IF NOT EXISTS student_course_announcements_class_idx ON student_course_announcements(class_id,announcement_id);
  `);
  const courseAnnouncementColumns=await db.prepare('PRAGMA table_info(student_course_announcements)').all();
  if(!courseAnnouncementColumns.some(column=>column.name==='requires_acknowledgement')){
    await db.exec('ALTER TABLE student_course_announcements ADD COLUMN requires_acknowledgement INTEGER NOT NULL DEFAULT 0 CHECK(requires_acknowledgement IN (0,1))');
  }
  await db.exec('CREATE INDEX IF NOT EXISTS student_course_announcements_class_ack_idx ON student_course_announcements(class_id,requires_acknowledgement,announcement_id)');
}
