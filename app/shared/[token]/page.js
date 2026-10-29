import { notFound } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth';
import { sharedLists } from '../../../lib/shared-practice-context';
import { Text } from '../../components/language';
import PracticeLaunchForm from '../../components/practice-launch-form';
import SaveList from '../save-list';
import PublicWords from '../public-words';

export const metadata = { title: 'Shared word list · Repeti', robots: { index: false, follow: false } };
export default async function SharedListPage({ params, searchParams }) {
  const { token } = await params;
  const user = await getCurrentUser();
  const list = await sharedLists().getPublicList(token, user?.id);
  if (!list) notFound();
  return <main className="shared-list-page">
    <span className="eyebrow"><Text>Shared word list</Text></span>
    <h1>{list.name}</h1>
    <p><Text>Words in this list</Text>: {list.words.length}</p>
    <SaveList token={token} signedIn={Boolean(user)} isOwner={list.isOwner} listId={list.id} saveOnReturn={(await searchParams).save === '1'} />
    {list.words.length ? <PracticeLaunchForm count={30} mode="self-assessment" sharedToken={token} /> : <p><Text>This list is empty. Come back when its author adds words.</Text></p>}
    <PublicWords words={list.words} />
  </main>;
}
