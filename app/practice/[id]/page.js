import { notFound, redirect } from 'next/navigation';
import { requireUser } from '../../../lib/auth';
import { sharedLists } from '../../../lib/shared-practice-context';
import { getPractice, getVocabulary } from '../../../lib/app-database';
import Practice from '../../practice';
import ChoicePractice from '../../components/choice-practice';
import MatchingPractice from '../../components/matching-practice';
import { createChoiceQuestions } from '../../../lib/practice-exercises.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function PracticePage({ params }) {
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) notFound();
  const user = await requireUser();
  const sharedId = await sharedLists().findAccountPractice(sessionId, user.id);
  if (sharedId) redirect(`/shared/practice/${sharedId}`);
  const session = await getPractice(sessionId);
  if (!session) notFound();
  const props = { sessionId, listId: session.listId, words: session.words, initialAnswers: session.answers, initialIndex: session.index };
  const questions = session.mode === 'multiple-choice' ? createChoiceQuestions(session.words, await getVocabulary()) : null;
  return <main className="practice-page">
    {session.mode === 'multiple-choice' ? <ChoicePractice key={sessionId} {...props} questions={questions} /> :
      session.mode === 'matching' ? <MatchingPractice key={sessionId} {...props} /> : <Practice key={sessionId} {...props} />}
  </main>;
}
