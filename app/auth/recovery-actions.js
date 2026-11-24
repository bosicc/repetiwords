'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAuthClient } from '../../lib/supabase/server';
import { recoveryOrigin, sendRecoveryEmail, updateRecoveredPassword } from '../../lib/password-recovery';

export async function requestRecovery(previous, formData) {
  try {
    const origin = recoveryOrigin(process.env, (await headers()).get('origin'));
    const client = await createAuthClient({ writable: true, recovery: true });
    return await sendRecoveryEmail(client.auth, formData, origin);
  } catch {
    return { error: 'Could not connect. Please try again.' };
  }
}

export async function resetPassword(previous, formData) {
  try {
    const client = await createAuthClient({ writable: true, recovery: true });
    const result = await updateRecoveredPassword(client.auth, formData);
    if (!result.updated) return result;
    // Password change has succeeded even if session revocation is temporarily unavailable.
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
    const store = await cookies();
    for (const { name } of store.getAll()) {
      if (name.startsWith('repeti-recovery')) store.set(name, '', { path: '/auth', maxAge: 0 });
    }
  } catch {
    return { error: 'Could not connect. Please try again.' };
  }
  redirect('/login?reset=success');
}
