CREATE TABLE IF NOT EXISTS manager_login_devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,token_hash)
);
CREATE INDEX IF NOT EXISTS manager_login_devices_expiry_idx ON manager_login_devices(expires_at);
ALTER TABLE manager_login_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE manager_login_devices FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE manager_login_devices_id_seq FROM PUBLIC,anon,authenticated;
