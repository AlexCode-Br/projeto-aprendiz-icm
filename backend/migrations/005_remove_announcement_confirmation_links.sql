ALTER TABLE announcements
  DROP COLUMN IF EXISTS requires_confirmation,
  DROP COLUMN IF EXISTS action_url,
  DROP COLUMN IF EXISTS action_label;

ALTER TABLE announcement_reads
  DROP COLUMN IF EXISTS confirmed;
