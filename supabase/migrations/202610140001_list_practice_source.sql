ALTER TABLE vocpt.sessions ADD COLUMN IF NOT EXISTS word_list_id INTEGER
  REFERENCES vocpt.word_lists(id) ON DELETE SET NULL;
