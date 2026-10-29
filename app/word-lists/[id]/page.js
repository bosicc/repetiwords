import Link from 'next/link';
import { notFound } from 'next/navigation';
import { accountWordLists } from '../../../lib/account-word-lists';
import { Text } from '../../components/language';
import ListWords from '../list-words';
import ListName from '../list-name';
import ShareList from '../share-list';
import { requireUser } from '../../../lib/auth';
import { sharedLists } from '../../../lib/shared-practice-context';

export default async function WordListPage({ params, searchParams }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const list = await (await accountWordLists()).getList(id);
  if (!list) notFound();
  const user = await requireUser();
  const token = await sharedLists().getShare(id, user.id);
  return <main>
    <nav className="navigation"><Link href="/word-lists">← <Text>My words lists</Text></Link></nav>
    <ListName key={id} listId={id} initialName={list.name} isNew={(await searchParams).new === '1'} />
    <ShareList listId={id} initialToken={token} />
    <ListWords listId={id} words={list.words} />
  </main>;
}
