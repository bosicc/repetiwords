import { NextResponse } from 'next/server';
import { createAuthClient } from '../../../lib/supabase/server';

export async function GET(request) {
  const code = new URL(request.url).searchParams.get('code');
  if (code) {
    const supabase = await createAuthClient({ writable: true });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
}
