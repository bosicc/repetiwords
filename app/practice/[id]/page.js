import { notFound } from 'next/navigation';
import { getPractice } from '../../../lib/database';
import Practice from '../../practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export default async function PracticePage({ params }) {
  const { id } = await params;
  const sessionId = Number(id);
  const session = await getPractice(sessionId);
  if (!session) notFound();
  return <main className="practice-page">
    <Practice key={sessionId} sessionId={sessionId} words={session.words} initialAnswers={session.answers} initialIndex={session.index} />
  </main>;
}
