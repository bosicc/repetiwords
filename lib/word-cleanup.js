import { isSingleWord, validateBatch } from './word-import.js';

export const archiveSchema = `
  CREATE TABLE IF NOT EXISTS archived_words (
    id INTEGER PRIMARY KEY,
    original_word_id INTEGER NOT NULL,
    record_json TEXT NOT NULL,
    archived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS archived_answers (
    id INTEGER PRIMARY KEY,
    original_answer_id INTEGER NOT NULL,
    archive_word_id INTEGER NOT NULL REFERENCES archived_words(id),
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    known INTEGER NOT NULL CHECK (known IN (0, 1)),
    revealed INTEGER NOT NULL CHECK (revealed IN (0, 1)),
    created_at TEXT NOT NULL
  );
`;

// The caller creates a SQLite backup before applying this explicit cleanup.
export function cleanVocabulary(db, input) {
  const batch = validateBatch(input);
  if (!Array.isArray(input.replacements)) throw new Error('Missing replacement plan');
  return db.transaction(() => {
    db.exec(archiveSchema);
    const invalid = db.prepare('SELECT * FROM words').all().filter((word) => !isSingleWord(word.portuguese));
    const replacements = new Map(input.replacements.map((row) => [row.id, row]));
    const batchWords = new Set(batch.words.map((word) => word.portuguese));
    for (const word of invalid) {
      const replacement = replacements.get(word.id);
      if (!replacement || replacement.portuguese !== word.portuguese ||
          !Array.isArray(replacement.components) || !replacement.components.length ||
          replacement.components.some((component) => !isSingleWord(component) || !batchWords.has(component))) {
        throw new Error(`Missing or stale replacement for ${word.portuguese}`);
      }
    }
    const result = { archived_records: 0, archived_answers: 0, added: 0, memberships_added: 0 };
    // Insert all components before archiving originals. Existing IDs and mastery stay intact.
    for (const word of batch.words) {
      let stored = db.prepare('SELECT id FROM words WHERE portuguese = ?').get(word.portuguese);
      if (!stored) {
        const inserted = db.prepare('INSERT INTO words (portuguese, english, ukrainian, level) VALUES (?, ?, ?, ?)')
          .run(word.portuguese, word.english, word.ukrainian, word.level);
        stored = { id: inserted.lastInsertRowid };
        result.added++;
      }
      for (const name of word.groups) {
        db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run(name);
        const group = db.prepare('SELECT id FROM groups WHERE name = ?').get(name);
        result.memberships_added += db.prepare('INSERT OR IGNORE INTO word_groups (word_id, group_id) VALUES (?, ?)').run(stored.id, group.id).changes;
      }
    }
    for (const word of invalid) {
      const groups = db.prepare('SELECT group_id FROM word_groups WHERE word_id = ?').all(word.id);
      const archived = db.prepare('INSERT INTO archived_words (original_word_id, record_json) VALUES (?, ?)')
        .run(word.id, JSON.stringify({ ...word, groups, components: replacements.get(word.id).components }));
      result.archived_answers += db.prepare(`INSERT INTO archived_answers
        (original_answer_id, archive_word_id, session_id, known, revealed, created_at)
        SELECT id, ?, session_id, known, revealed, created_at FROM answers WHERE word_id = ?`)
        .run(archived.lastInsertRowid, word.id).changes;
      db.prepare('DELETE FROM answers WHERE word_id = ?').run(word.id);
      db.prepare('DELETE FROM word_groups WHERE word_id = ?').run(word.id);
      db.prepare('DELETE FROM words WHERE id = ?').run(word.id);
      result.archived_records++;
    }
    result.words_remaining = db.prepare('SELECT COUNT(*) AS count FROM words').get().count;
    return result;
  }).immediate();
}
