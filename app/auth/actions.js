'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAuthClient } from '../../lib/supabase/server';
import { readCredentials, authErrorMessage } from '../../lib/auth-input';

async function authenticate(formData, register) {
  const { email, password, errors } = readCredentials(formData, { register });
  if (Object.keys(errors).length) return { email, errors };
  let result;
  try {
    const supabase = await createAuthClient({ writable: true });
    if (register) {
      const origin = process.env.SITE_URL || (await headers()).get('origin');
      const callback = new URL('/auth/callback', origin);
      result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback.toString() } });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }
  } catch {
    return { email, error: 'Could not connect. Please try again.' };
  }
  if (result.error) return { email, error: authErrorMessage(result.error, { register }) };
  if (register && !result.data.session) return { email, message: 'Check your email to confirm your account, then log in.' };
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function login(previousState, formData) {
  return authenticate(formData, false);
}

export async function register(previousState, formData) {
  return authenticate(formData, true);
}

export async function logout() {
  const supabase = await createAuthClient({ writable: true });
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) return { error: 'Could not log out. Please try again.' };
  revalidatePath('/', 'layout');
  redirect('/login');
}
