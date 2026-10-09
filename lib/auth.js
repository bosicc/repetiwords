import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createAuthClient } from './supabase/server';

export const getCurrentUser = cache(async () => {
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
