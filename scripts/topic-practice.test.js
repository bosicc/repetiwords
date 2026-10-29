import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase } from '../lib/database-postgres.js';
import { filterVocabulary, getVocabularyTopics } from '../lib/vocabulary-topics.js';

test('topic practice stays inside the chosen topic and level in every mode, including shortages', async () => {
  const engine = new PGlite();
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await engine.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${owner}'), ('${other}');`);
    for (const name of ['202610090001_vocabulary', '202610090002_account_progress', '202610100001_practice_modes', '202610130001_word_lists', '202610140001_list_practice_source']) {
      await engine.exec(readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
    }
    await engine.exec(`INSERT INTO vocpt.words (id, portuguese, english, level) VALUES
      (1, 'maçã', 'apple', 'A1'), (2, 'sopa', 'soup', 'A2'), (3, 'gato', 'cat', 'A1'),
      (4, 'azul', 'blue', NULL), (5, 'café', 'coffee', NULL), (6, 'livro', 'book', 'A1');
      INSERT INTO vocpt.groups (id, name) VALUES (1, 'Food and Drink'), (2, 'Restaurants and Cafés'), (3, 'Animals'), (4, 'Empty topic');
      INSERT INTO vocpt.word_groups VALUES (1, 1), (2, 1), (5, 1), (5, 2), (3, 3);`);
    const query = async (sql, values = []) => { const r = await engine.query(sql, values); return { rows: r.rows, rowCount: r.affectedRows }; };
    const pool = { query, async connect() { return { query, release() {} }; } };
    const db = createPostgresDatabase(pool, { userId: owner });
    const outsider = createPostgresDatabase(pool, { userId: other });
    const vocabulary = await db.getVocabulary();
    const topics = getVocabularyTopics(vocabulary);
    assert.equal(topics.find(t => t.name === 'Food and Drink').count, 3);
    assert.equal(topics.find(t => t.name === 'Restaurants and Cafés').count, 1);
    assert.equal(topics.find(t => t.name === 'uncategorized').count, 2);
    assert.deepEqual(getVocabularyTopics([]), []);
    const scopes = [
      [{ topic: 'Food and Drink' }, [1, 2, 5]],
      [{ topic: 'Food and Drink', level: 'A1' }, [1]],
      [{ topic: 'Food and Drink', level: 'A1,A2' }, [1, 2]],
      [{ topic: 'Food and Drink', level: 'A2,unassigned' }, [2, 5]],
      [{ topic: 'Food and Drink', level: 'A1,A1,A2' }, [1, 2]],
      [{ topic: 'Food and Drink', level: 'unassigned' }, [5]],
      [{ topic: 'Restaurants and Cafés' }, [5]],
      [{ topic: 'uncategorized' }, [4, 6]],
      [{ topic: 'uncategorized', level: 'A1' }, [6]],
    ];
    for (const mode of ['self-assessment', 'multiple-choice', 'matching']) {
      for (const [scope, expected] of scopes) {
        assert.deepEqual(filterVocabulary(vocabulary, scope).map(w => w.id).sort(), expected);
        const id = await db.startPractice(30, mode, null, scope);
        const session = await db.getPractice(id);
        assert.deepEqual(session.words.map(w => w.id).sort(), expected);
        assert.equal(new Set(session.words.map(w => w.id)).size, expected.length);
        assert.equal(session.mode, mode);
        assert.equal(await outsider.getPractice(id), null);
        // The saved selection survives progress updates and retrieval.
        const first = session.words[0];
        if (mode === 'matching') await db.recordPracticeRound(id, [{ wordId: first.id, known: true, revealed: false }]);
        else await db.recordPracticeAnswer(id, first.id, false, false);
        assert.deepEqual((await db.getPractice(id)).words.map(w => w.id).sort(), expected);
      }
    }
    const before = (await query('SELECT COUNT(*) AS total FROM vocpt.sessions')).rows[0].total;
    for (const scope of [{ topic: 'Missing' }, { topic: 'Empty topic' }, { topic: "' OR 1=1 --" }, { topic: 'Food and Drink', level: 'C2' }, { topic: '' }, { topic: [] }, { topic: 'x'.repeat(201) }, { level: 'invalid' }, { level: 'A1,invalid' }, { level: 'A1,' }, { level: ['A1', 'A2'] }, { level: "A1,' OR 1=1 --" }]) {
      await assert.rejects(db.startPractice(30, 'self-assessment', null, scope));
    }
    await assert.rejects(db.startPractice(10, 'self-assessment', 1, { topic: 'Food and Drink' }));
    assert.equal((await query('SELECT COUNT(*) AS total FROM vocpt.sessions')).rows[0].total, before);
    assert.equal((await db.getPractice(await db.startPractice(30))).words.length, 6);
  } finally { await engine.close(); }
});
