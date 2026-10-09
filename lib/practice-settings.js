import 'server-only';
import { cookies } from 'next/headers';

export async function getPracticeWordCount() {
  const value = Number((await cookies()).get('vocpt-practice-count')?.value);
  return [10, 30, 100].includes(value) ? value : 30;
}
