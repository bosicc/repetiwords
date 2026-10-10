import 'server-only';
import { cache } from 'react';
import { requireUser } from './auth';
import { createPostgresDatabase } from './database-postgres';
import { getPostgresPool } from './postgres';
import { claimLegacyProgress } from './legacy-progress';

const getDatabase = cache(async () => {
  const user = await requireUser();
  await claimLegacyProgress(getPostgresPool(), user);
  return createPostgresDatabase(getPostgresPool(), { userId: user.id });
});

export const getVocabulary = async () => (await getDatabase()).getVocabulary();
export const getStatistics = async () => (await getDatabase()).getStatistics();
export const getWordProgress = async () => (await getDatabase()).getWordProgress();
export const getSessionHistory = async (...args) => (await getDatabase()).getSessionHistory(...args);
export const getPractice = async (...args) => (await getDatabase()).getPractice(...args);
export const startPractice = async (...args) => (await getDatabase()).startPractice(...args);
export const recordPracticeAnswer = async (...args) => (await getDatabase()).recordPracticeAnswer(...args);
export const recordPracticeRound = async (...args) => (await getDatabase()).recordPracticeRound(...args);
export const saveSession = async (...args) => (await getDatabase()).saveSession(...args);
