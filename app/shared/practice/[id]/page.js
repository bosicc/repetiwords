import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sharedLists, sharedPracticeContext } from '../../../../lib/shared-practice-context';
import Practice from '../../../practice';
import ChoicePractice from '../../../components/choice-practice';
import MatchingPractice from '../../../components/matching-practice';
import { Text } from '../../../components/language';

export const metadata = { title: 'Shared practice · Repeti', robots: { index: false, follow: false } };
export default async function SharedPracticePage({ params }) {
  const { id } = await params;
  const { userId, guestSecret } = await sharedPracticeContext();
  const session = await sharedLists().getPractice(id, userId, guestSecret);
  if (!session) notFound();
  const shared = { token: session.token, signedIn: session.signedIn, canClaim: Boolean(userId) && !session.signedIn, sessionId: id };
  const props = { sessionId: id, words: session.words, initialAnswers: session.answers, initialIndex: session.index, shared };
  return <main className="practice-page">
    <nav className="navigation"><Link href={`/shared/${session.token}`}>← <Text>Back to shared list</Text></Link></nav>
    <h1 className="shared-practice-title">{session.name}</h1>
    {session.mode === 'multiple-choice' ? <ChoicePractice key={id} {...props} questions={session.questions} /> : session.mode === 'matching' ? <MatchingPractice key={id} {...props} /> : <Practice key={id} {...props} />}
  </main>;
}
