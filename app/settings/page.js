import Link from 'next/link';
import { getPracticeWordCount } from '../../lib/practice-settings';
import { Text, LanguageSettings } from '../components/language';
import SettingsForm from './settings-form';
import { requireUser } from '../../lib/auth';

export default async function SettingsPage() {
  const user = await requireUser();
  const count = await getPracticeWordCount();
  return <main>
    <nav className="navigation" aria-label="Main navigation">
      <Link href="/"><Text>Home</Text></Link><Link href="/vocabulary"><Text>Vocabulary</Text></Link>
      <Link href="/word-lists"><Text>My words lists</Text></Link><Link href="/settings" aria-current="page"><Text>Settings</Text></Link>
    </nav>
    <h1><Text>Settings</Text></h1>
    <section className="card settings-section" aria-labelledby="account-heading">
      <h2 id="account-heading"><Text>Account</Text></h2>
      <p className="account-status"><span aria-hidden="true">✓</span> <Text>Logged in</Text></p>
      <dl className="account-details">
        <div><dt><Text>Email</Text></dt><dd translate="no">{user.email || <Text>Not provided</Text>}</dd></div>
      </dl>
      <p className="settings-note"><Text>Your learning progress is saved to this account.</Text></p>
    </section>
    <LanguageSettings />
    <SettingsForm count={count} />
  </main>;
}
