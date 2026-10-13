import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accountWordLists } from '../../../lib/account-word-lists';
import { requireUser } from '../../../lib/auth';
import { getPracticeWordCount, getPracticeMode } from '../../../lib/practice-settings';
import { Text } from '../../components/language';
import PracticeLaunchForm from '../../components/practice-launch-form';
import ListWords from '../list-words';

export default async function WordListPage({ params }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const list = await (await accountWordLists()).getList(id);
  if (!list) notFound();
  const user = await requireUser();
  const [count, mode] = await Promise.all([getPracticeWordCount(), getPracticeMode(user.id)]);
  return <main>
    <nav className="navigation"><Link href="/word-lists">← <Text>My word lists</Text></Link></nav>
    <h1 className="word-list-title">{list.name}</h1>
    <ListWords listId={id} words={list.words} />
    <section className="word-list-practice" aria-labelledby="list-practice-heading"><h2 id="list-practice-heading"><Text>Practice this list</Text></h2>
      {list.words.length ? <><p><Text>Only words from this list will be practiced. Short lists use all available words.</Text></p><PracticeLaunchForm count={count} mode={mode} listId={id} /></> : <p><Text>Add words to this list before starting practice.</Text></p>}
    </section>
  </main>;
}
