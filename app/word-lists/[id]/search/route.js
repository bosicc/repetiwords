import { NextResponse } from 'next/server';
import { accountWordLists } from '../../../../lib/account-word-lists';

export async function GET(request, { params }) {
  const id = Number((await params).id);
  const lists = await accountWordLists();
  if (!Number.isSafeInteger(id) || id < 1 || !await lists.getList(id)) return NextResponse.json({ error: 'List not found' }, { status: 404 });
  const words = await lists.searchWords(id, new URL(request.url).searchParams.get('q') || '');
  return NextResponse.json(words, { headers: { 'Cache-Control': 'private, no-store' } });
}
