import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { getCurrentUser } from './auth';
import { getPostgresPool } from './postgres';
import { createSharedLists, validShareToken } from './shared-lists';

export const sharedLists = () => createSharedLists(getPostgresPool());
export async function sharedPracticeContext(createGuest = false) {
  const user = await getCurrentUser();
  const store = await cookies();
  let guestSecret = store.get('vocpt-guest-practice')?.value;
  if (createGuest && !user) {
    if (!validShareToken(guestSecret)) guestSecret = randomBytes(32).toString('hex');
    store.set('vocpt-guest-practice', guestSecret, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 86400 });
  }
  return { userId: user?.id || null, guestSecret };
}
