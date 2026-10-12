import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { readAdminOverview } from '../lib/admin-overview.js';

const admin = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'b.pratsiuk@gmail.com',
  email_confirmed_at: '2026-10-12T10:00:00Z',
};

async function fixture() {
  const engine = new PGlite();
  await engine.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY)');
  for (const file of ['202610090001_vocabulary.sql', '202610090002_account_progress.sql', '202610100001_practice_modes.sql']) {
    await engine.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  return engine;
}

test('admin overview rejects unauthorized, unconfirmed and metadata-spoofed users before any query', async () => {
  let calls = 0;
  const pool = { async query() { calls++; throw new Error('Unexpected SQL call'); } };
  for (const user of [
    undefined, null, {},
    { ...admin, email: 'another@example.com' },
    { ...admin, email: 'b.pratsiuk@gmail.com.attacker.example' },
    { ...admin, email_confirmed_at: null },
    { ...admin, email_confirmed_at: '' },
    { ...admin, id: '' },
    { id: 'other', email: 'other@example.com', email_confirmed_at: admin.email_confirmed_at,
      user_metadata: { email: admin.email, role: 'superadmin', is_super_admin: true },
      app_metadata: { role: 'superadmin' } },
    { id: 'other', user_metadata: { ...admin } },
  ]) {
    await assert.rejects(readAdminOverview(pool, user), /Admin access denied/);
  }
  assert.equal(calls, 0);
});

test('confirmed admin gets exact aggregate counts and ordered modes from one read-only snapshot', async () => {
  const engine = await fixture();
  try {
    await engine.exec(`INSERT INTO auth.users VALUES
        ('${admin.id}'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      INSERT INTO vocpt.users (name) VALUES ('Legacy learner');
      INSERT INTO vocpt.words (id, portuguese, english, ukrainian) VALUES
        (1, 'pão', 'bread', NULL), (2, 'olá', '   ', 'привіт'),
        (3, 'casa', E'\\t\\n', E' \\t '), (4, 'livro', ' book ', ''), (5, 'água', 'water', 'вода');
      INSERT INTO vocpt.groups (name) VALUES ('Daily life'), ('Food');
      INSERT INTO vocpt.sessions (id, user_id, practice_mode) VALUES
        (1, NULL, 'self-assessment'), (2, '${admin.id}', 'self-assessment'),
        (3, '${admin.id}', 'matching'), (4, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'matching'),
        (5, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'matching');`);
    const snapshot = async () => {
      const tables = {};
      for (const table of ['auth.users', 'vocpt.users', 'vocpt.words', 'vocpt.groups', 'vocpt.sessions']) {
        tables[table] = (await engine.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
      }
      return tables;
    };
    const before = await snapshot();
    let calls = 0;
    const pool = { async query(sql) { calls++; return engine.query(sql); } };
    await engine.exec('BEGIN READ ONLY');
    const overview = await readAdminOverview(pool, { ...admin, email: ' B.PRATSIUK@GMAIL.COM ' });
    await engine.exec('COMMIT');
    assert.equal(calls, 1);
    assert.deepEqual(overview, {
      words: 5, categories: 2, accounts: 3, sessions: 5,
      englishTranslations: 3, ukrainianTranslations: 2, unassignedSessions: 1,
      sessionModes: [{ mode: 'self-assessment', count: 2 }, { mode: 'multiple-choice', count: 0 }, { mode: 'matching', count: 3 }],
    });
    assert.ok(Object.entries(overview).filter(([key]) => key !== 'sessionModes').every(([, value]) => Number.isInteger(value)));
    assert.deepEqual(await snapshot(), before);
  } finally { await engine.close(); }
});

test('empty databases still return integer zeros and all supported session modes', async () => {
  const engine = await fixture();
  try {
    const overview = await readAdminOverview({ query: (sql) => engine.query(sql) }, admin);
    assert.deepEqual(overview, {
      words: 0, categories: 0, accounts: 0, sessions: 0,
      englishTranslations: 0, ukrainianTranslations: 0, unassignedSessions: 0,
      sessionModes: [{ mode: 'self-assessment', count: 0 }, { mode: 'multiple-choice', count: 0 }, { mode: 'matching', count: 0 }],
    });
  } finally { await engine.close(); }
});
