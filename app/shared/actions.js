'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '../../lib/auth';
import { sharedLists, sharedPracticeContext } from '../../lib/shared-practice-context';

export async function setListSharing(id, enabled) {
  const user = await requireUser();
  const lists = sharedLists();
  let token = null;
  if (enabled) token = await lists.enableShare(id, user.id);
  else await lists.disableShare(id, user.id);
  revalidatePath(`/word-lists/${id}`);
  return token;
}
export async function saveSharedList(token) {
  const user = await requireUser();
  const id = await sharedLists().saveList(token, user.id);
  revalidatePath('/word-lists');
  return id;
}
export async function beginSharedPractice(token, previous, formData) {
  let id;
  try {
    id = await sharedLists().start(token, { ...await sharedPracticeContext(true), count: Number(formData.get('count')), mode: formData.get('mode') });
  } catch { return { error: 'Could not start practice. Please try again.' }; }
  redirect(`/shared/practice/${id}`);
}
async function submit(id, input) {
  const context = await sharedPracticeContext();
  const results = await sharedLists().submit(id, context.userId, context.guestSecret, input);
  if (context.userId) revalidatePath('/');
  return results;
}
export async function submitSharedAnswer(id, wordId, known, revealed) {
  await submit(id, { wordId, known, revealed });
}
export async function submitSharedSkip(id, wordId) {
  await submit(id, { wordId, skip: true });
}
export async function submitSharedChoice(id, wordId, optionId, language) {
  return (await submit(id, { wordId, optionId, language }))[0];
}
export async function submitSharedRound(id, attempts, language, roundSize) {
  return submit(id, { attempts, language, roundSize });
}
export async function claimSharedProgress(id) {
  const user = await requireUser();
  const context = await sharedPracticeContext();
  await sharedLists().claim(id, user.id, context.guestSecret);
  revalidatePath('/');
  revalidatePath(`/shared/practice/${id}`);
}
