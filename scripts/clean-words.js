import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { cleanVocabulary } from '../lib/word-cleanup.js';
import { validateBatch } from '../lib/word-import.js';

const [file] = process.argv.slice(2);
if (!file || process.argv.length !== 3) throw new Error('Usage: node scripts/clean-words.js <cleanup-batch.json>');
const batch = JSON.parse(readFileSync(file, 'utf8'));
validateBatch(batch);
const directory = process.env.VOCPT_DATA_DIR || join(process.cwd(), 'data');
const backupDirectory = join(directory, 'backups');
mkdirSync(backupDirectory, { recursive: true });
const backup = join(backupDirectory, `before-word-cleanup-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
const db = new Database(join(directory, 'vocabulary.sqlite'), { fileMustExist: true });
db.pragma('foreign_keys = ON');
try {
  await db.backup(backup);
  const result = { backup: resolve(backup), ...cleanVocabulary(db, batch) };
  const reportPath = file.replace(/\.json$/, '') + `-report-${Date.now()}.json`;
  writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...result, report: reportPath }, null, 2));
} finally { db.close(); }
