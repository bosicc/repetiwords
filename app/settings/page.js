import Link from 'next/link';
import { getPracticeWordCount } from '../../lib/practice-settings';
import { Text, LanguageSettings } from '../components/language';
import SettingsForm from './settings-form';

export default async function SettingsPage() {
  const count = await getPracticeWordCount();
  return <main>
    <nav className="navigation" aria-label="Main navigation">
      <Link href="/"><Text>Home</Text></Link><Link href="/vocabulary"><Text>Vocabulary</Text></Link>
      <Link href="/settings" aria-current="page"><Text>Settings</Text></Link>
    </nav>
    <h1><Text>Settings</Text></h1>
    <LanguageSettings />
    <SettingsForm count={count} />
  </main>;
}
