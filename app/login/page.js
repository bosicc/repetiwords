import { redirect } from 'next/navigation';
import { authReturn } from '../../lib/auth-return';
import AuthForm from '../components/auth-form';
import { getCurrentUser } from '../../lib/auth';

export const metadata = { title: 'Log in · Repeti' };

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const next = authReturn(query.next);
  if (await getCurrentUser()) redirect(next);
  return <main className="auth-page"><AuthForm mode="login" next={next} confirmationError={query.error === 'confirmation'} /></main>;
}
