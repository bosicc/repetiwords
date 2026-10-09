import { Text } from '../components/language';
import 'server-only';
import Link from 'next/link';
import { getVocabulary } from '../../lib/database';
import VocabularyList from './vocabulary-list';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function VocabularyPage() {
  const words = await getVocabulary();
  return <main>
    <nav className="navigation" aria-label="Main navigation"><Link href="/"><Text>Home</Text></Link><Link href="/vocabulary" aria-current="page"><Text>Vocabulary</Text></Link><Link href="/settings"><Text>Settings</Text></Link></nav>
    <header><h1><Text>Total vocabulary</Text></h1>
      <p><Text>Explore all your Portuguese words by level and category.</Text></p></header>
    <VocabularyList words={words} />
  </main>;
}
