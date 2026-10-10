import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PGlite } from '@electric-sql/pglite';
import { createSqliteDatabase } from '../lib/database-sqlite.js';
import { createPostgresDatabase } from '../lib/database-postgres.js';

const firstUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secondUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const modeMigration = readFileSync(new URL('../supabase/migrations/202610100001_practice_modes.sql', import.meta.url), 'utf8');

async function fixture(kind) {
  if (kind === 'SQLite') {
    const directory = mkdtempSync(join(tmpdir(), 'vocpt-practice-modes-'));
    const previousDirectory = process.env.VOCPT_DATA_DIR;
    const raw = new Database(join(directory, 'vocabulary.sqlite'));
    raw.exec('CREATE TABLE sessions (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); INSERT INTO sessions (id) VALUES (1)');
    process.env.VOCPT_DATA_DIR = directory;
    const app = createSqliteDatabase();
    raw.exec('INSERT INTO session_words (session_id, word_id, position) VALUES (1, 1, 0)');
    return {
      app, table: (name) => name,
      async exec(sql) { raw.exec(sql); },
      async rows(sql) { return raw.prepare(sql).all(); },
      async close() {
        raw.close();
        if (previousDirectory === undefined) delete process.env.VOCPT_DATA_DIR;
        else process.env.VOCPT_DATA_DIR = previousDirectory;
        rmSync(directory, { recursive: true, force: true });
      },
    };
  }
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  await engine.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${firstUser}'), ('${secondUser}');`);
  await engine.exec(readFileSync(new URL('../supabase/migrations/202610090001_vocabulary.sql', import.meta.url), 'utf8'));
  await engine.exec(readFileSync(new URL('../supabase/migrations/202610090002_account_progress.sql', import.meta.url), 'utf8'));
  await engine.exec(`INSERT INTO vocpt.words (id, portuguese, english)
      SELECT n, 'word-' || n, 'meaning-' || n FROM generate_series(1, 12) n;
    INSERT INTO vocpt.sessions (id) VALUES (1);
    SELECT setval(pg_get_serial_sequence('vocpt.sessions', 'id'), 1);
    INSERT INTO vocpt.session_words (session_id, word_id, position) VALUES (1, 1, 0);`);
  await engine.exec(modeMigration);
  async function query(sql, values = []) {
    const result = await engine.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows };
  }
  const pool = { query, async connect() { return { query, release() {} }; } };
  return {
    app: createPostgresDatabase(pool),
    first: createPostgresDatabase(pool, { userId: firstUser }),
    second: createPostgresDatabase(pool, { userId: secondUser }),
    table: (name) => `vocpt.${name}`,
    async exec(sql) { await engine.exec(sql); },
    async rows(sql) { return (await query(sql)).rows; },
    async close() { await engine.close(); },
  };
}

const resultFor = (word, index = 0) => ({ wordId: word.id, known: index !== 2, revealed: index === 1 });

for (const kind of ['SQLite', 'PostgreSQL']) {
  test(`${kind} persists each practice mode and preserves old sessions as self-assessment`, async () => {
    const db = await fixture(kind);
    try {
      const legacy = await db.app.getPractice(1);
      assert.equal(legacy.mode, 'self-assessment');
      assert.equal(legacy.words.length, 1);
      assert.equal(legacy.index, 0);
      for (const mode of ['self-assessment', 'multiple-choice', 'matching']) {
        const id = await db.app.startPractice(3, mode);
        assert.equal((await db.app.getPractice(id)).mode, mode);
        assert.equal((await db.rows(`SELECT practice_mode FROM ${db.table('sessions')} WHERE id = ${id}`))[0].practice_mode, mode);
      }
      assert.equal((await db.app.getPractice(await db.app.startPractice(2))).mode, 'self-assessment');
      const before = await db.rows(`SELECT * FROM ${db.table('sessions')} ORDER BY id`);
      for (const mode of ['', null, 'invalid', 'MATCHING', 3, {}]) {
        await assert.rejects(async () => db.app.startPractice(3, mode), /Invalid practice mode/);
      }
      assert.deepEqual(await db.rows(`SELECT * FROM ${db.table('sessions')} ORDER BY id`), before);
      await assert.rejects(db.exec(`INSERT INTO ${db.table('sessions')} (practice_mode) VALUES ('invalid')`));
      if (kind === 'PostgreSQL') {
        await db.exec(modeMigration);
        assert.deepEqual(await db.rows(`SELECT * FROM ${db.table('sessions')} ORDER BY id`), before);
      }
    } finally { await db.close(); }
  });

  test(`${kind} matching rounds persist grades, update progress and reject repeated or wrong-mode batches`, async () => {
    const db = await fixture(kind);
    try {
      const id = await db.app.startPractice(8, 'matching');
      const practice = await db.app.getPractice(id);
      const round = practice.words.slice(0, 6).map(resultFor);
      await db.app.recordPracticeRound(id, round);
      const updated = await db.app.getPractice(id);
      assert.equal(updated.mode, 'matching');
      assert.equal(updated.index, 6);
      assert.deepEqual(updated.answers, round);
      assert.deepEqual(await db.app.getStatistics(), { answers: 6, known: 5, mistakes: 1.5 });
      const history = (await db.app.getSessionHistory()).find((session) => session.id === id);
      assert.equal(history.completed, 6);
      assert.equal(history.independent, 4);
      assert.equal(history.helped, 1);
      assert.equal(history.mistakes, 1);
      await assert.rejects(async () => db.app.recordPracticeRound(id, round), /already answered/);
      assert.deepEqual(await db.app.getPractice(id), updated);
      await db.app.recordPracticeRound(id, practice.words.slice(6).map(resultFor));
      assert.equal((await db.app.getPractice(id)).index, 8);
      for (const mode of ['self-assessment', 'multiple-choice']) {
        const otherId = await db.app.startPractice(3, mode);
        const other = await db.app.getPractice(otherId);
        await assert.rejects(async () => db.app.recordPracticeRound(otherId, [resultFor(other.words[0])]), /not a matching practice/);
        assert.deepEqual(await db.app.getPractice(otherId), other);
      }
    } finally { await db.close(); }
  });

  test(`${kind} validates the entire matching round and exact next word order before saving`, async () => {
    const db = await fixture(kind);
    try {
      const id = await db.app.startPractice(8, 'matching');
      const before = await db.app.getPractice(id);
      const round = before.words.slice(0, 3).map(resultFor);
      const invalid = [
        null, [], Array(1), Array.from({ length: 7 }, (_, index) => resultFor(before.words[index])),
        [null], [round[0], round[0]], [round[0], { ...round[1], known: 'true' }],
        [round[0], { ...round[1], revealed: undefined }], [{ ...round[0], wordId: '1' }],
        [{ ...round[0], known: null }], [{ ...round[0], wordId: -1 }],
      ];
      for (const answers of invalid) {
        await assert.rejects(async () => db.app.recordPracticeRound(id, answers), /Invalid practice round/);
        assert.deepEqual(await db.app.getPractice(id), before);
      }
      for (const answers of [[round[1], round[0]], [round[0], round[2]], [{ ...round[0], wordId: 999999 }]]) {
        await assert.rejects(async () => db.app.recordPracticeRound(id, answers), /already answered or out of order/);
        assert.deepEqual(await db.app.getPractice(id), before);
      }
      for (const badId of [0, -1, '1', NaN]) {
        await assert.rejects(async () => db.app.recordPracticeRound(badId, round), /Invalid practice round/);
      }
      await assert.rejects(async () => db.app.recordPracticeRound(999999, round), /Session not found/);
      assert.deepEqual(await db.app.getStatistics(), { answers: 0, known: 0, mistakes: 0 });
      // Saving the next prefix is valid even if it is shorter than six words.
      await db.app.recordPracticeRound(id, round);
      assert.equal((await db.app.getPractice(id)).index, 3);
    } finally { await db.close(); }
  });

  test(`${kind} rolls back all earlier grades and completions when a later round insert fails`, async () => {
    const db = await fixture(kind);
    try {
      const id = await db.app.startPractice(6, 'matching');
      const before = await db.app.getPractice(id);
      const round = before.words.map(resultFor);
      const rejectedWord = round[1].wordId;
      await db.exec(kind === 'SQLite'
        ? `CREATE TRIGGER reject_round BEFORE INSERT ON answers WHEN NEW.word_id = ${rejectedWord} BEGIN SELECT RAISE(ABORT, 'rejected round'); END`
        : `ALTER TABLE vocpt.answers ADD CONSTRAINT reject_round CHECK (word_id <> ${rejectedWord})`);
      await assert.rejects(async () => db.app.recordPracticeRound(id, round));
      assert.deepEqual(await db.app.getPractice(id), before);
      assert.deepEqual(await db.app.getStatistics(), { answers: 0, known: 0, mistakes: 0 });
      await db.exec(kind === 'SQLite' ? 'DROP TRIGGER reject_round' : 'ALTER TABLE vocpt.answers DROP CONSTRAINT reject_round');
      await db.app.recordPracticeRound(id, round);
      assert.equal((await db.app.getPractice(id)).index, 6);
    } finally { await db.close(); }
  });
}

test('PostgreSQL matching round writes require the session owner and preserve other accounts', async () => {
  const db = await fixture('PostgreSQL');
  try {
    const id = await db.first.startPractice(6, 'matching');
    const before = await db.first.getPractice(id);
    const round = before.words.map(resultFor);
    assert.equal(await db.second.getPractice(id), null);
    await assert.rejects(db.second.recordPracticeRound(id, round), /Session not found/);
    assert.deepEqual(await db.first.getPractice(id), before);
    await db.first.recordPracticeRound(id, round);
    assert.deepEqual(await db.first.getStatistics(), { answers: 6, known: 5, mistakes: 1.5 });
    assert.deepEqual(await db.second.getStatistics(), { answers: 0, known: 0, mistakes: 0 });
    assert.deepEqual(await db.second.getSessionHistory(), []);
    assert.equal((await db.rows(`SELECT user_id FROM vocpt.sessions WHERE id = ${id}`))[0].user_id, firstUser);
    await db.exec("UPDATE vocpt.sessions SET practice_mode = 'matching' WHERE id = 1");
    await assert.rejects(db.first.recordPracticeRound(1, [{ wordId: 1, known: true, revealed: false }]), /Session not found/);
  } finally { await db.close(); }
});
