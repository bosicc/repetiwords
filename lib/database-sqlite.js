import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateBatch } from './word-import.js';
import { archiveSchema } from './word-cleanup.js';
import { calculateProgress } from './progress.js';

export function createSqliteDatabase() {
  function getWordProgress() {
    return calculateProgress(
      db.prepare('SELECT id FROM words').all().map((word) => word.id),
      db.prepare('SELECT id, word_id, known, revealed, created_at FROM answers ORDER BY created_at, id').all(),
    );
  }

  const directory = process.env.VOCPT_DATA_DIR || join(process.cwd(), 'data');
  mkdirSync(directory, { recursive: true });
  const db = new Database(join(directory, 'vocabulary.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      email TEXT COLLATE NOCASE UNIQUE CHECK (email IS NULL OR length(trim(email)) > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY,
      portuguese TEXT NOT NULL UNIQUE,
      english TEXT NOT NULL,
      level TEXT CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
      ukrainian TEXT,
      mastery_level INTEGER NOT NULL DEFAULT 0
        CHECK (typeof(mastery_level) = 'integer' AND mastery_level BETWEEN 0 AND 5)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id),
      word_id INTEGER NOT NULL REFERENCES words(id),
      known INTEGER NOT NULL CHECK (known IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, word_id)
    );
  `);
  // Add missing fields to databases created by earlier versions without replacing words.
  db.transaction(() => {
    const answerColumns = new Set(db.prepare('PRAGMA table_info(answers)').all().map((column) => column.name));
    if (!answerColumns.has('revealed')) db.exec('ALTER TABLE answers ADD COLUMN revealed INTEGER NOT NULL DEFAULT 0 CHECK (revealed IN (0, 1))');
    const columns = new Set(db.prepare('PRAGMA table_info(words)').all().map((column) => column.name));
    for (const [name, definition] of [
      ['level', "TEXT CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))"],
      ['ukrainian', 'TEXT'],
      ['mastery_level', "INTEGER NOT NULL DEFAULT 0 CHECK (typeof(mastery_level) = 'integer' AND mastery_level BETWEEN 0 AND 5)"],
    ]) {
      if (!columns.has(name)) db.exec(`ALTER TABLE words ADD COLUMN ${name} ${definition}`);
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0)
      );
      CREATE TABLE IF NOT EXISTS word_groups (
        word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (word_id, group_id)
      );
      CREATE INDEX IF NOT EXISTS word_groups_group_id_idx ON word_groups(group_id);
    `);
  }).immediate();
  db.exec(archiveSchema);
  db.exec(`CREATE TABLE IF NOT EXISTS session_words (
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    word_id INTEGER NOT NULL REFERENCES words(id),
    position INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    PRIMARY KEY (session_id, word_id), UNIQUE(session_id, position)
  );`);

  function startPractice(count = 30) {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid word count');
    return db.transaction(() => {
      const candidates = db.prepare(`WITH answer_history AS (
        SELECT word_id, COUNT(*) AS attempts,
          SUM(CASE WHEN known = 1 AND revealed = 0 THEN 1 ELSE 0 END) AS correct,
          MAX(CASE WHEN known = 0 OR revealed = 1 THEN 1 ELSE 0 END) AS needs_review
        FROM answers GROUP BY word_id
      ), completed_history AS (
        SELECT sw.word_id, COUNT(*) AS completed,
          MAX(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END) AS skipped
        FROM session_words sw LEFT JOIN answers a
          ON a.session_id = sw.session_id AND a.word_id = sw.word_id
        WHERE sw.completed = 1 GROUP BY sw.word_id
      ) SELECT w.id, COALESCE(a.correct, 0) AS correct,
        COALESCE(a.attempts, 0) + COALESCE(c.completed, 0) AS history,
        MAX(COALESCE(a.needs_review, 0), COALESCE(c.skipped, 0)) AS needs_review
        FROM words w LEFT JOIN answer_history a ON a.word_id = w.id
        LEFT JOIN completed_history c ON c.word_id = w.id
        ORDER BY RANDOM()`).all();
      const pools = { practiced: [], new: [], review: [], learning: [] };
      for (const word of candidates) {
        const pool = word.correct >= 3 ? 'practiced' : word.history === 0 ? 'new' :
          word.needs_review ? 'review' : 'learning';
        pools[pool].push(word);
      }
      const words = [];
      const take = (pool, allocation) => words.push(...pools[pool].splice(0, allocation));
      const practicedCount = Math.floor(count * 0.1);
      const newCount = Math.floor(count * 0.4);
      take('practiced', practicedCount);
      take('new', newCount);
      take('review', count - words.length);
      // Fill shortages without repeating words, keeping review the first priority.
      for (const pool of ['review', 'new', 'practiced', 'learning']) take(pool, count - words.length);
      for (let index = words.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [words[index], words[other]] = [words[other], words[index]];
      }
      if (!words.length) throw new Error('No vocabulary available');
      const id = Number(db.prepare('INSERT INTO sessions DEFAULT VALUES').run().lastInsertRowid);
      const insertWord = db.prepare('INSERT INTO session_words (session_id, word_id, position) VALUES (?, ?, ?)');
      words.forEach((word, index) => insertWord.run(id, word.id, index));
      return id;
    }).immediate();
  }

  function getPractice(id) {
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const words = db.prepare(`SELECT w.*, sw.completed FROM session_words sw
      JOIN words w ON w.id = sw.word_id WHERE sw.session_id = ? ORDER BY sw.position`).all(id);
    if (!words.length) return null;
    const answers = db.prepare('SELECT word_id AS wordId, known, revealed FROM answers WHERE session_id = ? ORDER BY id').all(id)
      .map((answer) => ({ ...answer, known: Boolean(answer.known), revealed: Boolean(answer.revealed) }));
    return { words, answers, index: words.filter((word) => word.completed).length };
  }

  function recordPracticeAnswer(id, wordId, known, revealed) {
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(wordId) ||
        (known !== null && typeof known !== 'boolean') || typeof revealed !== 'boolean') throw new Error('Invalid answer');
    db.transaction(() => {
      const next = db.prepare('SELECT word_id FROM session_words WHERE session_id = ? AND completed = 0 ORDER BY position LIMIT 1').get(id);
      if (!next || next.word_id !== wordId) throw new Error('Word already answered or out of order');
      if (known !== null) db.prepare('INSERT INTO answers (session_id, word_id, known, revealed) VALUES (?, ?, ?, ?)')
        .run(id, wordId, Number(known), Number(revealed));
      db.prepare('UPDATE session_words SET completed = 1 WHERE session_id = ? AND word_id = ?').run(id, wordId);
    }).immediate();
  }
  const insert = db.prepare('INSERT OR IGNORE INTO words (portuguese, english) VALUES (?, ?)');
  db.transaction(() => {
    for (const [word, meaning] of [
      ['olá', 'hello'], ['obrigado', 'thank you'], ['favor', 'favor'],
      ['dia', 'day'], ['água', 'water'], ['pão', 'bread'],
      ['comboio', 'train'], ['autocarro', 'bus'], ['telemóvel', 'mobile phone'],
      ['pequeno-almoço', 'breakfast'], ['casa', 'house / home'], ['rua', 'street'],
    ]) insert.run(word, meaning);
  })();

  function importWords(input, { dryRun = false } = {}) {
    const batch = validateBatch(input);
    return db.transaction(() => {
      const result = { words: batch.words.length, added: 0, existing: 0, enriched: 0, groups_added: 0, memberships_added: 0, conflicts: [] };
      const groupIds = new Map(db.prepare('SELECT id, name FROM groups').all().map((group) => [group.name, group.id]));
      for (const word of batch.words) {
        const existing = db.prepare('SELECT * FROM words WHERE portuguese = ?').get(word.portuguese);
        let wordId = existing?.id;
        if (existing) {
          result.existing++;
          const fields = ['english', 'ukrainian', 'level'];
          const conflicts = fields.filter((field) => existing[field] != null && existing[field] !== word[field]);
          if (conflicts.length) result.conflicts.push({ portuguese: word.portuguese, fields: conflicts });
          if (existing.ukrainian == null || existing.level == null) {
            result.enriched++;
            if (!dryRun) db.prepare('UPDATE words SET ukrainian = COALESCE(ukrainian, ?), level = COALESCE(level, ?) WHERE id = ?')
              .run(word.ukrainian, word.level, wordId);
          }
        } else {
          result.added++;
          if (!dryRun) wordId = db.prepare('INSERT INTO words (portuguese, english, ukrainian, level) VALUES (?, ?, ?, ?)')
            .run(word.portuguese, word.english, word.ukrainian, word.level).lastInsertRowid;
        }
        for (const group of word.groups) {
          if (!groupIds.has(group)) {
            result.groups_added++;
            groupIds.set(group, dryRun ? null : db.prepare('INSERT INTO groups (name) VALUES (?)').run(group).lastInsertRowid);
          }
          const groupId = groupIds.get(group);
          const linked = wordId != null && groupId != null && db.prepare('SELECT 1 FROM word_groups WHERE word_id = ? AND group_id = ?').get(wordId, groupId);
          if (!linked) {
            result.memberships_added++;
            if (!dryRun) db.prepare('INSERT INTO word_groups (word_id, group_id) VALUES (?, ?)').run(wordId, groupId);
          }
        }
      }
      return result;
    })();
  }

  function createUser(name, email = null) {
    if (typeof name !== 'string' || !name.trim() ||
        (email !== null && (typeof email !== 'string' || !email.trim()))) {
      throw new Error('Invalid user details');
    }
    const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
      .run(name.trim(), email === null ? null : email.trim());
    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  function getUsers() {
    return db.prepare('SELECT * FROM users ORDER BY id').all();
  }

  function getWords() {
    return db.prepare(`SELECT w.*, COUNT(a.id) AS attempts,
      COALESCE(SUM(CASE WHEN a.known = 0 THEN 1 WHEN a.revealed = 1 THEN 0.5 ELSE 0 END), 0) AS mistakes
      FROM words w LEFT JOIN answers a ON a.word_id = w.id
      GROUP BY w.id ORDER BY RANDOM()`).all();
  }

  function getVocabulary() {
    const words = db.prepare('SELECT * FROM words ORDER BY portuguese COLLATE NOCASE, id').all();
    const memberships = db.prepare(`SELECT wg.word_id, g.name FROM word_groups wg
      JOIN groups g ON g.id = wg.group_id ORDER BY g.name`).all();
    const categories = new Map();
    for (const membership of memberships) {
      if (!categories.has(membership.word_id)) categories.set(membership.word_id, []);
      categories.get(membership.word_id).push(membership.name);
    }
    return words.map((word) => ({ ...word, categories: categories.get(word.id) || [] }));
  }

  function getStatistics() {
    return db.prepare(`SELECT COUNT(*) AS answers,
      COALESCE(SUM(known), 0) AS known,
      COALESCE(SUM(1 - known * (1 - 0.5 * revealed)), 0) AS mistakes FROM (
        SELECT known, revealed FROM answers
        UNION ALL SELECT known, revealed FROM archived_answers
      )`).get();
  }

  function getSessionHistory(limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid session history limit');
    return db.transaction(() => {
      const sessions = db.prepare(`WITH answer_totals AS (
        SELECT session_id, COUNT(*) AS total FROM (
          SELECT session_id FROM answers
          UNION ALL SELECT session_id FROM archived_answers
        ) GROUP BY session_id
      ), practice_totals AS (
        SELECT session_id, COUNT(*) AS total, SUM(completed) AS completed
        FROM session_words GROUP BY session_id
      ) SELECT s.id, s.created_at AS createdAt,
        COALESCE(p.total, a.total) AS total,
        COALESCE(p.completed, a.total) AS completed
        FROM sessions s
        LEFT JOIN answer_totals a ON a.session_id = s.id
        LEFT JOIN practice_totals p ON p.session_id = s.id
        WHERE COALESCE(a.total, 0) > 0 OR COALESCE(p.completed, 0) > 0
        ORDER BY s.created_at DESC, s.id DESC LIMIT ?`).all(limit).reverse();
      if (!sessions.length) return [];

      const placeholders = sessions.map(() => '?').join(', ');
      const ids = sessions.map((session) => session.id);
      const answered = db.prepare(`SELECT a.session_id AS sessionId, a.id AS answerId,
        a.word_id AS wordId, a.known, a.revealed, w.portuguese, w.english, w.ukrainian,
        NULL AS recordJson FROM answers a JOIN words w ON w.id = a.word_id
        WHERE a.session_id IN (${placeholders})
        UNION ALL
        SELECT a.session_id, a.original_answer_id, w.original_word_id, a.known, a.revealed,
        NULL, NULL, NULL, w.record_json
        FROM archived_answers a JOIN archived_words w ON w.id = a.archive_word_id
        WHERE a.session_id IN (${placeholders})
        ORDER BY sessionId, answerId`).all(...ids, ...ids);
      const planned = db.prepare(`SELECT sw.session_id AS sessionId, sw.word_id AS wordId,
        sw.position, sw.completed, w.portuguese, w.english, w.ukrainian
        FROM session_words sw JOIN words w ON w.id = sw.word_id
        WHERE sw.session_id IN (${placeholders}) ORDER BY sw.session_id, sw.position`).all(...ids);

      return sessions.map((session) => {
        const words = planned.filter((word) => word.sessionId === session.id);
        const positions = new Map(words.map((word) => [word.wordId, word.position]));
        const answers = answered.filter((answer) => answer.sessionId === session.id);
        const answerWordIds = new Set(answers.map((answer) => answer.wordId));
        const segments = answers.map((answer) => {
          let word = answer;
          if (answer.recordJson !== null) {
            try { word = JSON.parse(answer.recordJson); }
            catch { word = {}; }
          }
          return {
            wordId: answer.wordId,
            portuguese: word?.portuguese || `#${answer.wordId}`,
            english: word?.english || '',
            ukrainian: word?.ukrainian || null,
            outcome: !answer.known ? 'mistakes' : answer.revealed ? 'helped' : 'independent',
            position: positions.get(answer.wordId) ?? answer.answerId,
          };
        });
        for (const word of words) {
          if (word.completed && !answerWordIds.has(word.wordId)) segments.push({
            wordId: word.wordId,
            portuguese: word.portuguese,
            english: word.english,
            ukrainian: word.ukrainian,
            outcome: 'skipped',
            position: word.position,
          });
        }
        segments.sort((a, b) => a.position - b.position);
        const counts = { independent: 0, helped: 0, mistakes: 0, skipped: 0 };
        for (const segment of segments) counts[segment.outcome]++;
        return {
          ...session,
          ...counts,
          segments: segments.map(({ position, ...segment }) => segment),
        };
      });
    })();
  }

  function saveSession(answers) {
    const wordIds = new Set(getWords().map((word) => word.id));
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > wordIds.size ||
        new Set(answers.map((answer) => answer.wordId)).size !== answers.length ||
        answers.some((answer) => !wordIds.has(answer.wordId) || typeof answer.known !== 'boolean' ||
          (answer.revealed !== undefined && typeof answer.revealed !== 'boolean'))) {
      throw new Error('Invalid session answers');
    }
    return db.transaction(() => {
      const session = db.prepare('INSERT INTO sessions DEFAULT VALUES').run();
      const save = db.prepare('INSERT INTO answers (session_id, word_id, known, revealed) VALUES (?, ?, ?, ?)');
      for (const answer of answers) save.run(session.lastInsertRowid, answer.wordId, Number(answer.known), Number(answer.revealed ?? false));
      return Number(session.lastInsertRowid);
    })();
  }

  return { getWordProgress, startPractice, getPractice, recordPracticeAnswer, importWords, createUser, getUsers, getWords, getVocabulary, getStatistics, getSessionHistory, saveSession };
}
