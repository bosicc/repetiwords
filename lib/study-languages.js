export const studyLanguages = { 'pt-PT': 'Portuguese', 'es-ES': 'Spanish' };
export const defaultStudyLanguage = 'pt-PT';

export function validateStudyLanguage(code) {
  if (!Object.hasOwn(studyLanguages, code)) throw new Error('Unknown study language');
  return code;
}

export async function readStudyLanguage(pool, userId) {
  const result = await pool.query('SELECT study_language FROM vocpt.active_languages WHERE user_id=$1', [userId]);
  return result.rows[0]?.study_language || defaultStudyLanguage;
}

export async function selectStudyLanguage(pool, userId, code) {
  validateStudyLanguage(code);
  await pool.query(`WITH enrolled AS (
    INSERT INTO vocpt.account_languages (user_id,study_language) SELECT $1, code FROM vocpt.study_languages WHERE code IN ('pt-PT',$2)
    ON CONFLICT DO NOTHING
  ) INSERT INTO vocpt.active_languages (user_id,study_language) VALUES ($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET study_language=excluded.study_language`, [userId, code]);
}
