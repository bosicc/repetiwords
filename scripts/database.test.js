import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { validateBatch } from '../lib/word-import.js';
import { cleanVocabulary } from '../lib/word-cleanup.js';

test('sessions persist answers, update statistics, and reject invalid input', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vocpt-test-'));
  process.env.VOCPT_DATA_DIR = directory;
  try {
    const { getWords, getStatistics, saveSession, createUser, getUsers, importWords } = await import('../lib/database.js');
    assert.deepEqual(getUsers(), []);
    const user = createUser(' Borys ', ' borys@example.com ');
    assert.equal(user.name, 'Borys');
    assert.equal(user.email, 'borys@example.com');
    assert.ok(user.created_at);
    assert.throws(() => createUser('Duplicate', 'BORYS@example.com'));
    assert.throws(() => createUser(' '));
    assert.throws(() => createUser('Name', ' '));
    assert.throws(() => createUser(null));
    assert.equal(createUser('Olena').email, null);
    assert.equal(createUser('Taras').email, null);
    assert.equal(getUsers().length, 3);
    const words = getWords();
    assert.equal(words.length, 12);
    assert.deepEqual(getStatistics(), { answers: 0, known: 0, mistakes: 0 });
    saveSession([{ wordId: words[0].id, known: true }, { wordId: words[1].id, known: false }]);
    assert.deepEqual(getStatistics(), { answers: 2, known: 1, mistakes: 1 });
    assert.equal(getWords().find((word) => word.id === words[1].id).mistakes, 1);
    assert.throws(() => saveSession([{ wordId: 9999, known: true }]));
    assert.throws(() => saveSession([{ wordId: words[0].id, known: 'yes' }]));
    assert.throws(() => saveSession([{ wordId: words[0].id, known: true }, { wordId: words[0].id, known: false }]));
    assert.deepEqual(getStatistics(), { answers: 2, known: 1, mistakes: 1 });
    const batch = {
      source: 'test fixture', prepared_at: '2026-10-09',
      words: [{ portuguese: 'gato', english: 'cat', ukrainian: 'кіт', level: 'A1', groups: ['Animals', 'Pets'] }],
    };
    const preview = importWords(batch, { dryRun: true });
    assert.equal(preview.added, 1);
    assert.equal(preview.groups_added, 2);
    assert.equal(getWords().length, 12);
    const stored = importWords(batch);
    assert.deepEqual(stored, preview);
    assert.equal(importWords(batch).added, 0);
    assert.equal(importWords(batch).memberships_added, 0);
    assert.equal(getWords().find((word) => word.portuguese === 'gato').mastery_level, 0);
    const connection = new Database(join(directory, 'vocabulary.sqlite'));
    try {
      connection.prepare('UPDATE words SET mastery_level = 4 WHERE portuguese = ?').run('gato');
      const modified = structuredClone(batch);
      modified.words[0].english = 'different meaning';
      assert.equal(importWords(modified).conflicts.length, 1);
      assert.equal(getWords().find((word) => word.portuguese === 'gato').english, 'cat');
      assert.equal(getWords().find((word) => word.portuguese === 'gato').mastery_level, 4);
      const existing = { ...batch, words: [{ ...batch.words[0], portuguese: words[0].portuguese }] };
      assert.equal(importWords(existing).enriched, 1);
      assert.equal(getWords().find((word) => word.id === words[0].id).ukrainian, 'кіт');
      const invalid = structuredClone(batch);
      invalid.words.push({ ...batch.words[0], portuguese: 'invalid', level: 'A3' });
      assert.throws(() => importWords(invalid));
      assert.equal(getWords().some((word) => word.portuguese === 'invalid'), false);
      // A database write failure after adding a word rolls back the entire batch.
      connection.exec("CREATE TRIGGER reject_bad_group BEFORE INSERT ON groups WHEN NEW.name = 'Rejected' BEGIN SELECT RAISE(ABORT, 'rejected group'); END");
      assert.throws(() => importWords({ ...batch, words: [{ ...batch.words[0], portuguese: 'rollback', groups: ['Rejected'] }] }));
      assert.equal(getWords().some((word) => word.portuguese === 'rollback'), false);
    } finally { connection.close(); }
    assert.deepEqual(getStatistics(), { answers: 2, known: 1, mistakes: 1 });
    saveSession([{ wordId: words[0].id, known: true, revealed: true }, { wordId: words[1].id, known: false, revealed: true }]);
    assert.deepEqual(getStatistics(), { answers: 4, known: 2, mistakes: 2.5 });
    assert.throws(() => saveSession([{ wordId: words[0].id, known: true, revealed: 'yes' }]));
    const persisted = new Database(join(directory, 'vocabulary.sqlite'));
    try {
      assert.equal(persisted.prepare('SELECT revealed FROM answers ORDER BY id DESC LIMIT 1').get().revealed, 1);
      persisted.pragma('foreign_keys = ON');
      const phraseId = persisted.prepare('INSERT INTO words (portuguese, english, mastery_level) VALUES (?, ?, ?)').run('bom dia', 'good morning', 3).lastInsertRowid;
      persisted.prepare('INSERT INTO answers (session_id, word_id, known, revealed) VALUES (1, ?, 1, 1)').run(phraseId);
      const before = getStatistics();
      const cleanup = { source: 'fixture', prepared_at: '2026-10-09',
        replacements: [{ id: Number(phraseId), portuguese: 'bom dia', components: ['bom', 'dia'] }],
        words: ['bom', 'dia'].map((word) => ({ portuguese: word, english: word === 'bom' ? 'good' : 'day', ukrainian: word === 'bom' ? 'добрий' : 'день', level: 'A1', groups: ['Greetings'] })),
      };
      assert.throws(() => cleanVocabulary(persisted, { ...cleanup, replacements: [] }));
      assert.equal(persisted.prepare('SELECT COUNT(*) AS n FROM archived_words').get().n, 0);
      assert.throws(() => cleanVocabulary(persisted, { ...cleanup, words: cleanup.words.map((word) => ({ ...word, groups: ['Rejected'] })) }));
      assert.equal(persisted.prepare("SELECT COUNT(*) AS n FROM words WHERE portuguese='bom'").get().n, 0);
      const result = cleanVocabulary(persisted, cleanup);
      assert.equal(result.archived_records, 1);
      assert.equal(result.archived_answers, 1);
      assert.equal(result.added, 1);
      assert.deepEqual(getStatistics(), before);
      assert.equal(getWords().some((word) => word.portuguese === 'bom dia'), false);
      assert.equal(JSON.parse(persisted.prepare('SELECT record_json FROM archived_words').get().record_json).mastery_level, 3);
      assert.equal(getWords().find((word) => word.portuguese === 'gato').mastery_level, 4);
      assert.equal(cleanVocabulary(persisted, cleanup).archived_records, 0);
      assert.deepEqual(persisted.pragma('foreign_key_check'), []);
    } finally { persisted.close(); }
    const { startPractice, getPractice, recordPracticeAnswer } = await import('../lib/database.js');
    const practiceId = startPractice(3);
    const practice = getPractice(practiceId);
    assert.equal(practice.words.length, 3);
    assert.equal(new Set(practice.words.map((word) => word.id)).size, 3);
    assert.equal(practice.index, 0);
    recordPracticeAnswer(practiceId, practice.words[0].id, true, true);
    assert.equal(getPractice(practiceId).index, 1);
    assert.equal(getPractice(practiceId).answers[0].revealed, true);
    assert.throws(() => recordPracticeAnswer(practiceId, practice.words[0].id, true, false));
    recordPracticeAnswer(practiceId, practice.words[1].id, null, false);
    assert.equal(getPractice(practiceId).index, 2);
    assert.equal(getPractice(practiceId).answers.length, 1);
    recordPracticeAnswer(practiceId, practice.words[2].id, false, false);
    assert.equal(getPractice(practiceId).index, 3);
    assert.throws(() => startPractice(0));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('import batches reject incomplete records and normalize accents and groups', () => {
  const batch = { source: 'fixture', prepared_at: '2026-10-09', words: [
    { portuguese: ' cafe\u0301 ', english: 'coffee', ukrainian: 'кава', level: 'A1', groups: ['Food', ' Food '] },
  ] };
  assert.equal(validateBatch(batch).words[0].portuguese, 'café');
  assert.deepEqual(validateBatch(batch).words[0].groups, ['Food']);
  for (const field of ['portuguese', 'english', 'ukrainian', 'level', 'groups']) {
    const invalid = structuredClone(batch);
    delete invalid.words[0][field];
    assert.throws(() => validateBatch(invalid));
  }
  assert.throws(() => validateBatch({ ...batch, words: [...batch.words, batch.words[0]] }));
  assert.throws(() => validateBatch({ ...batch, words: [{ ...batch.words[0], mastery_level: 5 }] }));
  for (const phrase of ['a que horas abre?', 'bom dia', 'professor/a', ' olá! ', 'gato\tcão']) {
    assert.throws(() => validateBatch({ ...batch, words: [{ ...batch.words[0], portuguese: phrase }] }));
  }
  assert.equal(validateBatch({ ...batch, words: [{ ...batch.words[0], portuguese: 'pequeno-almoço' }] }).words[0].portuguese, 'pequeno-almoço');
});

test('schema supports multiple groups, validates fields, and preserves legacy data', () => {
  for (const legacy of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), 'vocpt-schema-'));
    let db;
    try {
      db = new Database(join(directory, 'vocabulary.sqlite'));
      if (legacy) {
        db.exec(`CREATE TABLE words (id INTEGER PRIMARY KEY, portuguese TEXT NOT NULL UNIQUE, english TEXT NOT NULL);
          INSERT INTO words VALUES (42, 'gato', 'cat');
          CREATE TABLE sessions (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
          CREATE TABLE answers (id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id),
            word_id INTEGER NOT NULL REFERENCES words(id), known INTEGER NOT NULL CHECK (known IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id, word_id));
          INSERT INTO sessions (id) VALUES (1);
          INSERT INTO answers (session_id, word_id, known) VALUES (1, 42, 1);`);
      }
      const initialize = () => execFileSync(process.execPath, ['scripts/init-db.js'], {
        env: { ...process.env, VOCPT_DATA_DIR: directory },
      });
      initialize();
      initialize(); // Initialization can safely be repeated.
      db.pragma('foreign_keys = ON');
      db.exec("INSERT INTO users (name) VALUES ('Learner')");
      assert.throws(() => db.exec("INSERT INTO users (name) VALUES (' ')"));
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1);
      const word = db.prepare('SELECT * FROM words ORDER BY id LIMIT 1').get();
      assert.equal(word.mastery_level, 0);
      assert.equal(word.level, null);
      assert.equal(word.ukrainian, null);
      if (legacy) {
        assert.equal(db.prepare('SELECT portuguese FROM words WHERE id = 42').get().portuguese, 'gato');
        assert.equal(db.prepare('SELECT word_id FROM answers').get().word_id, 42);
      }
      db.exec("INSERT INTO groups (name) VALUES ('Animals'), ('Pets')");
      const link = db.prepare('INSERT INTO word_groups VALUES (?, ?)');
      link.run(word.id, 1);
      link.run(word.id, 2);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM word_groups WHERE word_id = ?').get(word.id).count, 2);
      assert.throws(() => link.run(word.id, 1));
      assert.throws(() => link.run(-1, 1));
      assert.throws(() => link.run(word.id, -1));
      assert.throws(() => db.exec("INSERT INTO groups (name) VALUES ('Animals')"));
      assert.throws(() => db.exec("INSERT INTO groups (name) VALUES (' ')"));
      for (const value of [-1, 6, 2.5]) {
        assert.throws(() => db.prepare('UPDATE words SET mastery_level = ? WHERE id = ?').run(value, word.id));
      }
      assert.throws(() => db.prepare('UPDATE words SET level = ? WHERE id = ?').run('A3', word.id));
      db.prepare('UPDATE words SET level = ?, ukrainian = ?, mastery_level = ? WHERE id = ?').run('A1', 'кіт', 5, word.id);
      db.exec('DELETE FROM groups WHERE id = 1');
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM word_groups').get().count, 1);
      db.prepare('DELETE FROM word_groups WHERE word_id = ?').run(word.id);
      link.run(word.id, 2);
      // Use a word with no practice history to verify word deletion cascades.
      db.exec("INSERT INTO words (portuguese, english) VALUES ('cão', 'dog')");
      const dog = db.prepare("SELECT id FROM words WHERE portuguese = 'cão'").get();
      link.run(dog.id, 2);
      db.prepare('DELETE FROM words WHERE id = ?').run(dog.id);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM word_groups WHERE word_id = ?').get(dog.id).count, 0);
    } finally {
      db?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});


test('progress counts unique words and mastery can rise and fall', async () => {
  const { calculateProgress } = await import('../lib/progress.js');
  const answers = [1, 2, 3].map((id) => ({ id, word_id: 1, known: 1, revealed: 0, created_at: `2026-10-0${id} 12:00:00` }));
  const mastered = calculateProgress([1, 2], answers, new Date('2026-10-09T12:00:00Z'));
  assert.equal(mastered.mastered, 1);
  assert.equal(mastered.new, 1);
  assert.equal(mastered.learning, 0);
  answers.push({ id: 4, word_id: 1, known: 1, revealed: 1, created_at: '2026-10-08 12:00:00' });
  const reset = calculateProgress([1, 2], answers, new Date('2026-10-09T12:00:00Z'));
  assert.equal(reset.mastered, 0);
  assert.equal(reset.learning, 1);
  assert.equal(reset.history.find((day) => day.date === '2026-10-07').mastered, 1);
  assert.equal(reset.history.find((day) => day.date === '2026-10-08').mastered, 0);
  assert.equal(calculateProgress([], [], new Date('2026-10-09T12:00:00Z')).total, 0);
});

test('session history retains word outcomes, partial sessions, skips, and archived answers', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vocpt-session-history-'));
  const previousDirectory = process.env.VOCPT_DATA_DIR;
  process.env.VOCPT_DATA_DIR = directory;
  let connection;
  try {
    const { getVocabulary, saveSession, startPractice, getPractice, recordPracticeAnswer, getSessionHistory } =
      await import('../lib/database.js?session-history');
    connection = new Database(join(directory, 'vocabulary.sqlite'));
    connection.pragma('foreign_keys = ON');
    assert.deepEqual(getSessionHistory(), []);
    for (const limit of [0, -1, 1.5, '20']) assert.throws(() => getSessionHistory(limit));
    const untouchedId = startPractice(2);
    assert.deepEqual(getSessionHistory(), []);

    const words = getVocabulary();
    const legacyId = saveSession([
      { wordId: words[0].id, known: true },
      { wordId: words[1].id, known: true, revealed: true },
      { wordId: words[2].id, known: false, revealed: true },
    ]);
    const practiceId = startPractice(5);
    const practiceWords = getPractice(practiceId).words;
    recordPracticeAnswer(practiceId, practiceWords[0].id, true, false);
    recordPracticeAnswer(practiceId, practiceWords[1].id, true, true);
    recordPracticeAnswer(practiceId, practiceWords[2].id, false, false);
    recordPracticeAnswer(practiceId, practiceWords[3].id, null, false);
    const skippedId = startPractice(2);
    for (const word of getPractice(skippedId).words) recordPracticeAnswer(skippedId, word.id, null, false);
    const setDate = connection.prepare('UPDATE sessions SET created_at = ? WHERE id = ?');
    setDate.run('2026-10-08 23:00:00', legacyId);
    setDate.run('2026-10-09 08:00:00', practiceId);
    setDate.run('2026-10-09 08:00:00', skippedId);
    setDate.run('2026-10-10 08:00:00', untouchedId);

    const history = getSessionHistory();
    assert.deepEqual(history.map((session) => session.id), [legacyId, practiceId, skippedId]);
    assert.deepEqual(getSessionHistory(2).map((session) => session.id), [practiceId, skippedId]);
    assert.deepEqual(history[0], {
      id: legacyId, createdAt: '2026-10-08 23:00:00', total: 3, completed: 3,
      independent: 1, helped: 1, mistakes: 1, skipped: 0,
      segments: words.slice(0, 3).map((word, index) => ({
        wordId: word.id, portuguese: word.portuguese, english: word.english, ukrainian: word.ukrainian,
        outcome: ['independent', 'helped', 'mistakes'][index],
      })),
    });
    assert.equal(history[1].total, 5);
    assert.equal(history[1].completed, 4);
    assert.deepEqual(history[1].segments.map((segment) => segment.wordId), practiceWords.slice(0, 4).map((word) => word.id));
    assert.deepEqual(history[1].segments.map((segment) => segment.outcome), ['independent', 'helped', 'mistakes', 'skipped']);
    assert.equal(history[2].completed, 2);
    assert.equal(history[2].skipped, 2);
    assert.equal(history[2].segments.length, 2);

    const phraseId = Number(connection.prepare('INSERT INTO words (portuguese, english, ukrainian) VALUES (?, ?, ?)')
      .run('boa tarde', 'good afternoon', 'добрий день').lastInsertRowid);
    const phraseAnswerId = Number(connection.prepare('INSERT INTO answers (session_id, word_id, known, revealed) VALUES (?, ?, 0, 1)')
      .run(legacyId, phraseId).lastInsertRowid);
    const beforeArchive = getSessionHistory();
    const cleanup = {
      source: 'session history fixture', prepared_at: '2026-10-09',
      replacements: [{ id: phraseId, portuguese: 'boa tarde', components: ['boa', 'tarde'] }],
      words: [
        { portuguese: 'boa', english: 'good', ukrainian: 'добра', level: 'A1', groups: ['Greetings'] },
        { portuguese: 'tarde', english: 'afternoon', ukrainian: 'друга половина дня', level: 'A1', groups: ['Greetings'] },
      ],
    };
    assert.equal(cleanVocabulary(connection, cleanup).archived_answers, 1);
    assert.deepEqual(getSessionHistory(), beforeArchive);
    recordPracticeAnswer(practiceId, practiceWords[4].id, true, false);
    // SQLite can reuse a deleted answer ID; it must not hide or duplicate an archived answer.
    assert.equal(connection.prepare('SELECT MAX(id) AS id FROM answers').get().id, phraseAnswerId);
    const finished = getSessionHistory().find((session) => session.id === practiceId);
    assert.equal(finished.completed, 5);
    assert.equal(finished.independent, 2);
    assert.equal(finished.segments.length, 5);
    assert.deepEqual(getSessionHistory()[0], beforeArchive[0]);
    // Malformed old snapshots retain their outcome and a usable word identifier.
    connection.exec("UPDATE archived_words SET record_json = '{invalid json' WHERE original_word_id = " + phraseId);
    const archivedSegment = getSessionHistory()[0].segments.at(-1);
    assert.deepEqual(archivedSegment, {
      wordId: phraseId, portuguese: `#${phraseId}`, english: '', ukrainian: null, outcome: 'mistakes',
    });
  } finally {
    connection?.close();
    if (previousDirectory === undefined) delete process.env.VOCPT_DATA_DIR;
    else process.env.VOCPT_DATA_DIR = previousDirectory;
    rmSync(directory, { recursive: true, force: true });
  }
});
