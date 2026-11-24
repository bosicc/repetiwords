CREATE TABLE IF NOT EXISTS vocpt.study_languages (
  code text PRIMARY KEY
);
INSERT INTO vocpt.study_languages VALUES ('pt-PT'), ('es-ES') ON CONFLICT DO NOTHING;

-- Keep the historical Portuguese importer and its unique key working.
-- Translated entries have their own identity, even when spellings coincide.
ALTER TABLE vocpt.words ALTER COLUMN portuguese DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS study_language text NOT NULL DEFAULT 'pt-PT' REFERENCES vocpt.study_languages,
  ADD COLUMN IF NOT EXISTS translated_term text,
  ADD COLUMN IF NOT EXISTS source_word_id integer REFERENCES vocpt.words;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='vocpt.words'::regclass AND conname='words_study_term_check') THEN
    ALTER TABLE vocpt.words ADD CONSTRAINT words_study_term_check CHECK (
      (study_language='pt-PT' AND portuguese IS NOT NULL AND translated_term IS NULL AND source_word_id IS NULL)
      OR (study_language<>'pt-PT' AND portuguese IS NULL AND translated_term IS NOT NULL AND btrim(translated_term)<>'')
    );
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS words_translation_source ON vocpt.words(study_language,source_word_id);
CREATE OR REPLACE VIEW vocpt.study_words AS
  SELECT id, coalesce(translated_term,portuguese) AS term, english, ukrainian, level, mastery_level, study_language
  FROM vocpt.words;
ALTER TABLE vocpt.sessions ADD COLUMN IF NOT EXISTS study_language text NOT NULL DEFAULT 'pt-PT' REFERENCES vocpt.study_languages;
CREATE INDEX IF NOT EXISTS sessions_study_language ON vocpt.sessions(study_language);
ALTER TABLE vocpt.study_languages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocpt.study_languages, vocpt.study_words FROM PUBLIC;
