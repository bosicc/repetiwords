import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const { getWords } = await import('../lib/database.js');
const { closePostgresPool } = await import('../lib/postgres.js');
try {
  console.log(`Supabase PostgreSQL database ready: ${(await getWords()).length} words`);
} finally { await closePostgresPool(); }
