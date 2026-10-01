CREATE TABLE IF NOT EXISTS notification_outbox (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  destination TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  notification_tag TEXT NOT NULL,
  email_enabled INTEGER NOT NULL DEFAULT 0 CHECK(email_enabled IN (0,1)),
  push_enabled INTEGER NOT NULL DEFAULT 1 CHECK(push_enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON notification_outbox(status,available_at,id);
CREATE INDEX IF NOT EXISTS notification_outbox_lease_idx
  ON notification_outbox(status,lease_until) WHERE status='processing';
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE notification_outbox FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE notification_outbox_id_seq FROM PUBLIC,anon,authenticated;
