import { redirect } from 'next/navigation';
import RecoveryForm from '../../components/recovery-form';
import { createAuthClient } from '../../../lib/supabase/server';

export const metadata = { title: 'Choose a new password · Repeti' };

export default async function ResetPassword() {
  const client = await createAuthClient({ recovery: true });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/auth/forgot-password?expired=1');
  return <main className="auth-page"><RecoveryForm reset /></main>;
}
