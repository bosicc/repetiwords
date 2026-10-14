import Link from 'next/link';
import { accountWordLists } from '../../lib/account-word-lists';
import { Text } from '../components/language';
import CreateListForm from './create-list-form';
import ListProgress from './list-progress';

export default async function WordListsPage() {
  const lists = await (await accountWordLists()).getLists();
  return <main>
    <nav className="navigation" aria-label="Main navigation"><Link href="/"><Text>Home</Text></Link><Link href="/vocabulary"><Text>Vocabulary</Text></Link><Link href="/word-lists" aria-current="page"><Text>My words lists</Text></Link><Link href="/settings"><Text>Settings</Text></Link></nav>
    <div className="word-lists-heading"><h1><Text>My words lists</Text></h1><CreateListForm /></div>
    {lists.length ? <div className="word-lists-grid">{lists.map((list) => <Link className="word-list-link" key={list.id} href={`/word-lists/${list.id}`}><strong>{list.name}</strong><ListProgress progress={list.progress} /><span>{list.total} <Text>words</Text> <span aria-hidden="true">→</span></span></Link>)}</div> : <p><Text>Create your first list to get started.</Text></p>}
  </main>;
}
