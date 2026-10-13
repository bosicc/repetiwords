import nextEnv from '@next/env';
import { readFileSync } from 'node:fs';
import { getPostgresPool, closePostgresPool } from '../lib/postgres.js';
nextEnv.loadEnvConfig(process.cwd());
let client;
try {
  client = await getPostgresPool().connect();
  await client.query('BEGIN');
  await client.query(readFileSync(new URL('../supabase/migrations/202610130001_word_lists.sql', import.meta.url), 'utf8'));
  await client.query('COMMIT');
  console.log('Personal word lists schema applied.');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error(error.message); process.exitCode = 1;
} finally { client?.release(); await closePostgresPool(); }
