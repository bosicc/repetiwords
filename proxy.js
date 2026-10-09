import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { getAuthConfig, getAuthCookieOptions } from './lib/supabase/config';

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const { url, key } = getAuthConfig();
  const supabase = createServerClient(url, key, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const publicRoute = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/auth/');
  if ((!data?.claims || error) && !publicRoute) {
    const destination = request.nextUrl.clone();
    destination.pathname = '/login';
    destination.search = '';
    const redirect = NextResponse.redirect(destination);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/', '/login', '/register', '/settings/:path*', '/vocabulary/:path*', '/practice/:path*', '/auth/:path*'],
};
