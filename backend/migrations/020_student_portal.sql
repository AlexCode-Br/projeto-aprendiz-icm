-- Explicit account ownership. Legacy announcements remain staff-only.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('gestor','professor','aluno'));
CREATE TABLE student_accounts (
  student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE student_invites (
  token_hash TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX student_invites_student_idx ON student_invites(student_id);
CREATE INDEX student_invites_creator_idx ON student_invites(created_by);
CREATE TABLE student_announcement_audiences (
  announcement_id INTEGER PRIMARY KEY REFERENCES announcements(id) ON DELETE CASCADE,
  all_students INTEGER NOT NULL DEFAULT 0 CHECK(all_students IN (0,1))
);
CREATE TABLE student_announcement_classes (
  announcement_id INTEGER NOT NULL REFERENCES student_announcement_audiences(announcement_id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  PRIMARY KEY(announcement_id,class_id)
);
CREATE INDEX student_announcement_classes_class_idx ON student_announcement_classes(class_id,announcement_id);
ALTER TABLE student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_announcement_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_announcement_classes ENABLE ROW LEVEL SECURITY;
-- Access is through the authenticated API, never the browser's Data API.
REVOKE ALL ON student_accounts,student_invites,student_announcement_audiences,student_announcement_classes FROM PUBLIC,anon,authenticated;
CREATE TABLE student_notice_deliveries (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lease_until TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  finished INTEGER NOT NULL DEFAULT 0 CHECK(finished IN (0,1)),
  PRIMARY KEY(announcement_id,user_id)
);
CREATE INDEX student_notice_deliveries_user_idx ON student_notice_deliveries(user_id);
ALTER TABLE student_notice_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON student_notice_deliveries FROM PUBLIC,anon,authenticated;
CREATE TABLE student_email_changes (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX student_email_changes_user_idx ON student_email_changes(user_id);
ALTER TABLE student_email_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON student_email_changes FROM PUBLIC,anon,authenticated;
CREATE TABLE student_course_announcements (
  announcement_id INTEGER PRIMARY KEY REFERENCES announcements(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE
);
CREATE INDEX student_course_announcements_class_idx ON student_course_announcements(class_id,announcement_id);
ALTER TABLE student_course_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON student_course_announcements FROM PUBLIC,anon,authenticated;
