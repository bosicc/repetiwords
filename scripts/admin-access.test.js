import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSuperAdmin, getSuperAdmin } from '../lib/admin-access.js';

const admin = { id: 'verified-account', email: 'b.pratsiuk@gmail.com', email_confirmed_at: '2026-10-12T10:00:00Z' };

test('super admin requires an identified account with the exact confirmed owner email', () => {
  assert.equal(isSuperAdmin(admin), true);
  assert.equal(isSuperAdmin({ ...admin, email: ' B.PRATSIUK@GMAIL.COM ' }), true);
  for (const user of [
    undefined, null, {},
    { ...admin, id: undefined }, { ...admin, id: '' }, { ...admin, id: 1 },
    { ...admin, email: undefined }, { ...admin, email: '' }, { ...admin, email: 1 },
    { ...admin, email: 'other@example.com' }, { ...admin, email: 'b.pratsiuk@gmail.com.attacker.example' },
    { ...admin, email: 'b.pratsiuk+admin@gmail.com' },
    { ...admin, email_confirmed_at: undefined }, { ...admin, email_confirmed_at: '' },
    { ...admin, email_confirmed_at: null }, { ...admin, email_confirmed_at: true },
    { id: admin.id, email: admin.email, confirmed_at: admin.email_confirmed_at },
    { id: admin.id, user_metadata: { email: admin.email, email_confirmed_at: admin.email_confirmed_at, role: 'superadmin' } },
    { ...admin, email: 'other@example.com', app_metadata: { role: 'superadmin' }, user_metadata: { email: admin.email, is_super_admin: true } },
  ]) assert.equal(isSuperAdmin(user), false);
});

test('confirmation verifier is never called for users without admin identity', async () => {
  let calls = 0;
  const verifier = async () => { calls++; return true; };
  for (const user of [null, {}, { ...admin, email: 'other@example.com' }, { ...admin, email_confirmed_at: null }]) {
    assert.equal(await getSuperAdmin(user, verifier), null);
  }
  assert.equal(calls, 0);
});

test('only strict successful confirmation verification grants admin access', async () => {
  let calls = 0;
  const verified = await getSuperAdmin(admin, async () => { calls++; return true; });
  assert.equal(verified, admin);
  assert.equal(calls, 1);
  for (const result of [false, null, undefined, 1, 'true', {}, { enabled: true }]) {
    assert.equal(await getSuperAdmin(admin, async () => result), null);
  }
  assert.equal(await getSuperAdmin(admin, async () => { throw new Error('Provider unavailable'); }), null);
});
