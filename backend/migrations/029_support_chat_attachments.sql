-- Mensagens com anexos podem não ter legenda; a API exige texto ou arquivo.
ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_body_length_check;
ALTER TABLE support_messages ADD CONSTRAINT support_messages_body_length_check CHECK(char_length(body)<=4000);

CREATE TABLE IF NOT EXISTS support_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=20971520),
  voice_message INTEGER NOT NULL DEFAULT 0 CHECK(voice_message IN (0,1)),
  data_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((data_url IS NULL)<>(storage_path IS NULL))
);
CREATE INDEX IF NOT EXISTS support_attachments_message_idx ON support_attachments(message_id);
CREATE UNIQUE INDEX IF NOT EXISTS support_attachments_storage_idx ON support_attachments(storage_path) WHERE storage_path IS NOT NULL;
ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE support_attachments FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE support_attachments_id_seq FROM PUBLIC,anon,authenticated;
