-- Evolui anexos para arquivos privados (imagens e PDFs) sem invalidar imagens
-- antigas que ainda estejam persistidas como data URL.
ALTER TABLE announcement_attachments
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE announcement_attachments
  ALTER COLUMN data_url DROP NOT NULL;

ALTER TABLE announcement_attachments
  DROP CONSTRAINT IF EXISTS announcement_attachments_mime_type_check,
  DROP CONSTRAINT IF EXISTS announcement_attachments_size_bytes_check;

ALTER TABLE announcement_attachments
  ADD CONSTRAINT announcement_attachments_mime_type_check
    CHECK (mime_type IN (
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    )),
  ADD CONSTRAINT announcement_attachments_size_bytes_check
    CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  ADD CONSTRAINT announcement_attachments_content_check
    CHECK (data_url IS NOT NULL OR storage_path IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS announcement_attachments_storage_path_unique
  ON announcement_attachments(storage_path)
  WHERE storage_path IS NOT NULL;

ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE announcement_attachments FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE announcement_attachments_id_seq FROM PUBLIC, anon, authenticated;
