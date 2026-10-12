import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { readAdminUsers } from '../lib/admin-users.js';

const admin = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'b.pratsiuk@gmail.com', email_confirmed_at: '2026-10-12T10:00:00Z' };
const accountId = (index) => `${String(index).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

async function fixture() {
  const engine = new PGlite();
  await engine.exec(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY, email TEXT, email_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ,
      encrypted_password TEXT DEFAULT 'fixture-only-hash',
      raw_user_meta_data JSONB DEFAULT '{"private":"fixture-only"}'
    )`);
  for (const file of ['202610090001_vocabulary.sql', '202610090002_account_progress.sql', '202610100001_practice_modes.sql']) {
    await engine.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  return engine;
}

const poolFor = (engine) => ({ query: (sql, values) => engine.query(sql, values) });

test('user listings reject other accounts, unconfirmed owners and metadata spoofs before querying', async () => {
  let calls = 0;
  const pool = { async query() { calls++; throw new Error('Unexpected SQL'); } };
  for (const user of [
    null, undefined, {}, { ...admin, id: '' }, { ...admin, email_confirmed_at: null },
    { ...admin, email: 'another@example.com' },
    { ...admin, email: 'another@example.com', user_metadata: { email: admin.email, is_super_admin: true }, app_metadata: { role: 'superadmin' } },
  ]) await assert.rejects(readAdminUsers(pool, user), /Admin access denied/);
  assert.equal(calls, 0);
  await assert.rejects(readAdminUsers(pool, admin, { query: {} }), /Invalid user search/);
  assert.equal(calls, 0);
});

test('pagination returns stable non-overlapping pages and clamps to the valid last page', async () => {
  const engine = await fixture();
  try {
    await engine.exec(`INSERT INTO auth.users (id, email, created_at)
      SELECT md5(n::text)::uuid, 'learner-' || LPAD(n::text, 2, '0') || '@example.com',
        '2026-10-01T00:00:00Z'::timestamptz + n * INTERVAL '1 hour' FROM generate_series(1, 45) n`);
    const pool = poolFor(engine);
    const pages = [];
    for (const page of [1, 2, 3]) pages.push(await readAdminUsers(pool, admin, { page }));
    const expectedEmails = (high, low) => Array.from({ length: high - low + 1 }, (_, index) => `learner-${String(high - index).padStart(2, '0')}@example.com`);
    assert.deepEqual(pages[0].users.map((user) => user.email), expectedEmails(45, 26));
    assert.deepEqual(pages[1].users.map((user) => user.email), expectedEmails(25, 6));
    assert.deepEqual(pages[2].users.map((user) => user.email), expectedEmails(5, 1));
    assert.equal(new Set(pages.flatMap((page) => page.users.map((user) => user.id))).size, 45);
    for (const result of pages) {
      assert.equal(result.total, 45);
      assert.equal(result.pageSize, 20);
      assert.equal(result.totalPages, 3);
    }
    assert.deepEqual(await readAdminUsers(pool, admin, { page: 99999 }), pages[2]);
    for (const page of [0, -1, NaN, Infinity, 1.5]) assert.deepEqual(await readAdminUsers(pool, admin, { page }), pages[0]);
    assert.deepEqual(await readAdminUsers(pool, admin, { query: 'learner-45', page: 99999 }), { ...pages[0], users: pages[0].users.slice(0, 1), total: 1, page: 1, totalPages: 1 });
  } finally { await engine.close(); }
});

test('email search is case-insensitive and treats wildcards and SQL-looking input as literal text', async () => {
  const engine = await fixture();
  try {
    const emails = ['Learner@One.Example', 'user%tag@example.com', 'user_tag@example.com', "o'hara@example.com", "'; DROP TABLE auth.users; --@example.com"];
    for (const [index, email] of emails.entries()) {
      await engine.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [accountId(index + 1), email]);
    }
    const pool = poolFor(engine);
    for (const [query, expected] of [[' LEARNER@ONE ', [emails[0]]], ['%', [emails[1]]], ['_', [emails[2]]], ["o'hara", [emails[3]]], ["'; DROP TABLE auth.users; --", [emails[4]]], ["' OR 1=1 --", []]]) {
      const result = await readAdminUsers(pool, admin, { query });
      assert.deepEqual(result.users.map((user) => user.email), expected);
      assert.equal(result.total, expected.length);
    }
    assert.equal((await engine.query('SELECT COUNT(*) AS count FROM auth.users')).rows[0].count, emails.length);
  } finally { await engine.close(); }
});

test('listed users expose only approved fields, normalized dates and their own session counts without mutations', async () => {
  const engine = await fixture();
  try {
    await engine.query(`INSERT INTO auth.users (id, email, email_confirmed_at, created_at, last_sign_in_at) VALUES
      ($1, 'first@example.com', '2026-10-12T10:00:00+01:00', '2026-10-11T10:00:00+01:00', '2026-10-12T11:30:00+01:00'),
      ($2, NULL, NULL, NULL, NULL),
      ($3, 'third@example.com', NULL, '2026-10-11T09:00:00Z', NULL)`, [accountId(1), accountId(2), accountId(3)]);
    await engine.query(`INSERT INTO vocpt.sessions (user_id) VALUES ($1), ($1), ($2), (NULL), (NULL)`, [accountId(1), accountId(3)]);
    const snapshot = async () => ({
      users: (await engine.query('SELECT * FROM auth.users ORDER BY id')).rows,
      sessions: (await engine.query('SELECT * FROM vocpt.sessions ORDER BY id')).rows,
    });
    const before = await snapshot();
    let calls = 0;
    const pool = { async query(sql, values) { calls++; return engine.query(sql, values); } };
    await engine.exec('BEGIN READ ONLY');
    const result = await readAdminUsers(pool, { ...admin, email: 'B.PRATSIUK@GMAIL.COM' });
    await engine.exec('COMMIT');
    assert.equal(calls, 1);
    assert.deepEqual(result.users, [
      { id: accountId(1), email: 'first@example.com', emailConfirmed: true, createdAt: '2026-10-11T09:00:00.000Z', lastSignInAt: '2026-10-12T10:30:00.000Z', sessions: 2 },
      { id: accountId(3), email: 'third@example.com', emailConfirmed: false, createdAt: '2026-10-11T09:00:00.000Z', lastSignInAt: null, sessions: 1 },
      { id: accountId(2), email: null, emailConfirmed: false, createdAt: null, lastSignInAt: null, sessions: 0 },
    ]);
    assert.equal(result.total, 3);
    assert.ok(result.users.every((user) => Number.isInteger(user.sessions)));
    assert.deepEqual(await snapshot(), before);
  } finally { await engine.close(); }
});

test('an empty user listing returns an empty first page and a consistent page size', async () => {
  const engine = await fixture();
  try {
    assert.deepEqual(await readAdminUsers(poolFor(engine), admin, { page: 99999 }), { users: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  } finally { await engine.close(); }
});
