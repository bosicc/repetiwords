import { getAuthConfig } from './supabase/config.js';

async function emailConfirmationRequired() {
  const { url, key } = getAuthConfig();
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not verify Supabase email confirmation settings.');
  const settings = await response.json();
  return settings.mailer_autoconfirm === false;
}

// Call only with a user verified by Supabase Auth. Never infer ownership from a form.
export async function claimLegacyProgress(pool, user, {
  ownerEmail = process.env.LEGACY_PROGRESS_EMAIL,
  verifyConfirmation = emailConfirmationRequired,
} = {}) {
  if (!ownerEmail || !user.email_confirmed_at || user.email?.toLowerCase() !== ownerEmail.trim().toLowerCase()) return false;
  const existing = await pool.query('SELECT id FROM vocpt.legacy_progress_claims WHERE id = 1');
  if (existing.rows.length) return false;
  if (!await verifyConfirmation()) throw new Error('Enable Supabase email confirmation before transferring legacy progress.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('INSERT INTO vocpt.legacy_progress_claims (id, user_id) VALUES (1, $1) ON CONFLICT (id) DO NOTHING RETURNING id', [user.id]);
    if (rows.length) await client.query('UPDATE vocpt.sessions SET user_id = $1 WHERE user_id IS NULL', [user.id]);
    await client.query('COMMIT');
    return rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
