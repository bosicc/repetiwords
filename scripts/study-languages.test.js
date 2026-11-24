import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase } from '../lib/database-postgres.js';
import { createWordLists } from '../lib/word-lists.js';
import { createSharedLists } from '../lib/shared-lists.js';
import { readStudyLanguage, selectStudyLanguage } from '../lib/study-languages.js';
import { importSpanishVocabulary } from '../lib/spanish-vocabulary.js';

test('switching courses preserves legacy progress and pins sessions and shared lists to their course', async () => {
  const engine = new PGlite();
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const visitor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const query = async (sql, values) => {
    const r = await engine.query(sql, values);
    return { rows: r.rows, rowCount: r.affectedRows };
  };
  const pool = { query, async connect() { return { query, release() {} }; } };
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const batch = [{ portuguese: 'casa', source_english: 'house', source_ukrainian: 'дім', term: 'casa', english: 'house', ukrainian: 'дім' }];
  try {
    await engine.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${owner}'),('${visitor}');`);
    const migrations = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
    for (const file of migrations) {
      await engine.exec(readFileSync(new URL(file, dir), 'utf8'));
      if (file.startsWith('202610290001')) {
        await engine.exec(`INSERT INTO vocpt.words (portuguese,english,ukrainian,level) VALUES ('casa','house','дім','A1');
          INSERT INTO vocpt.groups (name) VALUES ('Home'); INSERT INTO vocpt.word_groups VALUES (1,1);
          INSERT INTO vocpt.sessions (user_id) VALUES ('${owner}'); INSERT INTO vocpt.answers (session_id,word_id,known) VALUES (1,1,1);`);
      }
    }
    for (const expected of [1, 0]) {
      await query('BEGIN');
      assert.deepEqual(await importSpanishVocabulary(pool, batch), { sourceWords: 1, added: expected, membershipsAdded: expected });
      await query('COMMIT');
    }
    await query('BEGIN');
    await assert.rejects(importSpanishVocabulary(pool, [{ ...batch[0], source_english: 'apartment' }]), /Source vocabulary differs/);
    await query('ROLLBACK');
    assert.equal(await readStudyLanguage(pool, owner), 'pt-PT');
    await selectStudyLanguage(pool, owner, 'es-ES');
    assert.equal(await readStudyLanguage(pool, owner), 'es-ES');
    assert.equal(await readStudyLanguage(pool, visitor), 'pt-PT');
    const pt = createPostgresDatabase(pool, { userId: owner });
    const es = createPostgresDatabase(pool, { userId: owner, studyLanguage: 'es-ES' });
    const [word] = await es.getVocabulary();
    assert.deepEqual([word.portuguese, word.level, word.categories], ['casa','A1',['Home']]);
    assert.notEqual(word.id, (await pt.getVocabulary())[0].id);
    assert.equal((await pt.getStatistics()).answers, 1);
    assert.equal((await es.getWordProgress()).new, 1);
    const lists = createWordLists(pool, owner, 'es-ES');
    const id = await lists.createList('Casa');
    await lists.addWord(id, 1);
    await lists.addWords(id, 'casa');
    assert.deepEqual((await lists.getList(id)).words.map(w => w.id), [word.id]);
    assert.deepEqual(await createWordLists(pool, owner).getLists(), []);
    for (const mode of ['self-assessment','multiple-choice','matching']) {
      const session = await es.startPractice(10, mode, id);
      await selectStudyLanguage(pool, owner, 'pt-PT');
      assert.equal((await pt.getPractice(session)).studyLanguage, 'es-ES');
      assert.deepEqual((await pt.getPractice(session)).words.map(w => w.id), [word.id]);
      if (mode === 'matching') await pt.recordPracticeRound(session, [{ wordId: word.id, known: true, revealed: false }]);
      else await pt.recordPracticeAnswer(session, word.id, true, false);
    }
    assert.equal((await pt.getStatistics()).answers, 1);
    assert.equal((await es.getSessionHistory()).length, 3);
    assert.equal((await es.getWordProgress()).mastered, 1);
    const shared = createSharedLists(pool);
    const token = await shared.enableShare(id, owner);
    assert.equal((await shared.getPublicList(token)).studyLanguage, 'es-ES');
    const copy = await shared.saveList(token, visitor);
    assert.equal((await createWordLists(pool, visitor, 'es-ES').getList(copy)).study_language, 'es-ES');
    const practice = await shared.start(token, {userId: visitor, count: 10});
    await shared.submit(practice, visitor, null, { wordId: word.id, known: true, revealed: false });
    assert.equal((await createPostgresDatabase(pool, {userId: visitor}).getStatistics()).answers, 0);
    assert.equal((await createPostgresDatabase(pool, {userId: visitor, studyLanguage: 'es-ES'}).getStatistics()).answers, 1);
  } finally { await engine.close(); }
});
