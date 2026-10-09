import nextEnv from '@next/env';
import { closePostgresPool } from '../lib/postgres.js';
import { readFileSync } from 'node:fs';
import { validateBatch } from '../lib/word-import.js';

nextEnv.loadEnvConfig(process.cwd());

try {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const files = args.filter((arg) => arg !== '--dry-run');
  if (files.length !== 1 || files[0].startsWith('--')) throw new Error('Usage: npm run words:import -- <batch.json> [--dry-run]');
  const batch = validateBatch(JSON.parse(readFileSync(files[0], 'utf8')));
  const { importWords } = await import('../lib/database.js');
  console.log(JSON.stringify({ file: files[0], source: batch.source, dry_run: dryRun, ...await importWords(batch, { dryRun }) }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await closePostgresPool(); }
