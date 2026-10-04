ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS support_message_hides (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,message_id)
);
CREATE TABLE IF NOT EXISTS support_conversation_hides (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  professor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cut_message_id INTEGER NOT NULL DEFAULT 0 CHECK(cut_message_id>=0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,professor_user_id)
);
ALTER TABLE support_message_hides ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_conversation_hides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE support_message_hides,support_conversation_hides FROM PUBLIC,anon,authenticated;
