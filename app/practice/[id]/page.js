import { notFound } from 'next/navigation';
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
  const session = await getPractice(sessionId);
  if (!session) notFound();
  const props = { sessionId, words: session.words, initialAnswers: session.answers, initialIndex: session.index };
  const questions = session.mode === 'multiple-choice' ? createChoiceQuestions(session.words, await getVocabulary()) : null;
  return <main className="practice-page">
    {session.mode === 'multiple-choice' ? <ChoicePractice key={sessionId} {...props} questions={questions} /> :
      session.mode === 'matching' ? <MatchingPractice key={sessionId} {...props} /> : <Practice key={sessionId} {...props} />}
  </main>;
}
