import nextEnv from '@next/env';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { getPostgresPool, closePostgresPool, normalizeRows } from '../lib/postgres.js';

nextEnv.loadEnvConfig(process.cwd());
let client;
try {
  client = await getPostgresPool().connect();
  await client.query('BEGIN');
  // Serialize session writes while taking the metadata backup and adding the column.
  await client.query('LOCK TABLE vocpt.sessions IN ACCESS EXCLUSIVE MODE');
  const sessions = normalizeRows((await client.query('SELECT * FROM vocpt.sessions ORDER BY id')).rows);
  mkdirSync('data/backups', { recursive: true });
  const backupPath = `data/backups/before-practice-modes-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`;
  writeFileSync(backupPath, JSON.stringify({ sessions }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await client.query(readFileSync(new URL('../supabase/migrations/202610100001_practice_modes.sql', import.meta.url), 'utf8'));
  const updated = normalizeRows((await client.query('SELECT * FROM vocpt.sessions ORDER BY id')).rows);
  assert.deepEqual(updated, sessions.map((session) => ({ ...session, practice_mode: session.practice_mode ?? 'self-assessment' })), 'Session metadata changed unexpectedly');
  await client.query('COMMIT');
  console.log(JSON.stringify({ applied: true, backup: backupPath, sessions: updated.length }));
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error(`Practice mode setup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await closePostgresPool();
}
