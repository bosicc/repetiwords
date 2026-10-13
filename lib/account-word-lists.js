import 'server-only';
import { requireUser } from './auth';
import { getPostgresPool } from './postgres';
import { createWordLists } from './word-lists';

export async function accountWordLists() {
  const user = await requireUser();
  return createWordLists(getPostgresPool(), user.id);
}
