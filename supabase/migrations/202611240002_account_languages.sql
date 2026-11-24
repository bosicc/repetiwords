ALTER TABLE vocpt.word_lists ADD COLUMN IF NOT EXISTS study_language text NOT NULL DEFAULT 'pt-PT' REFERENCES vocpt.study_languages;
CREATE TABLE IF NOT EXISTS vocpt.account_languages (
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  study_language text NOT NULL REFERENCES vocpt.study_languages,
  PRIMARY KEY (user_id, study_language)
);
CREATE TABLE IF NOT EXISTS vocpt.active_languages (
  user_id uuid PRIMARY KEY,
  study_language text NOT NULL,
  FOREIGN KEY (user_id, study_language) REFERENCES vocpt.account_languages ON DELETE CASCADE
);
INSERT INTO vocpt.account_languages SELECT id, 'pt-PT' FROM auth.users ON CONFLICT DO NOTHING;
ALTER TABLE vocpt.account_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocpt.active_languages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocpt.account_languages, vocpt.active_languages FROM PUBLIC;

-- Shared-list copies, guest claims, and first practice can enroll a learner
-- before they use the header selector.
CREATE OR REPLACE FUNCTION vocpt.enroll_study_language() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO vocpt.account_languages VALUES (NEW.user_id, NEW.study_language) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER enroll_session_course AFTER INSERT OR UPDATE OF user_id ON vocpt.sessions
  FOR EACH ROW EXECUTE FUNCTION vocpt.enroll_study_language();
CREATE OR REPLACE TRIGGER enroll_list_course AFTER INSERT ON vocpt.word_lists
  FOR EACH ROW EXECUTE FUNCTION vocpt.enroll_study_language();
