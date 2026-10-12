import { isSuperAdmin } from './admin-access.js';

const countFields = [
  'words', 'categories', 'accounts', 'sessions',
  'englishTranslations', 'ukrainianTranslations', 'unassignedSessions',
];

function integerCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid admin overview count');
  return count;
}

export async function readAdminOverview(pool, user) {
  if (!isSuperAdmin(user)) throw new Error('Admin access denied');
  // PostgreSQL gives all subqueries the same statement snapshot. No mutation or
  // user-level progress is needed for these aggregate administration metrics.
  const { rows } = await pool.query(`WITH modes(mode, position) AS (
      VALUES ('self-assessment', 1), ('multiple-choice', 2), ('matching', 3)
    ), session_counts AS (
      SELECT practice_mode AS mode, COUNT(*) AS count FROM vocpt.sessions GROUP BY practice_mode
    ) SELECT
      (SELECT COUNT(*) FROM vocpt.words) AS words,
      (SELECT COUNT(*) FROM vocpt.groups) AS categories,
      (SELECT COUNT(*) FROM auth.users) AS accounts,
      (SELECT COUNT(*) FROM vocpt.sessions) AS sessions,
      (SELECT COUNT(*) FROM vocpt.words WHERE english ~ '[^[:space:]]') AS "englishTranslations",
      (SELECT COUNT(*) FROM vocpt.words WHERE ukrainian ~ '[^[:space:]]') AS "ukrainianTranslations",
      (SELECT COUNT(*) FROM vocpt.sessions WHERE user_id IS NULL) AS "unassignedSessions",
      (SELECT jsonb_agg(jsonb_build_object('mode', modes.mode, 'count', COALESCE(session_counts.count, 0)) ORDER BY modes.position)
        FROM modes LEFT JOIN session_counts ON session_counts.mode = modes.mode) AS "sessionModes"`);
  const overview = rows[0];
  if (!overview) throw new Error('Admin overview unavailable');
  return {
    ...Object.fromEntries(countFields.map((field) => [field, integerCount(overview[field])])),
    sessionModes: overview.sessionModes.map(({ mode, count }) => ({ mode, count: integerCount(count) })),
  };
}
