import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accountWordLists } from '../../../lib/account-word-lists';
import { Text } from '../../components/language';
import ListWords from '../list-words';

export default async function WordListPage({ params }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const list = await (await accountWordLists()).getList(id);
  if (!list) notFound();
  return <main>
    <nav className="navigation"><Link href="/word-lists">← <Text>My word lists</Text></Link></nav>
    <h1 className="word-list-title">{list.name}</h1>
    <ListWords listId={id} words={list.words} />
  </main>;
}
