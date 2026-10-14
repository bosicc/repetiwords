import { Text } from './components/language';
import 'server-only';
import { getStatistics, getWordProgress, getSessionHistory } from '../lib/app-database';
import WordProgress from './components/word-progress';
import SessionHistory from './components/session-history';
import Link from 'next/link';
import { getCurrentUser } from '../lib/auth';
import LandingPage from './components/landing-page';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Home() {
  if (!await getCurrentUser()) return <LandingPage />;
  const [stats, progress, sessions] = await Promise.all([getStatistics(), getWordProgress(), getSessionHistory()]);
  return <main>
    <nav className="navigation" aria-label="Main navigation"><Link href="/" aria-current="page"><Text>Home</Text></Link><Link href="/vocabulary"><Text>Vocabulary</Text></Link><Link href="/word-lists"><Text>My words lists</Text></Link><Link href="/settings"><Text>Settings</Text></Link></nav>
    <section className="stats" aria-label="Learning statistics">
      <div><strong>{stats.answers}</strong><span><Text>Words reviewed</Text></span></div>
      <div><strong>{stats.answers ? Math.round(100 * stats.known / stats.answers) : 0}%</strong><span><Text>Success rate</Text></span></div>
    </section>
    <WordProgress progress={progress} />
    <SessionHistory sessions={sessions} />
  </main>;
}
