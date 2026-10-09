import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeRows } from './postgres.js';

export const migrationTables = [
  { name: 'users', columns: ['id', 'name', 'email', 'created_at'], keys: ['id'] },
  { name: 'words', columns: ['id', 'portuguese', 'english', 'level', 'ukrainian', 'mastery_level'], keys: ['id'] },
  { name: 'sessions', columns: ['id', 'created_at'], keys: ['id'] },
  { name: 'groups', columns: ['id', 'name'], keys: ['id'] },
  { name: 'word_groups', columns: ['word_id', 'group_id'], keys: ['word_id', 'group_id'] },
  { name: 'answers', columns: ['id', 'session_id', 'word_id', 'known', 'created_at', 'revealed'], keys: ['id'] },
  { name: 'archived_words', columns: ['id', 'original_word_id', 'record_json', 'archived_at'], keys: ['id'] },
  { name: 'archived_answers', columns: ['id', 'original_answer_id', 'archive_word_id', 'session_id', 'known', 'revealed', 'created_at'], keys: ['id'] },
  { name: 'session_words', columns: ['session_id', 'word_id', 'position', 'completed'], keys: ['session_id', 'word_id'] },
];

export function readSqliteSnapshot(source) {
  return source.transaction(() => {
    const integrity = source.pragma('integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
    if (source.pragma('foreign_key_check').length) throw new Error('SQLite contains broken foreign keys');
    return Object.fromEntries(migrationTables.map(({ name, columns, keys }) => {
      const actual = source.pragma(`table_info(${name})`).map((column) => column.name);
      if (actual.length !== columns.length || columns.some((column) => !actual.includes(column))) {
        throw new Error(`Unexpected SQLite schema for ${name}; initialize or review the source before migrating.`);
      }
      const rows = source.prepare(`SELECT ${columns.join(', ')} FROM ${name} ORDER BY ${keys.join(', ')}`).all();
      // PostgreSQL INTEGER IDs are deliberately bounded; never silently truncate SQLite integers.
      for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647)) {
            throw new Error(`Value outside PostgreSQL INTEGER range: ${name}.${key}`);
          }
        }
      }
      return [name, rows];
    }));
  })();
}

function fingerprint(rows, columns) {
  const hash = createHash('sha256');
  for (const row of normalizeRows(rows)) hash.update(JSON.stringify(columns.map((column) => row[column])) + '\n');
  return hash.digest('hex');
}

export function snapshotManifest(snapshot) {
  return Object.fromEntries(migrationTables.map(({ name, columns }) => [name, {
    rows: snapshot[name].length,
    sha256: fingerprint(snapshot[name], columns),
  }]));
}

export async function verifySnapshot(client, snapshot) {
  const report = {};
  for (const { name, columns, keys } of migrationTables) {
    const { rows } = await client.query(`SELECT ${columns.join(', ')} FROM vocpt.${name} ORDER BY ${keys.join(', ')}`);
    const sha256 = fingerprint(rows, columns);
    if (rows.length !== snapshot[name].length || sha256 !== fingerprint(snapshot[name], columns)) {
      throw new Error(`Data verification failed for ${name}`);
    }
    report[name] = { rows: rows.length, sha256 };
  }
  return report;
}

export async function migrateSnapshot(pool, snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query(readFileSync(new URL('../supabase/migrations/202610090001_vocabulary.sql', import.meta.url), 'utf8'));
    await client.query(`LOCK TABLE ${migrationTables.map(({ name }) => `vocpt.${name}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);
    for (const { name } of migrationTables) {
      const { rows } = await client.query(`SELECT 1 FROM vocpt.${name} LIMIT 1`);
      if (rows.length) throw new Error(`Target vocpt.${name} is not empty. Migration never overwrites existing data.`);
    }
    for (const { name, columns } of migrationTables) {
      const rows = snapshot[name];
      for (let offset = 0; offset < rows.length; offset += 250) {
        const batch = rows.slice(offset, offset + 250);
        const values = batch.flatMap((row) => columns.map((column) => row[column]));
        let parameter = 0;
        const placeholders = batch.map(() => `(${columns.map(() => `$${++parameter}`).join(', ')})`).join(', ');
        await client.query(`INSERT INTO vocpt.${name} (${columns.join(', ')}) VALUES ${placeholders}`, values);
      }
      if (columns.includes('id')) {
        await client.query(`SELECT setval(pg_get_serial_sequence('vocpt.${name}', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM vocpt.${name}`);
      }
    }
    const report = await verifySnapshot(client, snapshot);
    await client.query('COMMIT');
    return report;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
