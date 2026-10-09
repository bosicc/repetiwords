import { redirect } from 'next/navigation';
import AuthForm from '../components/auth-form';
import { getCurrentUser } from '../../lib/auth';

export const metadata = { title: 'Register · Repeti' };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/');
  return <main className="auth-page"><AuthForm mode="register" /></main>;
}
