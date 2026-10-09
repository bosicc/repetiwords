import { createQueryAdapter } from './postgres.js';
import { validateBatch } from './word-import.js';
import { calculateProgress } from './progress.js';

export function createPostgresDatabase(pool) {
  const db = createQueryAdapter(pool);

  async function getWordProgress() {
    return db.transaction(async () => calculateProgress(
      (await db.all('SELECT id FROM vocpt.words')).map((word) => word.id),
      (await db.all('SELECT id, word_id, known, revealed, created_at FROM vocpt.answers ORDER BY created_at, id')),
    ), { snapshot: true })();
  }

  async function startPractice(count = 30) {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid word count');
    return db.transaction(async () => {
      const candidates = (await db.all(`WITH answer_history AS (
        SELECT word_id, COUNT(*) AS attempts,
          SUM(CASE WHEN known = 1 AND revealed = 0 THEN 1 ELSE 0 END) AS correct,
          MAX(CASE WHEN known = 0 OR revealed = 1 THEN 1 ELSE 0 END) AS needs_review
        FROM vocpt.answers GROUP BY word_id
      ), completed_history AS (
        SELECT sw.word_id, COUNT(*) AS completed,
          MAX(CASE WHEN a.id IS NULL THEN 1 ELSE 0 END) AS skipped
        FROM vocpt.session_words sw LEFT JOIN vocpt.answers a
          ON a.session_id = sw.session_id AND a.word_id = sw.word_id
        WHERE sw.completed = 1 GROUP BY sw.word_id
      ) SELECT w.id, COALESCE(a.correct, 0) AS correct,
        COALESCE(a.attempts, 0) + COALESCE(c.completed, 0) AS history,
        GREATEST(COALESCE(a.needs_review, 0), COALESCE(c.skipped, 0)) AS needs_review
        FROM vocpt.words w LEFT JOIN answer_history a ON a.word_id = w.id
        LEFT JOIN completed_history c ON c.word_id = w.id
        ORDER BY RANDOM()`));
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
      const id = Number((await db.run('INSERT INTO vocpt.sessions DEFAULT VALUES RETURNING id')).lastInsertRowid);
      for (let index = 0; index < words.length; index++) {
        await db.run('INSERT INTO vocpt.session_words (session_id, word_id, position) VALUES (?, ?, ?)', id, words[index].id, index);
      }
      return id;
    })();
  }

  async function getPractice(id) {
    if (!Number.isSafeInteger(id) || id < 1) return null;
    return db.transaction(async () => {
      const words = (await db.all(`SELECT w.*, sw.completed FROM vocpt.session_words sw
        JOIN vocpt.words w ON w.id = sw.word_id WHERE sw.session_id = ? ORDER BY sw.position`, id));
      if (!words.length) return null;
      const answers = (await db.all('SELECT word_id AS "wordId", known, revealed FROM vocpt.answers WHERE session_id = ? ORDER BY id', id))
        .map((answer) => ({ ...answer, known: Boolean(answer.known), revealed: Boolean(answer.revealed) }));
      return { words, answers, index: words.filter((word) => word.completed).length };
    }, { snapshot: true })();
  }
  async function recordPracticeAnswer(id, wordId, known, revealed) {
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(wordId) ||
        (known !== null && typeof known !== 'boolean') || typeof revealed !== 'boolean') throw new Error('Invalid answer');
    return db.transaction(async () => {
      await db.get('SELECT id FROM vocpt.sessions WHERE id = ? FOR UPDATE', id);
      const next = (await db.get('SELECT word_id FROM vocpt.session_words WHERE session_id = ? AND completed = 0 ORDER BY position LIMIT 1', id));
      if (!next || next.word_id !== wordId) throw new Error('Word already answered or out of order');
      if (known !== null) (await db.run('INSERT INTO vocpt.answers (session_id, word_id, known, revealed) VALUES (?, ?, ?, ?)', id, wordId, Number(known), Number(revealed)));
      (await db.run('UPDATE vocpt.session_words SET completed = 1 WHERE session_id = ? AND word_id = ?', id, wordId));
    })();
  }
  async function importWords(input, { dryRun = false } = {}) {
    const batch = validateBatch(input);
    return db.transaction(async () => {
      await db.run('LOCK TABLE vocpt.words, vocpt.groups, vocpt.word_groups IN SHARE ROW EXCLUSIVE MODE');
      const result = { words: batch.words.length, added: 0, existing: 0, enriched: 0, groups_added: 0, memberships_added: 0, conflicts: [] };
      const groupIds = new Map((await db.all('SELECT id, name FROM vocpt.groups')).map((group) => [group.name, group.id]));
      for (const word of batch.words) {
        const existing = (await db.get('SELECT * FROM vocpt.words WHERE portuguese = ?', word.portuguese));
        let wordId = existing?.id;
        if (existing) {
          result.existing++;
          const fields = ['english', 'ukrainian', 'level'];
          const conflicts = fields.filter((field) => existing[field] != null && existing[field] !== word[field]);
          if (conflicts.length) result.conflicts.push({ portuguese: word.portuguese, fields: conflicts });
          if (existing.ukrainian == null || existing.level == null) {
            result.enriched++;
            if (!dryRun) (await db.run('UPDATE vocpt.words SET ukrainian = COALESCE(ukrainian, ?), level = COALESCE(level, ?) WHERE id = ?', word.ukrainian, word.level, wordId));
          }
        } else {
          result.added++;
          if (!dryRun) wordId = (await db.run('INSERT INTO vocpt.words (portuguese, english, ukrainian, level) VALUES (?, ?, ?, ?) RETURNING id', word.portuguese, word.english, word.ukrainian, word.level)).lastInsertRowid;
        }
        for (const group of word.groups) {
          if (!groupIds.has(group)) {
            result.groups_added++;
            groupIds.set(group, dryRun ? null : (await db.run('INSERT INTO vocpt.groups (name) VALUES (?) RETURNING id', group)).lastInsertRowid);
          }
          const groupId = groupIds.get(group);
          const linked = wordId != null && groupId != null && (await db.get('SELECT 1 FROM vocpt.word_groups WHERE word_id = ? AND group_id = ?', wordId, groupId));
          if (!linked) {
            result.memberships_added++;
            if (!dryRun) (await db.run('INSERT INTO vocpt.word_groups (word_id, group_id) VALUES (?, ?)', wordId, groupId));
          }
        }
      }
      return result;
    })();
  }

  async function createUser(name, email = null) {
    if (typeof name !== 'string' || !name.trim() ||
        (email !== null && (typeof email !== 'string' || !email.trim()))) {
      throw new Error('Invalid user details');
    }
    const result = (await db.run('INSERT INTO vocpt.users (name, email) VALUES (?, ?) RETURNING id', name.trim(), email === null ? null : email.trim()));
    return (await db.get('SELECT * FROM vocpt.users WHERE id = ?', result.lastInsertRowid));
  }

  async function getUsers() {
    return (await db.all('SELECT * FROM vocpt.users ORDER BY id'));
  }

  async function getWords() {
    return (await db.all(`SELECT w.*, COUNT(a.id) AS attempts,
      COALESCE(SUM(CASE WHEN a.known = 0 THEN 1 WHEN a.revealed = 1 THEN 0.5 ELSE 0 END), 0) AS mistakes
      FROM vocpt.words w LEFT JOIN vocpt.answers a ON a.word_id = w.id
      GROUP BY w.id ORDER BY RANDOM()`));
  }

  async function getVocabulary() {
    const words = (await db.all('SELECT * FROM vocpt.words ORDER BY lower(portuguese), id'));
    const memberships = (await db.all(`SELECT wg.word_id, g.name FROM vocpt.word_groups wg
      JOIN vocpt.groups g ON g.id = wg.group_id ORDER BY g.name`));
    const categories = new Map();
    for (const membership of memberships) {
      if (!categories.has(membership.word_id)) categories.set(membership.word_id, []);
      categories.get(membership.word_id).push(membership.name);
    }
    return words.map((word) => ({ ...word, categories: categories.get(word.id) || [] }));
  }

  async function getStatistics() {
    return (await db.get(`SELECT COUNT(*) AS answers,
      COALESCE(SUM(known), 0) AS known,
      COALESCE(SUM(1 - known * (1 - 0.5 * revealed)), 0) AS mistakes FROM (
        SELECT known, revealed FROM vocpt.answers
        UNION ALL SELECT known, revealed FROM vocpt.archived_answers
      ) AS history`));
  }

  async function getSessionHistory(limit = 20) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid session history limit');
    return db.transaction(async () => {
      const sessions = (await db.all(`WITH answer_totals AS (
        SELECT session_id, COUNT(*) AS total FROM (
          SELECT session_id FROM vocpt.answers
          UNION ALL SELECT session_id FROM vocpt.archived_answers
        ) AS combined GROUP BY session_id
      ), practice_totals AS (
        SELECT session_id, COUNT(*) AS total, SUM(completed) AS completed
        FROM vocpt.session_words GROUP BY session_id
      ) SELECT s.id, s.created_at AS "createdAt",
        COALESCE(p.total, a.total) AS total,
        COALESCE(p.completed, a.total) AS completed
        FROM vocpt.sessions s
        LEFT JOIN answer_totals a ON a.session_id = s.id
        LEFT JOIN practice_totals p ON p.session_id = s.id
        WHERE COALESCE(a.total, 0) > 0 OR COALESCE(p.completed, 0) > 0
        ORDER BY s.created_at DESC, s.id DESC LIMIT ?`, limit)).reverse();
      if (!sessions.length) return [];

      const placeholders = sessions.map(() => '?').join(', ');
      const ids = sessions.map((session) => session.id);
      const answered = (await db.all(`SELECT a.session_id AS "sessionId", a.id AS "answerId",
        a.word_id AS "wordId", a.known, a.revealed, w.portuguese, w.english, w.ukrainian,
        NULL AS "recordJson" FROM vocpt.answers a JOIN vocpt.words w ON w.id = a.word_id
        WHERE a.session_id IN (${placeholders})
        UNION ALL
        SELECT a.session_id, a.original_answer_id, w.original_word_id, a.known, a.revealed,
        NULL, NULL, NULL, w.record_json
        FROM vocpt.archived_answers a JOIN vocpt.archived_words w ON w.id = a.archive_word_id
        WHERE a.session_id IN (${placeholders})
        ORDER BY "sessionId", "answerId"`, ...ids, ...ids));
      const planned = (await db.all(`SELECT sw.session_id AS "sessionId", sw.word_id AS "wordId",
        sw.position, sw.completed, w.portuguese, w.english, w.ukrainian
        FROM vocpt.session_words sw JOIN vocpt.words w ON w.id = sw.word_id
        WHERE sw.session_id IN (${placeholders}) ORDER BY sw.session_id, sw.position`, ...ids));

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
    }, { snapshot: true })();
  }

  async function saveSession(answers) {
    const wordIds = new Set((await getWords()).map((word) => word.id));
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > wordIds.size ||
        new Set(answers.map((answer) => answer.wordId)).size !== answers.length ||
        answers.some((answer) => !wordIds.has(answer.wordId) || typeof answer.known !== 'boolean' ||
          (answer.revealed !== undefined && typeof answer.revealed !== 'boolean'))) {
      throw new Error('Invalid session answers');
    }
    return db.transaction(async () => {
      const session = (await db.run('INSERT INTO vocpt.sessions DEFAULT VALUES RETURNING id'));
      for (const answer of answers) await db.run('INSERT INTO vocpt.answers (session_id, word_id, known, revealed) VALUES (?, ?, ?, ?)', session.lastInsertRowid, answer.wordId, Number(answer.known), Number(answer.revealed ?? false));
      return Number(session.lastInsertRowid);
    })();
  }

  return { getWordProgress, startPractice, getPractice, recordPracticeAnswer, importWords, createUser, getUsers, getWords, getVocabulary, getStatistics, getSessionHistory, saveSession };
}
