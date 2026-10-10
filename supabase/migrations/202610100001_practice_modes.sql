-- Existing sessions retain their original self-assessment behavior.
ALTER TABLE vocpt.sessions ADD COLUMN IF NOT EXISTS practice_mode TEXT NOT NULL
  DEFAULT 'self-assessment'
  CONSTRAINT sessions_practice_mode_check
  CHECK (practice_mode IN ('self-assessment', 'multiple-choice', 'matching'));
