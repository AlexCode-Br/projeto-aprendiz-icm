ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
UPDATE sessions SET last_seen_at=created_at WHERE last_seen_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_last_seen_at_idx ON sessions(last_seen_at);

CREATE TABLE IF NOT EXISTS manager_login_challenges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  remember INTEGER NOT NULL DEFAULT 0 CHECK(remember IN (0,1)),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS manager_login_challenges_user_idx ON manager_login_challenges(user_id);
CREATE INDEX IF NOT EXISTS manager_login_challenges_expiry_idx ON manager_login_challenges(expires_at);

ALTER TABLE manager_login_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE manager_login_challenges,profile_photos FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE manager_login_challenges_id_seq,profile_photos_id_seq FROM PUBLIC,anon,authenticated;
