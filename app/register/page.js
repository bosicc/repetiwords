import { redirect } from 'next/navigation';
import { authReturn } from '../../lib/auth-return';
import AuthForm from '../components/auth-form';
import { getCurrentUser } from '../../lib/auth';

export const metadata = { title: 'Register · Repeti' };

export default async function RegisterPage({ searchParams }) {
  const next = authReturn((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <main className="auth-page"><AuthForm mode="register" next={next} /></main>;
}
