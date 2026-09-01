CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id BIGSERIAL PRIMARY KEY,
  notification_type TEXT NOT NULL CHECK(notification_type IN ('attendance_reminder','weekly_manager_summary')),
  reference_key TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(notification_type,reference_key,recipient)
);

CREATE INDEX IF NOT EXISTS scheduled_notifications_status_idx
  ON scheduled_notifications(status,updated_at);

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE scheduled_notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE scheduled_notifications_id_seq FROM PUBLIC, anon, authenticated;
