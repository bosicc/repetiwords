import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createSharedLists } from '../lib/shared-lists.js';
import { createWordLists } from '../lib/word-lists.js';
import { createPostgresDatabase } from '../lib/database-postgres.js';
import { authReturn } from '../lib/auth-return.js';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const learner = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const secret = 'a'.repeat(64), wrongSecret = 'b'.repeat(64);

test('authentication return paths allow shared flows and reject open redirects', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/shared/../admin', '/shared/%2f%2fevil.test', null, '/admin', '/shared/' + 'a'.repeat(64) + '?save=1&next=https://evil.test']) assert.equal(authReturn(value), '/');
  for (const value of ['/shared/' + 'a'.repeat(64), '/shared/' + 'a'.repeat(64) + '?save=1', '/shared/practice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']) assert.equal(authReturn(value), value);
});

test('shared lists, guest practices and account transfers stay isolated', async t => {
  const engine = new PGlite();
  try {
    await engine.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${owner}'),('${learner}'),('${outsider}');`);
    for (const name of ['202610090001_vocabulary', '202610090002_account_progress', '202610100001_practice_modes', '202610130001_word_lists', '202610140001_list_practice_source', '202610290001_shared_lists']) {
      await engine.exec(readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
    }
    // The migration can be safely applied again.
    await engine.exec(readFileSync(new URL('../supabase/migrations/202610290001_shared_lists.sql', import.meta.url), 'utf8'));
    await engine.exec(`INSERT INTO vocpt.words (portuguese,english,ukrainian) VALUES
      ('casa','house','будинок'),('água','water','вода'),('pão','bread','хліб'),('gato','cat','кіт'),('sol','sun','сонце');`);
    const query = async (sql, values = []) => { const r = await engine.query(sql, values); return { rows: r.rows, rowCount: r.affectedRows }; };
    const pool = { query, async connect() { return { query, release() {} }; } };
    const shares = createSharedLists(pool);
    const lists = createWordLists(pool, owner);
    const listId = await lists.createList('Everyday words');
    for (const id of [1,2,3]) await lists.addWord(listId, id);
    let token;
    const count = async table => Number((await query(`SELECT COUNT(*) AS total FROM vocpt.${table}`)).rows[0].total);
    await t.test('only owners can publish or revoke; links are stable, private and replaceable', async () => {
      await assert.rejects(shares.enableShare(listId, learner));
      await assert.rejects(shares.enableShare(listId, null));
      assert.equal(await shares.getPublicList(String(listId)), null);
      token = await shares.enableShare(listId, owner);
      assert.match(token, /^[a-f0-9]{64}$/);
      assert.equal(await shares.enableShare(listId, owner), token);
      assert.equal(await shares.getShare(listId, learner), null);
      assert.equal(await shares.getShare(listId, owner), token);
      const publicList = await shares.getPublicList(token);
      assert.equal(publicList.isOwner, false);
      assert.equal(publicList.name, 'Everyday words');
      assert.equal(publicList.words.length, 3);
      assert.equal('user_id' in publicList, false);
      assert.equal((await shares.getPublicList(token, owner)).isOwner, true);
      await assert.rejects(shares.disableShare(listId, learner));
      await shares.disableShare(listId, owner);
      assert.equal(await shares.getPublicList(token), null);
      await assert.rejects(shares.start(token, { guestSecret: secret }));
      const old = token;
      token = await shares.enableShare(listId, owner);
      assert.notEqual(token, old);
    });
    await t.test('saving makes an independent copy and repeated saves open the same copy', async () => {
      await assert.rejects(shares.saveList(token, null));
      const id = await shares.saveList(token, learner);
      assert.notEqual(id, listId);
      assert.equal(await shares.saveList(token, learner), id);
      assert.equal(await shares.saveList(token, owner), listId);
      await lists.renameList(listId, 'Updated title');
      await lists.addWord(listId, 4);
      const copy = await createWordLists(pool, learner).getList(id);
      assert.equal(copy.name, 'Everyday words');
      assert.equal(copy.words.length, 3);
      assert.equal((await shares.getPublicList(token)).words.length, 4);
      await createWordLists(pool, learner).removeWord(id, 1);
      assert.equal((await lists.getList(listId)).words.length, 4);
    });
    const completed = [];
    for (const mode of ['self-assessment','multiple-choice','matching']) {
      await t.test(`${mode}: guests resume privately and never write account progress`, async () => {
        const id = await shares.start(token, { mode, guestSecret: secret });
        assert.equal(await shares.getPractice(id, null, wrongSecret), null);
        assert.equal(await shares.getPractice(id, owner, null), null);
        await assert.rejects(shares.submit(id, owner, wrongSecret, {}));
        await assert.rejects(shares.claim(id, learner, secret));
        const session = await shares.getPractice(id, null, secret);
        assert.equal(session.index, 0);
        assert.equal(session.words.length, 4);
        assert.equal('guest_hash' in session, false);
        const word = session.words[0];
        if (mode === 'matching') {
          const attempts = session.words.map(w => ({ wordId: w.id, translationId: w.id })).reverse();
          const input = { attempts, language: 'uk', roundSize: 4 };
          await assert.rejects(shares.submit(id, null, secret, { ...input, attempts: attempts.slice(1) }));
          await shares.submit(id, null, secret, input);
          await shares.submit(id, null, secret, input);
        } else {
          const last = session.words.at(-1);
          await assert.rejects(shares.submit(id, null, secret, { wordId: last.id, known: true, revealed: false, optionId: last.id, language: 'en' }));
          for (const [index, w] of session.words.entries()) {
            const input = mode === 'multiple-choice' ? { wordId: w.id, optionId: w.id, language: 'en' } : { wordId: w.id, known: index ? true : null, revealed: index === 1 };
            if (mode === 'multiple-choice') await assert.rejects(shares.submit(id, null, secret, { ...input, optionId: 999999 }));
            await shares.submit(id, null, secret, input);
            await shares.submit(id, null, secret, input);
          }
          await assert.rejects(shares.submit(id, null, secret, { wordId: word.id, known: false, revealed: false, optionId: 999999, language: 'en' }));
        }
        const saved = await shares.getPractice(id, null, secret);
        assert.equal(saved.index, 4);
        assert.equal(saved.answers.length, mode === 'self-assessment' ? 3 : 4);
        assert.equal(await count('sessions'), 0);
        assert.equal(await count('answers'), 0);
        completed.push(id);
      });
    }
    await t.test('claim transfers completed guest progress once into the learner account', async () => {
      for (const id of completed) {
        await assert.rejects(shares.claim(id, outsider, wrongSecret));
        await shares.claim(id, learner, secret);
        const before = await count('answers');
        await shares.claim(id, learner, secret);
        assert.equal(await count('answers'), before);
        await assert.rejects(shares.claim(id, outsider, secret));
        assert.equal(await shares.getPractice(id, null, secret), null);
        assert.equal((await shares.getPractice(id, learner, null)).signedIn, true);
      }
      assert.equal(await count('sessions'), 3);
      assert.equal(await count('answers'), 11);
      assert.equal((await createPostgresDatabase(pool, { userId: owner }).getWordProgress()).total, 5);
      const rows = await query('SELECT DISTINCT user_id FROM vocpt.sessions');
      assert.deepEqual(rows.rows.map(row => row.user_id), [learner]);
      assert.ok((await createPostgresDatabase(pool, { userId: learner }).getSessionHistory()).length > 0);
    });
    await t.test('signed-in practices save every answer to the visitor and route back to shared practice', async () => {
      for (const mode of ['self-assessment','multiple-choice','matching']) {
        const id = await shares.start(token, { userId: outsider, mode });
        const session = await shares.getPractice(id, outsider);
        assert.equal(await shares.getPractice(id, learner, secret), null);
        await assert.rejects(shares.submit(id, learner, secret, {}));
        if (mode === 'matching') {
          await shares.submit(id, outsider, null, { attempts: session.words.map(w => ({ wordId: w.id, translationId: w.id })), language: 'en', roundSize: session.words.length });
        } else {
          for (const word of session.words) await shares.submit(id, outsider, null, mode === 'multiple-choice' ? { wordId: word.id, optionId: word.id, language: 'uk' } : { wordId: word.id, known: true, revealed: false });
        }
        const normal = (await query('SELECT account_session_id FROM vocpt.shared_practices WHERE id=$1', [id])).rows[0].account_session_id;
        assert.equal(await shares.findAccountPractice(normal, outsider), id);
        assert.equal(await shares.findAccountPractice(normal, learner), null);
        assert.equal((await createPostgresDatabase(pool, { userId: outsider }).getPractice(normal)).answers.length, 4);
      }
      assert.equal((await query('SELECT COUNT(*) AS n FROM vocpt.sessions WHERE user_id=$1', [owner])).rows[0].n, 0);
    });
    await t.test('a failed account round rolls back both the account writes and shared state', async () => {
      const id = await shares.start(token, { userId: outsider, mode: 'matching' });
      const session = await shares.getPractice(id, outsider);
      const input = { attempts: session.words.map(word => ({ wordId: word.id, translationId: word.id })), language: 'en', roundSize: 4 };
      let writes = 0;
      const failingQuery = async (sql, values) => {
        if (sql.startsWith('INSERT INTO vocpt.answers') && ++writes === 2) throw new Error('Injected failure');
        return query(sql, values);
      };
      const failing = createSharedLists({ query: failingQuery, async connect() { return { query: failingQuery, release() {} }; } });
      await assert.rejects(failing.submit(id, outsider, null, input), /Injected failure/);
      assert.equal((await shares.getPractice(id, outsider)).index, 0);
      const normal = (await query('SELECT account_session_id FROM vocpt.shared_practices WHERE id=$1', [id])).rows[0].account_session_id;
      assert.equal((await createPostgresDatabase(pool, { userId: outsider }).getPractice(normal)).answers.length, 0);
      await shares.submit(id, outsider, null, input);
      assert.equal((await shares.getPractice(id, outsider)).answers.length, 4);
    });
    await t.test('editing the source does not change a practice already in progress', async () => {
      const id = await shares.start(token, { guestSecret: secret });
      const session = await shares.getPractice(id, null, secret);
      const word = session.words[0];
      await lists.removeWord(listId, word.id);
      await lists.renameList(listId, 'Changed during practice');
      assert.equal((await shares.getPublicList(token)).words.length, 3);
      const snapshot = await shares.getPractice(id, null, secret);
      assert.equal(snapshot.name, 'Updated title');
      assert.equal(snapshot.words.length, 4);
      await shares.submit(id, null, secret, { wordId: word.id, known: true, revealed: false });
      await lists.addWord(listId, word.id);
      await lists.renameList(listId, 'Updated title');
    });
    await t.test('revocation blocks new access while snapshots and copied lists survive', async () => {
      const id = await shares.start(token, { guestSecret: secret });
      await shares.disableShare(listId, owner);
      await assert.rejects(shares.start(token, { guestSecret: secret }));
      await assert.rejects(shares.saveList(token, outsider));
      const session = await shares.getPractice(id, null, secret);
      await shares.submit(id, null, secret, { wordId: session.words[0].id, known: true, revealed: false });
      assert.equal((await shares.getPractice(id, null, secret)).index, 1);
      assert.equal((await createWordLists(pool, learner).getLists()).length, 1);
      token = await shares.enableShare(listId, owner);
    });
    await t.test('expired guests cannot resume, answer or claim; invalid and empty starts fail', async () => {
      const id = await shares.start(token, { guestSecret: secret });
      await query("UPDATE vocpt.shared_practices SET expires_at=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '1 minute' WHERE id=$1", [id]);
      assert.equal(await shares.getPractice(id, null, secret), null);
      await assert.rejects(shares.submit(id, null, secret, { wordId: 1, known: true, revealed: false }));
      await assert.rejects(shares.claim(id, learner, secret));
      for (const settings of [{}, { guestSecret: 'bad' }, { guestSecret: secret, count: 999 }, { guestSecret: secret, mode: 'bogus' }]) await assert.rejects(shares.start(token, settings));
      const empty = await lists.createList('Empty');
      await assert.rejects(shares.start(await shares.enableShare(empty, owner), { guestSecret: secret }));
      const short = await lists.createList('Short');
      await lists.addWord(short, 1);
      const shortId = await shares.start(await shares.enableShare(short, owner), { guestSecret: secret });
      assert.equal((await shares.getPractice(shortId, null, secret)).words.length, 1);
      assert.equal((await query('SELECT id FROM vocpt.shared_practices WHERE id=$1', [id])).rows.length, 0);
    });
  } finally { await engine.close(); }
});
