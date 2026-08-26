-- Imagens de informativos são anexos independentes do conteúdo HTML.
-- O backend grava os dados validados e o cliente não acessa esta tabela diretamente.
CREATE TABLE IF NOT EXISTS announcement_attachments (
  id SERIAL PRIMARY KEY,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/heic', 'image/heif')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  data_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS announcement_attachments_announcement_id_idx ON announcement_attachments(announcement_id);

ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE announcement_attachments FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE announcement_attachments_id_seq FROM PUBLIC, anon, authenticated;
