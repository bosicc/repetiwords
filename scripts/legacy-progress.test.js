import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { claimLegacyProgress } from '../lib/legacy-progress.js';

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ownerEmail = 'owner@example.com';
const confirmed = { id: ownerId, email: ownerEmail, email_confirmed_at: '2026-10-09T12:00:00Z' };

async function fixture() {
  const engine = new PGlite();
  await engine.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${ownerId}'), ('${otherId}');`);
  for (const file of ['202610090001_vocabulary.sql', '202610090002_account_progress.sql']) {
    await engine.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await engine.exec(`INSERT INTO vocpt.sessions (id, user_id) VALUES (1, NULL), (2, '${otherId}');`);
  const query = (sql, values = []) => engine.query(sql, values);
  const pool = { query, async connect() { return { query, release() {} }; } };
  return { engine, pool };
}

test('legacy progress transfers only once to the explicitly configured confirmed email', async () => {
  const { engine, pool } = await fixture();
  const options = { ownerEmail: ' OWNER@example.com ', verifyConfirmation: async () => true };
  try {
    assert.equal(await claimLegacyProgress(pool, { ...confirmed, email: 'another@example.com' }, options), false);
    assert.equal(await claimLegacyProgress(pool, { ...confirmed, email_confirmed_at: null }, options), false);
    assert.equal(await claimLegacyProgress(pool, confirmed, options), true);
    assert.deepEqual((await pool.query('SELECT id, user_id FROM vocpt.sessions ORDER BY id')).rows, [{ id: 1, user_id: ownerId }, { id: 2, user_id: otherId }]);
    await pool.query('INSERT INTO vocpt.sessions (id) VALUES (3)');
    assert.equal(await claimLegacyProgress(pool, confirmed, options), false);
    assert.equal((await pool.query('SELECT user_id FROM vocpt.sessions WHERE id = 3')).rows[0].user_id, null);
  } finally { await engine.close(); }
});

test('auto-confirmed email settings cannot claim legacy progress', async () => {
  const { engine, pool } = await fixture();
  try {
    await assert.rejects(claimLegacyProgress(pool, confirmed, { ownerEmail, verifyConfirmation: async () => false }), /Enable Supabase email confirmation/);
    assert.equal((await pool.query('SELECT user_id FROM vocpt.sessions WHERE id = 1')).rows[0].user_id, null);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM vocpt.legacy_progress_claims')).rows[0].count, 0);
  } finally { await engine.close(); }
});
