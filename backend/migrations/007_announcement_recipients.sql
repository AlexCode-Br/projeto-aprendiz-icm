-- Destinatários opcionais dos informativos. A ausência de linhas significa "todos".
CREATE TABLE IF NOT EXISTS announcement_recipients (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('professor', 'curso')),
  recipient_id INTEGER NOT NULL,
  PRIMARY KEY (announcement_id, recipient_type, recipient_id)
);
CREATE INDEX IF NOT EXISTS announcement_recipients_lookup_idx
  ON announcement_recipients(recipient_type, recipient_id, announcement_id);

ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE announcement_recipients FROM PUBLIC, anon, authenticated;
