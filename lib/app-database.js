import 'server-only';
import { cache } from 'react';
import { requireUser } from './auth';
import { createPostgresDatabase } from './database-postgres';
import { getPostgresPool } from './postgres';
import { claimLegacyProgress } from './legacy-progress';

import { readStudyLanguage } from './study-languages';

export const getAccountLanguage = cache(async userId => readStudyLanguage(getPostgresPool(), userId));

const getDatabase = cache(async () => {
  const user = await requireUser();
  await claimLegacyProgress(getPostgresPool(), user);
  return createPostgresDatabase(getPostgresPool(), { userId: user.id, studyLanguage: await getAccountLanguage(user.id) });
});

export const getVocabulary = async (language) => (await getDatabase()).getVocabulary(language);
export const getStatistics = async () => (await getDatabase()).getStatistics();
export const getWordProgress = async () => (await getDatabase()).getWordProgress();
export const getSessionHistory = async (...args) => (await getDatabase()).getSessionHistory(...args);
export const getPractice = async (...args) => (await getDatabase()).getPractice(...args);
export async function startPractice(count, mode, listId, scope) {
  if (listId == null) return (await getDatabase()).startPractice(count, mode, null, scope);
  const user = await requireUser();
  const pool = getPostgresPool();
  const { rows } = await pool.query('SELECT study_language FROM vocpt.word_lists WHERE id=$1 AND user_id=$2', [listId, user.id]);
  if (!rows.length) throw new Error('List not found');
  const db = createPostgresDatabase(pool, { userId: user.id, studyLanguage: rows[0].study_language });
  return db.startPractice(count, mode, listId, scope);
}
export const recordPracticeAnswer = async (...args) => (await getDatabase()).recordPracticeAnswer(...args);
export const recordPracticeRound = async (...args) => (await getDatabase()).recordPracticeRound(...args);
export const saveSession = async (...args) => (await getDatabase()).saveSession(...args);
