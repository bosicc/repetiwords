import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { PGlite } from '@electric-sql/pglite';
import { createSqliteDatabase } from '../lib/database-sqlite.js';
import { createPostgresDatabase } from '../lib/database-postgres.js';
import { cleanVocabulary } from '../lib/word-cleanup.js';
import { migrationTables, readSqliteSnapshot, migrateSnapshot, verifySnapshot, snapshotManifest } from '../lib/sqlite-migration.js';

const practiceMigration = readFileSync(new URL('../supabase/migrations/202610100001_practice_modes.sql', import.meta.url), 'utf8');

function testPool(engine) {
  async function query(sql, values = []) {
    // The real pg driver accepts multi-statement schema scripts; PGlite uses exec.
    if (sql.includes('CREATE SCHEMA')) {
      await engine.exec(sql);
      return { rows: [], rowCount: 0 };
    }
    const result = await engine.query(sql, values);
    return { rows: result.rows, rowCount: result.affectedRows };
  }
  return { query, async connect() { return { query, release() {} }; } };
}

test('app requires PostgreSQL settings and never creates a fallback SQLite database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vocpt-no-fallback-'));
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./lib/database.js');"], {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: '', POSTGRES_URL: '', VOCPT_DATA_DIR: directory },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set DATABASE_URL or POSTGRES_URL/);
    assert.equal(existsSync(join(directory, 'vocabulary.sqlite')), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('SQLite migration preserves rows, archives, partial sessions and PostgreSQL behavior', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vocpt-postgres-'));
  const previousDirectory = process.env.VOCPT_DATA_DIR;
  process.env.VOCPT_DATA_DIR = directory;
  let source;
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  try {
    const local = createSqliteDatabase();
    source = new Database(join(directory, 'vocabulary.sqlite'));
    source.pragma('foreign_keys = ON');
    local.createUser('Learner', 'learner@example.com');
    const first = local.getWords()[0];
    local.saveSession([{ wordId: first.id, known: true, revealed: true }]);
    const phraseId = Number(source.prepare("INSERT INTO words (portuguese, english, mastery_level) VALUES ('boa tarde', 'good afternoon', 4)").run().lastInsertRowid);
    source.prepare('INSERT INTO answers (session_id, word_id, known, revealed) VALUES (1, ?, 0, 1)').run(phraseId);
    cleanVocabulary(source, {
      source: 'archive fixture', prepared_at: '2026-10-09',
      replacements: [{ id: phraseId, portuguese: 'boa tarde', components: ['boa', 'tarde'] }],
      words: [
        { portuguese: 'boa', english: 'good', ukrainian: 'добра', level: 'A1', groups: ['Greetings'] },
        { portuguese: 'tarde', english: 'afternoon', ukrainian: 'друга половина дня', level: 'A1', groups: ['Greetings'] },
      ],
    });
    const practiceId = local.startPractice(5);
    const planned = local.getPractice(practiceId).words;
    local.recordPracticeAnswer(practiceId, planned[0].id, true, false);
    local.recordPracticeAnswer(practiceId, planned[1].id, null, false);
    const snapshot = readSqliteSnapshot(source);
    const manifest = snapshotManifest(snapshot);
    const pool = testPool(engine);
    assert.deepEqual(await migrateSnapshot(pool, snapshot), manifest);
    await engine.exec(practiceMigration);
    assert.deepEqual(await verifySnapshot(pool, snapshot), manifest);
    const remote = createPostgresDatabase(pool);
    assert.deepEqual(await remote.getUsers(), local.getUsers());
    assert.deepEqual(await remote.getStatistics(), local.getStatistics());
    assert.deepEqual(await remote.getWordProgress(), local.getWordProgress());
    assert.deepEqual(await remote.getSessionHistory(), local.getSessionHistory());
    const byId = (rows) => rows.toSorted((a, b) => a.id - b.id);
    assert.deepEqual(byId(await remote.getVocabulary()), byId(local.getVocabulary()));
    assert.deepEqual(byId(await remote.getWords()), byId(local.getWords()));
    assert.deepEqual(await remote.getPractice(practiceId), local.getPractice(practiceId));
    assert.equal(await remote.getPractice(-1), null);
    await assert.rejects(remote.createUser('Duplicate', 'LEARNER@example.com'));
    await assert.rejects(remote.createUser(' '), /Invalid user/);
    await assert.rejects(remote.getSessionHistory(0), /Invalid session history/);
    await assert.rejects(remote.startPractice(0), /Invalid word count/);
    await assert.rejects(remote.saveSession([{ wordId: -1, known: true }]), /Invalid session/);
    await assert.rejects(remote.saveSession([{ wordId: first.id, known: 'yes' }]), /Invalid session/);

    // A rerun must leave all previously migrated rows intact.
    await assert.rejects(migrateSnapshot(pool, snapshot), /not empty/);
    assert.deepEqual(await verifySnapshot(pool, snapshot), manifest);
    const addedUser = await remote.createUser('Second');
    assert.ok(addedUser.id > Math.max(...snapshot.users.map((row) => row.id)));
    await remote.recordPracticeAnswer(practiceId, planned[2].id, false, true);
    assert.equal((await remote.getPractice(practiceId)).index, 3);
    await assert.rejects(remote.recordPracticeAnswer(practiceId, planned[2].id, true, false), /already answered/);
    const updated = await remote.getPractice(practiceId);
    assert.equal(updated.answers.length, 2);
    assert.equal(updated.answers.at(-1).wordId, planned[2].id);
    assert.equal(updated.answers.at(-1).revealed, true);
    const savedId = await remote.saveSession([{ wordId: first.id, known: true }]);
    assert.ok(savedId > Math.max(...snapshot.sessions.map((row) => row.id)));
    assert.equal((await remote.getSessionHistory()).find((session) => session.id === savedId).independent, 1);

    const batch = { source: 'fixture', prepared_at: '2026-10-09', words: [
      { portuguese: 'gato', english: 'cat', ukrainian: 'кіт', level: 'A1', groups: ['Animals'] },
    ] };
    const preview = await remote.importWords(batch, { dryRun: true });
    assert.equal(preview.added, 1);
    assert.equal((await remote.getVocabulary()).some((word) => word.portuguese === 'gato'), false);
    assert.deepEqual(await remote.importWords(batch), preview);
    assert.equal((await remote.importWords(batch)).added, 0);
    assert.equal((await remote.importWords(batch)).memberships_added, 0);
    const imported = (await remote.getVocabulary()).find((word) => word.portuguese === 'gato');
    assert.ok(imported.id > Math.max(...snapshot.words.map((row) => row.id)));
    assert.deepEqual(imported.categories, ['Animals']);
    // A database error midway through a batch must roll back the word and membership.
    await pool.query("ALTER TABLE vocpt.groups ADD CONSTRAINT reject_group CHECK (name <> 'Rejected')");
    await assert.rejects(remote.importWords({ ...batch, words: [{ ...batch.words[0], portuguese: 'rollback', groups: ['Rejected'] }] }));
    assert.equal((await remote.getVocabulary()).some((word) => word.portuguese === 'rollback'), false);
    const newPracticeId = await remote.startPractice(10);
    const newPractice = await remote.getPractice(newPracticeId);
    assert.equal(newPractice.words.length, 10);
    assert.equal(new Set(newPractice.words.map((word) => word.id)).size, 10);
    assert.equal(newPractice.index, 0);
  } finally {
    source?.close();
    await engine.close();
    if (previousDirectory === undefined) delete process.env.VOCPT_DATA_DIR;
    else process.env.VOCPT_DATA_DIR = previousDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('failed migration rolls back schema and data and can be retried', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vocpt-migration-rollback-'));
  const previousDirectory = process.env.VOCPT_DATA_DIR;
  process.env.VOCPT_DATA_DIR = directory;
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  let source;
  try {
    createSqliteDatabase();
    source = new Database(join(directory, 'vocabulary.sqlite'));
    const snapshot = readSqliteSnapshot(source);
    const bad = structuredClone(snapshot);
    bad.word_groups.push({ word_id: -1, group_id: -1 });
    const pool = testPool(engine);
    await assert.rejects(migrateSnapshot(pool, bad));
    assert.equal((await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'vocpt'")).rows[0].count, 0);
    assert.deepEqual(await migrateSnapshot(pool, snapshot), snapshotManifest(snapshot));
  } finally {
    source?.close();
    await engine.close();
    if (previousDirectory === undefined) delete process.env.VOCPT_DATA_DIR;
    else process.env.VOCPT_DATA_DIR = previousDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('PostgreSQL preserves the practiced/new/review allocation at each supported size', async () => {
  const engine = new PGlite({ parsers: { 1114: (value) => value } });
  try {
    const pool = testPool(engine);
    await migrateSnapshot(pool, Object.fromEntries(migrationTables.map(({ name }) => [name, []])));
    await engine.exec(practiceMigration);
    await pool.query("INSERT INTO vocpt.words (id, portuguese, english) SELECT n, 'word-' || n, 'meaning-' || n FROM generate_series(1, 120) n");
    await pool.query('INSERT INTO vocpt.sessions (id) VALUES (1), (2), (3)');
    await pool.query('SELECT setval(pg_get_serial_sequence(\'vocpt.sessions\', \'id\'), 3)');
    await pool.query(`INSERT INTO vocpt.answers (session_id, word_id, known)
      SELECT s, w, 1 FROM generate_series(1, 3) s CROSS JOIN generate_series(1, 10) w`);
    await pool.query(`INSERT INTO vocpt.answers (session_id, word_id, known)
      SELECT 1, n, CASE WHEN n <= 100 THEN 0 ELSE 1 END FROM generate_series(51, 120) n`);
    const app = createPostgresDatabase(pool);
    for (const count of [10, 30, 100]) {
      const practice = await app.getPractice(await app.startPractice(count));
      const mix = { practiced: 0, new: 0, review: 0, learning: 0 };
      for (const word of practice.words) mix[word.id <= 10 ? 'practiced' : word.id <= 50 ? 'new' : word.id <= 100 ? 'review' : 'learning']++;
      assert.deepEqual(mix, { practiced: count * 0.1, new: count * 0.4, review: count * 0.5, learning: 0 });
      assert.equal(practice.index, 0);
      assert.equal(new Set(practice.words.map((word) => word.id)).size, count);
    }
  } finally { await engine.close(); }
});
