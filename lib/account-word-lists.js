import 'server-only';
import { requireUser } from './auth';
import { getPostgresPool } from './postgres';
import { createWordLists } from './word-lists';

import { getAccountLanguage } from './app-database';

export async function accountWordLists() {
  const user = await requireUser();
  return createWordLists(getPostgresPool(), user.id, await getAccountLanguage(user.id));
}
