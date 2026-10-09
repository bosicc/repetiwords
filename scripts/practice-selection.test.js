import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createSqliteDatabase } from '../lib/database-sqlite.js';

async function withFixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'vocpt-selection-'));
  const previousDirectory = process.env.VOCPT_DATA_DIR;
  process.env.VOCPT_DATA_DIR = directory;
  let connection;
  try {
    const app = createSqliteDatabase();
    connection = new Database(join(directory, 'vocabulary.sqlite'));
    connection.pragma('foreign_keys = ON');
    connection.exec('DELETE FROM words');
    const categories = new Map();
    const insertWord = connection.prepare('INSERT INTO words (portuguese, english) VALUES (?, ?)');
    const insertSession = connection.prepare('INSERT INTO sessions DEFAULT VALUES');
    const insertAnswer = connection.prepare('INSERT INTO answers (session_id, word_id, known, revealed) VALUES (?, ?, ?, ?)');
    const insertPlanned = connection.prepare('INSERT INTO session_words (session_id, word_id, position, completed) VALUES (?, ?, 0, ?)');
    function answer(wordId, known = true, revealed = false) {
      const sessionId = Number(insertSession.run().lastInsertRowid);
      insertAnswer.run(sessionId, wordId, Number(known), Number(revealed));
    }
    function planned(wordId, completed) {
      const sessionId = Number(insertSession.run().lastInsertRowid);
      insertPlanned.run(sessionId, wordId, Number(completed));
    }
    function add(category, count = 1) {
      const ids = [];
      connection.transaction(() => {
        for (let index = 0; index < count; index++) {
          const name = `${category}-${categories.size}`;
          const id = Number(insertWord.run(name, name).lastInsertRowid);
          categories.set(id, category);
          ids.push(id);
          if (category === 'practiced') for (let round = 0; round < 3; round++) answer(id);
          if (category === 'review') answer(id, false);
          if (category === 'learning') answer(id);
        }
      })();
      return ids;
    }
    function practice(count) {
      const session = app.getPractice(app.startPractice(count));
      assert.equal(session.index, 0);
      assert.deepEqual(session.answers, []);
      assert.equal(new Set(session.words.map((word) => word.id)).size, session.words.length);
      assert.ok(session.words.every((word) => word.completed === 0));
      return session;
    }
    function counts(session) {
      const result = { practiced: 0, new: 0, review: 0, learning: 0 };
      for (const word of session.words) result[categories.get(word.id)]++;
      return result;
    }
    await run({ ...app, connection, categories, add, answer, planned, practice, counts });
  } finally {
    connection?.close();
    if (previousDirectory === undefined) delete process.env.VOCPT_DATA_DIR;
    else process.env.VOCPT_DATA_DIR = previousDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
}

test('practice uses the 10/40/50 mix at all supported session sizes', async () => {
  await withFixture(({ add, practice, counts }) => {
    add('practiced', 40);
    add('new', 120);
    add('review', 120);
    add('learning', 20);
    for (const size of [10, 30, 100]) {
      const session = practice(size);
      assert.equal(session.words.length, size);
      assert.deepEqual(counts(session), {
        practiced: size / 10, new: size * 0.4, review: size * 0.5, learning: 0,
      });
    }
  });
});

test('unavailable new-word slots transfer to words needing review', async () => {
  await withFixture(({ add, practice, counts }) => {
    add('practiced', 10);
    add('new', 2);
    add('review', 20);
    add('learning', 10);
    assert.deepEqual(counts(practice(10)), { practiced: 1, new: 2, review: 7, learning: 0 });
  });
});

test('pool shortages fall back to review, new, practiced, then other learning words', async () => {
  const cases = [
    { pools: { new: 20, review: 20, learning: 20 }, expected: { practiced: 0, new: 4, review: 6, learning: 0 } },
    { pools: { practiced: 20, new: 20, learning: 20 }, expected: { practiced: 1, new: 9, review: 0, learning: 0 } },
    { pools: { practiced: 20, learning: 20 }, expected: { practiced: 10, new: 0, review: 0, learning: 0 } },
    { pools: { practiced: 2, new: 1, review: 1, learning: 20 }, expected: { practiced: 2, new: 1, review: 1, learning: 6 } },
  ];
  for (const { pools, expected } of cases) {
    await withFixture(({ add, practice, counts }) => {
      for (const [category, count] of Object.entries(pools)) add(category, count);
      assert.deepEqual(counts(practice(10)), expected);
    });
  }
});

test('new learners receive new words and short vocabularies appear once per session', async () => {
  await withFixture(({ add, practice, counts, startPractice, connection }) => {
    add('new', 8);
    for (const size of [10, 30, 100]) {
      const session = practice(size);
      assert.equal(session.words.length, 8);
      assert.deepEqual(counts(session), { practiced: 0, new: 8, review: 0, learning: 0 });
    }
    for (const invalid of [0, -1, 101, 1.5, '10']) assert.throws(() => startPractice(invalid));
    assert.equal(connection.prepare('SELECT COUNT(*) AS total FROM sessions').get().total, 3);
  });
  await withFixture(({ startPractice, connection }) => {
    assert.throws(() => startPractice(10), /No vocabulary/);
    assert.equal(connection.prepare('SELECT COUNT(*) AS total FROM sessions').get().total, 0);
  });
});

test('pending words remain new; completed skips count as review without an answer', async () => {
  await withFixture(({ add, planned, practice, counts, connection }) => {
    add('practiced', 1);
    const newIds = add('new', 30);
    for (const id of newIds) planned(id, false);
    const skippedIds = add('new', 5);
    for (const id of skippedIds) {
      planned(id, true);
    }
    // Classify the expected outcomes independently of the production query.
    const expectedReview = new Set(skippedIds);
    const session = practice(10);
    assert.equal(session.words.filter((word) => expectedReview.has(word.id)).length, 5);
    assert.equal(session.words.filter((word) => newIds.includes(word.id)).length, 4);
    assert.equal(counts(session).practiced, 1);
    assert.equal(connection.prepare('SELECT COUNT(*) AS total FROM answers WHERE word_id IN (?, ?, ?, ?, ?)')
      .get(...skippedIds).total, 0);
  });
});

test('practiced means three unassisted correct answers, with priority over past mistakes or skips', async () => {
  await withFixture(({ add, answer, planned, categories, practice, counts }) => {
    const [practicedId] = add('new');
    // Correct answers need not be consecutive; hinted answers do not contribute.
    answer(practicedId);
    answer(practicedId, false);
    answer(practicedId);
    answer(practicedId, true, true);
    planned(practicedId, true);
    answer(practicedId);
    answer(practicedId, false);
    categories.set(practicedId, 'practiced');

    const reviewIds = add('new', 5);
    for (let round = 0; round < 3; round++) answer(reviewIds[0], true, true);
    planned(reviewIds[1], true);
    answer(reviewIds[2], false);
    answer(reviewIds[3]);
    answer(reviewIds[3]);
    answer(reviewIds[3], true, true);
    answer(reviewIds[4]);
    planned(reviewIds[4], true);
    for (const id of reviewIds) categories.set(id, 'review');
    add('new', 30);
    const learningIds = add('learning', 20);
    for (const id of learningIds) answer(id); // Two correct answers are still learning.
    for (let trial = 0; trial < 10; trial++) {
      const session = practice(10);
      assert.deepEqual(counts(session), { practiced: 1, new: 4, review: 5, learning: 0 });
      assert.ok(session.words.some((word) => word.id === practicedId));
      assert.ok(reviewIds.every((id) => session.words.some((word) => word.id === id)));
    }
  });
});

test('repeated practices sample different words and shuffle the final pool mix', async () => {
  await withFixture(({ add, categories, practice, counts }) => {
    add('practiced', 30);
    add('new', 100);
    add('review', 100);
    const wordSelections = new Set();
    const categoryOrders = new Set();
    for (let trial = 0; trial < 12; trial++) {
      const session = practice(10);
      assert.deepEqual(counts(session), { practiced: 1, new: 4, review: 5, learning: 0 });
      wordSelections.add(session.words.map((word) => word.id).sort((a, b) => a - b).join(','));
      categoryOrders.add(session.words.map((word) => categories.get(word.id)).join(','));
    }
    // Repeated trials avoid requiring a particular random order or selected word.
    assert.ok(wordSelections.size > 1, 'word choices should vary between sessions');
    assert.ok(categoryOrders.size > 1, 'pool categories should be interleaved differently');
  });
});
