import { createPostgresDatabase } from './database-postgres.js';
import { getPostgresPool } from './postgres.js';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const backend = createPostgresDatabase(getPostgresPool(connectionString));

export const getWordProgress = (...args) => backend.getWordProgress(...args);
export const startPractice = (...args) => backend.startPractice(...args);
export const getPractice = (...args) => backend.getPractice(...args);
export const recordPracticeAnswer = (...args) => backend.recordPracticeAnswer(...args);
export const recordPracticeRound = (...args) => backend.recordPracticeRound(...args);
export const importWords = (...args) => backend.importWords(...args);
export const createUser = (...args) => backend.createUser(...args);
export const getUsers = (...args) => backend.getUsers(...args);
export const getWords = (...args) => backend.getWords(...args);
export const getVocabulary = (...args) => backend.getVocabulary(...args);
export const getStatistics = (...args) => backend.getStatistics(...args);
export const getSessionHistory = (...args) => backend.getSessionHistory(...args);
export const saveSession = (...args) => backend.saveSession(...args);
