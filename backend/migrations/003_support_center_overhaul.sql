ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Outro';

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_tickets_category_check'
      AND conrelid = 'support_tickets'::regclass
  ) THEN
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_category_check
      CHECK (category IN ('Acesso ao sistema','Alunos','Turmas','Frequência','Cursos','Relatórios','Outro'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_messages_body_length_check'
      AND conrelid = 'support_messages'::regclass
  ) THEN
    ALTER TABLE support_messages
      ADD CONSTRAINT support_messages_body_length_check
      CHECK (char_length(btrim(body)) BETWEEN 2 AND 4000) NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS support_messages_author_client_message_unique
  ON support_messages(author_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_messages_ticket_activity_idx
  ON support_messages(ticket_id, created_at, id);

CREATE TABLE IF NOT EXISTS support_ticket_reads (
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id INTEGER REFERENCES support_messages(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(ticket_id, user_id)
);
CREATE INDEX IF NOT EXISTS support_ticket_reads_user_id_idx
  ON support_ticket_reads(user_id);

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('status_changed')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_activity_idx
  ON support_ticket_events(ticket_id, created_at, id);
CREATE INDEX IF NOT EXISTS support_ticket_events_actor_user_id_idx
  ON support_ticket_events(actor_user_id);

REVOKE ALL PRIVILEGES ON TABLE support_ticket_reads FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE support_ticket_events FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE support_ticket_events_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE support_ticket_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;
