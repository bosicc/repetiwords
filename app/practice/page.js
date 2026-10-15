import Link from 'next/link';
import { requireUser } from '../../lib/auth';
import { getPracticeWordCount, getPracticeMode } from '../../lib/practice-settings';
import { Text } from '../components/language';
import PracticeLaunchForm from '../components/practice-launch-form';
import { notFound } from 'next/navigation';
import { accountWordLists } from '../../lib/account-word-lists';
import { getVocabulary } from '../../lib/app-database';
import { filterVocabulary, validatePracticeScope } from '../../lib/vocabulary-topics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PracticeLaunchPage({ searchParams }) {
  const user = await requireUser();
  const query = await searchParams;
  let scope;
  try { scope = validatePracticeScope({ topic: query.topic ?? null, level: query.level ?? null }); }
  catch { notFound(); }
  if (query.listId !== undefined && (scope.topic || scope.level)) notFound();
  if (scope.level && !scope.topic) notFound();
  let availableCount;
  if (scope.topic) {
    availableCount = filterVocabulary(await getVocabulary(), scope).length;
    if (!availableCount) notFound();
  }
  let list;
  if (query.listId !== undefined) {
    const id = Number(query.listId);
    if (!Number.isSafeInteger(id) || id < 1) notFound();
    list = await (await accountWordLists()).getList(id);
    if (!list) notFound();
  }
  const [count, mode] = await Promise.all([getPracticeWordCount(), getPracticeMode(user.id)]);

  return <main className="practice-picker-page">
    <nav className="navigation" aria-label="Main navigation">
      <Link href="/"><Text>Home</Text></Link>
      <Link href="/vocabulary"><Text>Vocabulary</Text></Link>
      <Link href="/word-lists"><Text>My words lists</Text></Link><Link href="/settings"><Text>Settings</Text></Link>
    </nav>
    <div className="practice-picker-heading">
      <h1>{list ? list.name : <Text>{scope.topic ? 'Practice by topic' : 'Choose your practice'}</Text>}</h1>
    </div>
    {list && !list.words.length ? <p><Text>Add words to this list before starting practice.</Text></p> : <PracticeLaunchForm count={count} mode={mode} listId={list?.id} topic={scope.topic} level={scope.level} availableCount={availableCount} />}
  </main>;
}
