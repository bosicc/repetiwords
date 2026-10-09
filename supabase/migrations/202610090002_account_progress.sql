-- Legacy sessions remain unassigned until explicitly transferred to their owner.
ALTER TABLE vocpt.sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON vocpt.sessions(user_id);

-- Record a one-time transfer of legacy progress, explicitly configured by its owner.
CREATE TABLE IF NOT EXISTS vocpt.legacy_progress_claims (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
);
ALTER TABLE vocpt.legacy_progress_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocpt.legacy_progress_claims FROM PUBLIC;
