import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createAuthClient } from './supabase/server';
import { getSuperAdmin } from './admin-access';
import { emailConfirmationRequired } from './supabase/email-confirmation';

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

export const getCurrentSuperAdmin = cache(async () => getSuperAdmin(await getCurrentUser(), emailConfirmationRequired));

export async function requireSuperAdmin() {
  await requireUser();
  const user = await getCurrentSuperAdmin();
  if (!user) notFound();
  return user;
}
