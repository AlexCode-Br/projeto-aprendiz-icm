CREATE INDEX IF NOT EXISTS enrollments_recent_active_idx
  ON enrollments(enrolled_at DESC,id DESC)
  WHERE status='ativa';
