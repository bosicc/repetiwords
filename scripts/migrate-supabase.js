import nextEnv from '@next/env';
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getPostgresPool, closePostgresPool } from '../lib/postgres.js';
import { readSqliteSnapshot, snapshotManifest, migrateSnapshot, verifySnapshot } from '../lib/sqlite-migration.js';

nextEnv.loadEnvConfig(process.cwd());
let source;
let backupSource;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--dry-run', '--verify'].includes(arg)) || (args.includes('--dry-run') && args.includes('--verify'))) {
    throw new Error('Usage: npm run db:migrate:supabase -- [--dry-run | --verify]');
  }
  const sourcePath = resolve(process.env.SQLITE_SOURCE_PATH || join(process.env.VOCPT_DATA_DIR || 'data', 'vocabulary.sqlite'));
  source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ dry_run: true, source: sourcePath, tables: snapshotManifest(readSqliteSnapshot(source)) }, null, 2));
  } else if (args.includes('--verify')) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const tables = await verifySnapshot(client, readSqliteSnapshot(source));
      await client.query('COMMIT');
      console.log(JSON.stringify({ verified: true, tables }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  } else {
    // Validate configuration before making a backup. Never print database credentials.
    const pool = getPostgresPool();
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const backupDirectory = join(dirname(sourcePath), 'backups');
    mkdirSync(backupDirectory, { recursive: true });
    const backup = join(backupDirectory, `before-supabase-${stamp}.sqlite`);
    await source.backup(backup);
    backupSource = new Database(backup, { readonly: true, fileMustExist: true });
    const tables = await migrateSnapshot(pool, readSqliteSnapshot(backupSource));
    const report = { migrated: true, source: sourcePath, backup, tables };
    const reportPath = join(backupDirectory, `supabase-migration-${stamp}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ ...report, report: reportPath }, null, 2));
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  backupSource?.close();
  source?.close();
  await closePostgresPool();
}
