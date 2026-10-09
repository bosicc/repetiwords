import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAuthConfig, getAuthCookieOptions } from './config';

export async function createAuthClient({ writable = false } = {}) {
  const store = await cookies();
  const { url, key } = getAuthConfig();
  return createServerClient(url, key, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options);
        } catch (error) {
          if (writable) throw error;
          // Server Components cannot set cookies; proxy refreshes their session.
        }
      },
    },
  });
}
