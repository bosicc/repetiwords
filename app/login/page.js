import { redirect } from 'next/navigation';
import AuthForm from '../components/auth-form';
import { getCurrentUser } from '../../lib/auth';

export const metadata = { title: 'Log in · Repeti' };

export default async function LoginPage({ searchParams }) {
  if (await getCurrentUser()) redirect('/');
  const query = await searchParams;
  return <main className="auth-page"><AuthForm mode="login" confirmationError={query.error === 'confirmation'} /></main>;
}
