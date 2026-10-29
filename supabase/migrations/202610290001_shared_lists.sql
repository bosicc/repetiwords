CREATE TABLE IF NOT EXISTS vocpt.list_shares (
  list_id INTEGER PRIMARY KEY REFERENCES vocpt.word_lists(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
ALTER TABLE vocpt.word_lists ADD COLUMN IF NOT EXISTS copied_from_list_id INTEGER
  REFERENCES vocpt.word_lists(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS word_lists_saved_source_idx
  ON vocpt.word_lists(user_id, copied_from_list_id) WHERE copied_from_list_id IS NOT NULL;

-- Guests never write into account sessions/answers. Only the browser holding
-- the guest secret can resume or transfer a temporary session.
CREATE TABLE IF NOT EXISTS vocpt.shared_practices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_hash TEXT,
  expires_at TIMESTAMP WITHOUT TIME ZONE,
  account_session_id INTEGER REFERENCES vocpt.sessions(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL,
  list_name TEXT NOT NULL,
  state JSONB NOT NULL,
  CHECK ((user_id IS NULL AND guest_hash IS NOT NULL AND expires_at IS NOT NULL AND account_session_id IS NULL)
    OR (user_id IS NOT NULL AND guest_hash IS NULL AND expires_at IS NULL AND account_session_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS shared_practices_expiry_idx ON vocpt.shared_practices(expires_at) WHERE user_id IS NULL;
ALTER TABLE vocpt.list_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocpt.shared_practices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocpt.list_shares, vocpt.shared_practices FROM PUBLIC;
