import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import RecoveryForm from '../../components/recovery-form';
import { recoveryOrigin } from '../../../lib/password-recovery';

export const metadata = { title: 'Reset password · Repeti' };

export default async function ForgotPassword({ searchParams }) {
  const expired = (await searchParams).expired === '1';
  // Start PKCE on the same host that will receive the email callback.
  if (process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    const origin = new URL(recoveryOrigin(process.env));
    if ((await headers()).get('host') !== origin.host) {
      redirect(new URL('/auth/forgot-password' + (expired ? '?expired=1' : ''), origin).href);
    }
  }
  return <main className="auth-page"><RecoveryForm expired={expired} /></main>;
}
