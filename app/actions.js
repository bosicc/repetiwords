'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { saveSession, startPractice, recordPracticeAnswer } from '../lib/app-database';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getPracticeWordCount } from '../lib/practice-settings';
import { requireUser } from '../lib/auth';

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

export async function beginPractice() {
  const id = await startPractice(await getPracticeWordCount());
  redirect(`/practice/${id}`);
}

export async function submitPracticeAnswer(id, wordId, known, revealed) {
  await recordPracticeAnswer(id, wordId, known, revealed);
  revalidatePath('/');
}

export async function finishSession(answers) {
  await saveSession(answers);
  revalidatePath('/');
}
