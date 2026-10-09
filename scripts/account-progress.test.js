import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase } from '../lib/database-postgres.js';

const firstUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const freshUser = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const progressMigration = readFileSync(new URL('../supabase/migrations/202610090002_account_progress.sql', import.meta.url), 'utf8');

function testPool(engine) {
  async function query(sql, values = []) {
    const result = await engine.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows };
  }
  return { query, async connect() { return { query, release() {} }; } };
}

async function setup(engine) {
  await engine.exec(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${firstUser}'), ('${secondUser}'), ('${freshUser}');`);
  await engine.exec(readFileSync(new URL('../supabase/migrations/202610090001_vocabulary.sql', import.meta.url), 'utf8'));
  await engine.exec(progressMigration);
  await engine.exec(`INSERT INTO vocpt.words (id, portuguese, english) VALUES
      (1, 'gato', 'cat'), (2, 'cão', 'dog'), (3, 'casa', 'house'), (4, 'livro', 'book');
    INSERT INTO vocpt.sessions (id, user_id, created_at) VALUES
      (1, '${firstUser}', '2020-01-01 10:00:00'),
      (2, '${firstUser}', '2020-01-02 10:00:00'),
      (3, '${firstUser}', '2020-01-03 10:00:00'),
      (4, '${secondUser}', '2020-01-04 10:00:00'),
      (5, NULL, '2020-01-05 10:00:00');
    SELECT setval(pg_get_serial_sequence('vocpt.sessions', 'id'), 5);
    INSERT INTO vocpt.answers (session_id, word_id, known, revealed, created_at) VALUES
      (1, 1, 1, 0, '2020-01-01 10:00:00'),
      (2, 1, 1, 0, '2020-01-02 10:00:00'),
      (3, 1, 1, 0, '2020-01-03 10:00:00'),
      (4, 1, 0, 0, '2020-01-04 10:00:00'),
      (5, 3, 1, 0, '2020-01-05 10:00:00');
    INSERT INTO vocpt.archived_words (id, original_word_id, record_json) VALUES
      (1, 91, '{"portuguese":"boa tarde","english":"good afternoon"}'),
      (2, 92, '{"portuguese":"bom dia","english":"good morning"}'),
      (3, 93, '{"portuguese":"boa noite","english":"good evening"}');
    INSERT INTO vocpt.archived_answers (original_answer_id, archive_word_id, session_id, known, revealed, created_at) VALUES
      (91, 1, 3, 0, 0, '2020-01-03 10:00:00'),
      (92, 2, 4, 1, 1, '2020-01-04 10:00:00'),
      (93, 3, 5, 0, 0, '2020-01-05 10:00:00');
    INSERT INTO vocpt.session_words (session_id, word_id, position, completed) VALUES
      (3, 1, 0, 1), (3, 2, 1, 0),
      (4, 1, 0, 1), (4, 2, 1, 0),
      (5, 3, 0, 1), (5, 4, 1, 0);`);
}

test('account progress isolates statistics, mastery, word attempts, and archived session history', async () => {
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  try {
    await setup(engine);
    const pool = testPool(engine);
    const first = createPostgresDatabase(pool, { userId: firstUser });
    const second = createPostgresDatabase(pool, { userId: secondUser });
    const fresh = createPostgresDatabase(pool, { userId: freshUser });
    assert.deepEqual(await first.getStatistics(), { answers: 4, known: 3, mistakes: 1 });
    assert.deepEqual(await second.getStatistics(), { answers: 2, known: 1, mistakes: 1.5 });
    assert.deepEqual(await fresh.getStatistics(), { answers: 0, known: 0, mistakes: 0 });
    for (const [account, expected] of [[first, { total: 4, new: 3, learning: 0, mastered: 1 }], [second, { total: 4, new: 3, learning: 1, mastered: 0 }], [fresh, { total: 4, new: 4, learning: 0, mastered: 0 }]]) {
      const { history, ...progress } = await account.getWordProgress();
      assert.deepEqual(progress, expected);
      assert.equal(history.length, 14);
      assert.ok(history.every((day) => day.mastered === expected.mastered));
    }
    const firstHistory = await first.getSessionHistory();
    const secondHistory = await second.getSessionHistory();
    assert.deepEqual(firstHistory.map((session) => session.id), [1, 2, 3]);
    assert.deepEqual((await first.getSessionHistory(1)).map((session) => session.id), [3]);
    assert.deepEqual(secondHistory.map((session) => session.id), [4]);
    assert.deepEqual(await fresh.getSessionHistory(), []);
    assert.deepEqual(firstHistory[2].segments.map((segment) => [segment.wordId, segment.portuguese, segment.outcome]), [[1, 'gato', 'independent'], [91, 'boa tarde', 'mistakes']]);
    assert.deepEqual(secondHistory[0].segments.map((segment) => [segment.wordId, segment.portuguese, segment.outcome]), [[1, 'gato', 'mistakes'], [92, 'bom dia', 'helped']]);
    const word = (rows, id) => rows.find((entry) => entry.id === id);
    assert.equal(word(await first.getWords(), 1).attempts, 3);
    assert.equal(word(await first.getWords(), 1).mistakes, 0);
    assert.equal(word(await second.getWords(), 1).attempts, 1);
    assert.equal(word(await second.getWords(), 1).mistakes, 1);
    assert.ok((await fresh.getWords()).every((entry) => entry.attempts === 0 && entry.mistakes === 0));
    assert.equal(word(await first.getWords(), 3).attempts, 0);
    assert.deepEqual(await first.getVocabulary(), await second.getVocabulary());
    assert.equal((await fresh.getVocabulary()).length, 4);
    // Reapplying the migration neither assigns nor erases legacy sessions.
    await engine.exec(progressMigration);
    assert.deepEqual((await pool.query('SELECT user_id FROM vocpt.sessions WHERE id = 5')).rows, [{ user_id: null }]);
    assert.equal((await pool.query('SELECT count(*) FROM vocpt.legacy_progress_claims')).rows[0].count, 0);
  } finally { await engine.close(); }
});

test('practice reads and writes reject another account or unassigned session without changing it', async () => {
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  try {
    await setup(engine);
    const pool = testPool(engine);
    const first = createPostgresDatabase(pool, { userId: firstUser });
    const second = createPostgresDatabase(pool, { userId: secondUser });
    const fresh = createPostgresDatabase(pool, { userId: freshUser });
    assert.equal((await first.getPractice(3)).index, 1);
    assert.equal((await second.getPractice(4)).index, 1);
    for (const [account, sessionId, wordId] of [[second, 3, 2], [first, 4, 2], [fresh, 3, 2], [first, 5, 4], [second, 5, 4], [fresh, 5, 4]]) {
      assert.equal(await account.getPractice(sessionId), null);
      await assert.rejects(account.recordPracticeAnswer(sessionId, wordId, true, false), /Session not found/);
    }
    assert.deepEqual((await pool.query('SELECT session_id, word_id, completed FROM vocpt.session_words WHERE completed = 0 ORDER BY session_id')).rows, [
      { session_id: 3, word_id: 2, completed: 0 }, { session_id: 4, word_id: 2, completed: 0 }, { session_id: 5, word_id: 4, completed: 0 },
    ]);
    await first.recordPracticeAnswer(3, 2, false, false);
    assert.equal((await first.getPractice(3)).index, 2);
    assert.deepEqual(await first.getStatistics(), { answers: 5, known: 3, mistakes: 2 });
    assert.deepEqual(await second.getStatistics(), { answers: 2, known: 1, mistakes: 1.5 });
    await assert.rejects(first.recordPracticeAnswer(3, 2, true, false), /already answered/);
  } finally { await engine.close(); }
});

test('new practices and saved sessions belong to their account and cannot leak to other accounts', async () => {
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  try {
    await setup(engine);
    const pool = testPool(engine);
    const first = createPostgresDatabase(pool, { userId: firstUser });
    const second = createPostgresDatabase(pool, { userId: secondUser });
    const fresh = createPostgresDatabase(pool, { userId: freshUser });
    const practiceId = await first.startPractice(3);
    assert.ok(practiceId > 5);
    assert.equal((await pool.query('SELECT user_id FROM vocpt.sessions WHERE id = $1', [practiceId])).rows[0].user_id, firstUser);
    const practice = await first.getPractice(practiceId);
    assert.equal(practice.words.length, 3);
    assert.equal(practice.index, 0);
    assert.equal(await second.getPractice(practiceId), null);
    assert.equal(await fresh.getPractice(practiceId), null);
    await assert.rejects(second.recordPracticeAnswer(practiceId, practice.words[0].id, true, false), /Session not found/);
    await first.recordPracticeAnswer(practiceId, practice.words[0].id, true, false);
    const savedId = await second.saveSession([{ wordId: 2, known: true, revealed: true }]);
    assert.equal((await pool.query('SELECT user_id FROM vocpt.sessions WHERE id = $1', [savedId])).rows[0].user_id, secondUser);
    assert.deepEqual((await first.getSessionHistory()).map((session) => session.id), [1, 2, 3, practiceId]);
    assert.deepEqual((await second.getSessionHistory()).map((session) => session.id), [4, savedId]);
    assert.deepEqual(await fresh.getSessionHistory(), []);
    assert.deepEqual(await second.getStatistics(), { answers: 3, known: 2, mistakes: 2 });
    const skippedId = await fresh.startPractice(1);
    const freshPractice = await fresh.getPractice(skippedId);
    await fresh.recordPracticeAnswer(skippedId, freshPractice.words[0].id, null, false);
    assert.equal((await fresh.getSessionHistory())[0].skipped, 1);
    assert.deepEqual(await fresh.getStatistics(), { answers: 0, known: 0, mistakes: 0 });
    assert.equal((await pool.query('SELECT user_id FROM vocpt.sessions WHERE id = 5')).rows[0].user_id, null);
  } finally { await engine.close(); }
});

test('account database rejects malformed IDs before querying', () => {
  const pool = { query() { throw new Error('Unexpected query'); } };
  for (const userId of [null, '', 'not-an-id', 1, `${firstUser}' OR TRUE`]) {
    assert.throws(() => createPostgresDatabase(pool, { userId }), /Invalid account ID/);
  }
});

test('practice selection uses only its account history, including completed skips', async () => {
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  try {
    await engine.exec(`CREATE SCHEMA auth;
      CREATE TABLE auth.users (id UUID PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${firstUser}'), ('${secondUser}');`);
    await engine.exec(readFileSync(new URL('../supabase/migrations/202610090001_vocabulary.sql', import.meta.url), 'utf8'));
    await engine.exec(progressMigration);
    await engine.exec(`INSERT INTO vocpt.words (id, portuguese, english)
        SELECT n, 'word-' || n, 'meaning-' || n FROM generate_series(1, 120) n;
      INSERT INTO vocpt.sessions (id, user_id) VALUES
        (1, '${firstUser}'), (2, '${firstUser}'), (3, '${firstUser}'),
        (4, '${secondUser}'), (5, '${secondUser}'), (6, '${secondUser}'), (7, NULL);
      SELECT setval(pg_get_serial_sequence('vocpt.sessions', 'id'), 7);
      INSERT INTO vocpt.answers (session_id, word_id, known)
        SELECT s, w, 1 FROM generate_series(1, 3) s CROSS JOIN generate_series(1, 10) w;
      INSERT INTO vocpt.answers (session_id, word_id, known)
        SELECT 1, w, 1 FROM generate_series(101, 120) w;
      INSERT INTO vocpt.session_words (session_id, word_id, position, completed)
        SELECT 1, w, w, 1 FROM generate_series(51, 100) w;
      INSERT INTO vocpt.answers (session_id, word_id, known)
        SELECT s, w, 1 FROM generate_series(4, 6) s CROSS JOIN generate_series(11, 20) w;
      INSERT INTO vocpt.answers (session_id, word_id, known)
        SELECT 4, w, CASE WHEN w <= 40 THEN 1 ELSE 0 END
        FROM (SELECT generate_series(21, 40) AS w UNION ALL SELECT generate_series(61, 110)) words;
      INSERT INTO vocpt.session_words (session_id, word_id, position, completed)
        SELECT 7, w, w, 1 FROM generate_series(1, 120) w;`);
    const first = createPostgresDatabase(testPool(engine), { userId: firstUser });
    const second = createPostgresDatabase(testPool(engine), { userId: secondUser });
    for (const count of [10, 30, 100]) {
      for (const [account, classify] of [
        [first, (id) => id <= 10 ? 'practiced' : id <= 50 ? 'new' : id <= 100 ? 'review' : 'learning'],
        [second, (id) => id >= 11 && id <= 20 ? 'practiced' : id >= 21 && id <= 40 ? 'learning' : id >= 61 && id <= 110 ? 'review' : 'new'],
      ]) {
        const practice = await account.getPractice(await account.startPractice(count));
        const mix = { practiced: 0, new: 0, review: 0, learning: 0 };
        for (const word of practice.words) mix[classify(word.id)]++;
        assert.deepEqual(mix, { practiced: count * 0.1, new: count * 0.4, review: count * 0.5, learning: 0 });
        assert.equal(new Set(practice.words.map((word) => word.id)).size, count);
      }
    }
  } finally { await engine.close(); }
});
