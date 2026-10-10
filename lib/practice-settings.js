import 'server-only';
import { cookies } from 'next/headers';
import { isPracticeMode } from './practice-modes.js';

export function practiceModeCookieName(userId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) throw new Error('Invalid account ID');
  return `vocpt-practice-mode-${userId}`;
}

export async function getPracticeMode(userId) {
  const value = (await cookies()).get(practiceModeCookieName(userId))?.value;
  return isPracticeMode(value) ? value : 'self-assessment';
}

export async function getPracticeWordCount() {
  const value = Number((await cookies()).get('vocpt-practice-count')?.value);
  return [10, 30, 100].includes(value) ? value : 30;
}
