import { authReturn } from '../../../lib/auth-return';
import { NextResponse } from 'next/server';
import { createAuthClient } from '../../../lib/supabase/server';

export async function GET(request) {
  const query = new URL(request.url).searchParams;
  const code = query.get('code');
  const next = authReturn(query.get('next'));
  if (code) {
    const supabase = await createAuthClient({ writable: true });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL(`/login?error=confirmation&next=${encodeURIComponent(next)}`, request.url));
}
