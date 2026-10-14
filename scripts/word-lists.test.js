import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createWordLists } from '../lib/word-lists.js';
import { createPostgresDatabase } from '../lib/database-postgres.js';

test('personal lists isolate owners, search existing words, prevent duplicates, and scope every practice mode', async () => {
  const engine = new PGlite();
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  try {
    await engine.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${owner}'),('${other}');`);
    for (const name of ['202610090001_vocabulary','202610090002_account_progress','202610100001_practice_modes','202610130001_word_lists']) {
      await engine.exec(readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url),'utf8'));
    }
    await engine.exec(`INSERT INTO vocpt.words (portuguese,english,ukrainian) VALUES
      ('obrigado','thank you','дякую'),('café','coffee','кава'),('água','water','вода');`);
    const query = async (sql, values=[]) => { const r=await engine.query(sql,values); return {rows:r.rows,rowCount:r.affectedRows}; };
    const pool = { query, async connect() {return {query,release(){}};} };
    const first = createWordLists(pool,owner), second = createWordLists(pool,other);
    await assert.rejects(first.createList('   '));
    await assert.rejects(first.createList('x'.repeat(81)));
    const id = await first.createList(' My café words ');
    assert.equal((await first.getList(id)).name,'My café words');
    await first.renameList(id,'  Everyday words  ');
    assert.equal((await first.getList(id)).name,'Everyday words');
    await assert.rejects(second.renameList(id,'Not mine'));
    await assert.rejects(first.renameList(id,'  '));
    await assert.rejects(first.renameList(id,'x'.repeat(81)));
    assert.equal(await second.getList(id),null);
    assert.deepEqual(await second.getLists(),[]);
    await assert.rejects(second.addWord(id,1));
    await assert.rejects(second.searchWords(id,'coffee'));
    assert.equal((await first.searchWords(id,'coffee'))[0].portuguese,'café');
    assert.equal((await first.searchWords(id,'кава'))[0].portuguese,'café');
    assert.deepEqual(await first.searchWords(id,'%'),[]);
    await first.addWord(id,1); await first.addWord(id,1); await first.addWord(id,2);
    assert.equal((await first.getLists())[0].total,2);
    assert.deepEqual(await first.searchWords(id,'coffee'),[]);
    await assert.rejects(second.removeWord(id,1));
    const database = createPostgresDatabase(pool,{userId:owner});
    const outsider = createPostgresDatabase(pool,{userId:other});
    for (const mode of ['self-assessment','multiple-choice','matching']) {
      const sessionId = await database.startPractice(10,mode,id);
      const session = await database.getPractice(sessionId);
      assert.equal(session.mode,mode);
      assert.deepEqual(session.words.map(w=>w.id).sort(),[1,2]);
      assert.equal(await outsider.getPractice(sessionId),null);
    }
    await assert.rejects(outsider.startPractice(10,'matching',id));
    await first.removeWord(id,1); await first.removeWord(id,2);
    await assert.rejects(database.startPractice(10,'self-assessment',id));
    assert.equal((await database.getPractice(await database.startPractice(10))).words.length,3);
  } finally { await engine.close(); }
});
