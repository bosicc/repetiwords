import Link from 'next/link';
import { requireUser } from '../../lib/auth';
import { getPracticeWordCount, getPracticeMode } from '../../lib/practice-settings';
import { Text } from '../components/language';
import PracticeLaunchForm from '../components/practice-launch-form';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PracticeLaunchPage() {
  const user = await requireUser();
  const [count, mode] = await Promise.all([getPracticeWordCount(), getPracticeMode(user.id)]);

  return <main className="practice-picker-page">
    <nav className="navigation" aria-label="Main navigation">
      <Link href="/"><Text>Home</Text></Link>
      <Link href="/vocabulary"><Text>Vocabulary</Text></Link>
      <Link href="/settings"><Text>Settings</Text></Link>
    </nav>
    <div className="practice-picker-heading">
      <h1><Text>Choose your practice</Text></h1>
    </div>
    <PracticeLaunchForm count={count} mode={mode} />
  </main>;
}
