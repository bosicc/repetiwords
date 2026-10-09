import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

let pool;

export function getPostgresPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('Set DATABASE_URL to the Supabase PostgreSQL connection string.');
  if (!pool) {
    const url = new URL(connectionString);
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    // Configure TLS explicitly; URL SSL options would override the certificate settings.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: local ? false : { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replaceAll('\\n', '\n') } : {}) },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    pool.on('error', () => console.error('An idle PostgreSQL connection failed.'));
  }
  return pool;
}

export async function closePostgresPool() {
  if (pool) await pool.end();
  pool = undefined;
}

const numericFields = new Set(['attempts', 'correct', 'history', 'needs_review', 'answers', 'known', 'mistakes', 'total', 'completed']);

export function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof Date) value = value.toISOString().slice(0, 19).replace('T', ' ');
    if (value !== null && numericFields.has(key)) value = Number(value);
    return [key, value];
  })));
}

// All SQL comes from this repository; only values are supplied by callers.
// '?' markers keep queries readable and are sent as PostgreSQL bound parameters.
export function createQueryAdapter(pool) {
  const transactions = new AsyncLocalStorage();
  async function query(text, ...values) {
    let position = 0;
    const sql = text.replaceAll('?', () => `$${++position}`);
    if (position !== values.length) throw new Error('SQL parameter count mismatch');
    const connection = transactions.getStore() || pool;
    return connection.query(sql, values);
  }
  return {
    async all(text, ...values) { return normalizeRows((await query(text, ...values)).rows); },
    async get(text, ...values) { return normalizeRows((await query(text, ...values)).rows)[0]; },
    async run(text, ...values) {
      const result = await query(text, ...values);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    },
    transaction(callback) {
      return async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await transactions.run(client, callback);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      };
    },
  };
}
