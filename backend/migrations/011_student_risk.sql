CREATE TABLE IF NOT EXISTS student_contacts (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('contatado','sem_resposta','retorno_agendado','outro')),
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS student_contacts_student_date_idx ON student_contacts(student_id,contacted_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS student_contacts_user_id_idx ON student_contacts(user_id);

ALTER TABLE student_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE student_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE student_contacts_id_seq FROM PUBLIC, anon, authenticated;
