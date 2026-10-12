import { isSuperAdmin } from './admin-access.js';

const pageSize = 20;

function integerCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid admin users count');
  return count;
}

function isoDate(value) {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid admin user date');
  return date.toISOString();
}

export async function readAdminUsers(pool, user, { query = '', page = 1 } = {}) {
  if (!isSuperAdmin(user)) throw new Error('Admin access denied');
  if (typeof query !== 'string') throw new Error('Invalid user search');
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  // Search is a bound literal substring, including %, _, quotes and SQL-looking
  // text. All counts, page boundaries and rows share one statement snapshot.
  const { rows } = await pool.query(`WITH matching_users AS (
      SELECT id, email, email_confirmed_at, created_at, last_sign_in_at FROM auth.users
      WHERE POSITION(LOWER($1) IN LOWER(COALESCE(email, ''))) > 0
    ), totals AS (
      SELECT COUNT(*) AS total FROM matching_users
    ), pagination AS (
      SELECT total, GREATEST(1, CEIL(total / 20.0))::bigint AS total_pages,
        LEAST($2::bigint, GREATEST(1, CEIL(total / 20.0)))::bigint AS page FROM totals
    ), paged_users AS (
      SELECT u.id, u.email, u.email_confirmed_at, u.created_at, u.last_sign_in_at,
        (SELECT COUNT(*) FROM vocpt.sessions s WHERE s.user_id = u.id) AS sessions
      FROM matching_users u ORDER BY u.created_at DESC NULLS LAST, u.id
      LIMIT 20 OFFSET (SELECT (page - 1) * 20 FROM pagination)
    ) SELECT total, page, total_pages AS "totalPages",
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', id, 'email', email, 'emailConfirmed', email_confirmed_at IS NOT NULL,
          'createdAt', created_at, 'lastSignInAt', last_sign_in_at, 'sessions', sessions
        ) ORDER BY created_at DESC NULLS LAST, id), '[]'::jsonb) FROM paged_users) AS users
      FROM pagination`, [query.trim(), requestedPage]);
  const listing = rows[0];
  if (!listing) throw new Error('Admin users unavailable');
  return {
    users: listing.users.map((account) => ({
      id: account.id,
      email: account.email,
      emailConfirmed: Boolean(account.emailConfirmed),
      createdAt: isoDate(account.createdAt),
      lastSignInAt: isoDate(account.lastSignInAt),
      sessions: integerCount(account.sessions),
    })),
    total: integerCount(listing.total),
    page: integerCount(listing.page),
    pageSize,
    totalPages: integerCount(listing.totalPages),
  };
}
