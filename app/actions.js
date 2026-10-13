'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { saveSession, startPractice, getPractice, getVocabulary, recordPracticeAnswer, recordPracticeRound } from '../lib/app-database';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { practiceModeCookieName } from '../lib/practice-settings';
import { requireUser } from '../lib/auth';
import { isPracticeMode } from '../lib/practice-modes.js';
import { gradeChoiceAnswer, gradeMatchingRound } from '../lib/practice-exercises.js';

export async function savePracticeSettings(formData) {
  await requireUser();
  const count = Number(formData.get('count'));
  if (![10, 30, 100].includes(count)) throw new Error('Invalid word count');
  (await cookies()).set('vocpt-practice-count', String(count), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production' && process.env.VOCPT_SECURE_COOKIES === 'true',
  });
  revalidatePath('/');
}

export async function beginPractice(previousState, formData) {
  const user = await requireUser();
  const count = Number(formData?.get('count'));
  const mode = formData?.get('mode');
  if (![10, 30, 100].includes(count) || !isPracticeMode(mode)) {
    return { error: 'Could not start practice. Please try again.' };
  }
  let id;
  try {
    const listValue = formData.get('listId');
    const listId = listValue === null ? null : Number(listValue);
    id = await startPractice(count, mode, listId);
    const cookieStore = await cookies();
    const options = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === 'production' && process.env.VOCPT_SECURE_COOKIES === 'true' };
    cookieStore.set(practiceModeCookieName(user.id), mode, options);
    cookieStore.set('vocpt-practice-count', String(count), options);
  } catch {
    return { error: 'Could not start practice. Please try again.' };
  }
  redirect(`/practice/${id}`);
}

export async function submitPracticeAnswer(id, wordId, known, revealed) {
  const session = await getPractice(id);
  if (!session || session.mode !== 'self-assessment') throw new Error('Invalid practice type');
  await recordPracticeAnswer(id, wordId, known, revealed);
  revalidatePath('/');
}

export async function submitPracticeSkip(id, wordId) {
  const session = await getPractice(id);
  if (!session || session.mode === 'matching') throw new Error('Invalid practice type');
  const word = session.words.find((candidate) => candidate.id === wordId);
  if (word?.completed && !session.answers.some((answer) => answer.wordId === wordId)) return;
  await recordPracticeAnswer(id, wordId, null, false);
  revalidatePath('/');
}

export async function submitChoiceAnswer(id, wordId, optionId, language) {
  const session = await getPractice(id);
  const word = session?.words.find((candidate) => candidate.id === wordId);
  if (!session || session.mode !== 'multiple-choice' || !word) throw new Error('Invalid question');
  const result = gradeChoiceAnswer(word, await getVocabulary(), optionId, language);
  const saved = session.answers.find((answer) => answer.wordId === wordId);
  if (saved && saved.known === result.known && saved.revealed === false) return saved;
  if (session.words[session.index]?.id !== wordId) throw new Error('Word already answered');
  await recordPracticeAnswer(id, wordId, result.known, false);
  revalidatePath('/');
  return result;
}

export async function submitMatchingRound(id, attempts, language, roundSize) {
  const session = await getPractice(id);
  if (!session || session.mode !== 'matching' || !Number.isInteger(roundSize) || roundSize < 1 || roundSize > 6 ||
      !Array.isArray(attempts) || attempts.length < 1 || attempts.length > 500) throw new Error('Invalid matching round');
  const attemptedIds = new Set(attempts.map((attempt) => attempt?.wordId));
  const start = session.words.findIndex((word) => attemptedIds.has(word.id));
  const roundWords = session.words.slice(start, start + roundSize);
  if (start < 0 || attemptedIds.size !== roundSize || roundWords.length !== roundSize ||
      roundWords.some((word) => !attemptedIds.has(word.id))) throw new Error('Invalid matching round');
  const results = gradeMatchingRound(roundWords, attempts, language);
  if (session.index >= start + roundSize) {
    const saved = results.map((result) => session.answers.find((answer) => answer.wordId === result.wordId));
    if (saved.every((answer, index) => answer && answer.known === results[index].known && answer.revealed === false)) return saved;
  }
  if (session.index !== start) throw new Error('Round already answered or out of order');
  await recordPracticeRound(id, results);
  revalidatePath('/');
  return results;
}

export async function finishSession(answers) {
  await saveSession(answers);
  revalidatePath('/');
}
