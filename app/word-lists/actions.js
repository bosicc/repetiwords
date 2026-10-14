'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { accountWordLists } from '../../lib/account-word-lists';

export async function createList(previous, formData) {
  let id;
  try { id = await (await accountWordLists()).createList(formData.get('name')); }
  catch { return { error: 'Could not create list. Enter a name and try again.' }; }
  revalidatePath('/word-lists');
  redirect(`/word-lists/${id}?new=1`);
}
export async function renameList(id, name) {
  await (await accountWordLists()).renameList(id, name);
  revalidatePath(`/word-lists/${id}`);
  revalidatePath('/word-lists');
}
export async function changeListWord(id, wordId, remove = false) {
  const lists = await accountWordLists();
  if (remove) await lists.removeWord(id, wordId);
  else await lists.addWord(id, wordId);
  revalidatePath(`/word-lists/${id}`);
  revalidatePath('/word-lists');
}
