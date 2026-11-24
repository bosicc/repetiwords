import nextEnv from '@next/env';
import { readFileSync } from 'node:fs';
import { getPostgresPool, closePostgresPool } from '../lib/postgres.js';
import { importSpanishVocabulary } from '../lib/spanish-vocabulary.js';

nextEnv.loadEnvConfig(process.cwd());
const dryRun = process.argv.includes('--dry-run');
let client;
try {
  const batch = JSON.parse(readFileSync(new URL('../imports/2026-11-24-spanish-spain.json', import.meta.url), 'utf8'));
  client = await getPostgresPool().connect();
  await client.query('BEGIN');
  for (const name of ['202611240001_study_languages', '202611240002_account_languages']) {
    await client.query(readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8'));
  }
  const report = await importSpanishVocabulary(client, batch.words);
  await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
  console.log(JSON.stringify({ dryRun, ...report }));
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await closePostgresPool();
}
