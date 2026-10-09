import nextEnv from '@next/env';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { getPostgresPool, closePostgresPool } from '../lib/postgres.js';
import { migrationTables } from '../lib/sqlite-migration.js';

nextEnv.loadEnvConfig(process.cwd());
let client;
try {
  client = await getPostgresPool().connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  const backup = {};
  for (const { name } of migrationTables) backup[name] = (await client.query(`SELECT * FROM vocpt.${name}`)).rows;
  mkdirSync('data/backups', { recursive: true });
  const backupPath = `data/backups/before-auth-${new Date().toISOString().replaceAll(':', '-')}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await client.query(readFileSync(new URL('../supabase/migrations/202610090002_account_progress.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log(JSON.stringify({ applied: true, backup: backupPath, legacy_sessions: backup.sessions.filter((session) => !session.user_id).length }));
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error(`Auth setup failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await closePostgresPool();
}
