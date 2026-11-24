import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAuthConfig, getAuthCookieOptions } from './config';

export async function createAuthClient({ writable = false, recovery = false } = {}) {
  const store = await cookies();
  const { url, key } = getAuthConfig();
  return createServerClient(url, key, {
    cookieOptions: { ...getAuthCookieOptions(), ...(recovery ? { name: 'repeti-recovery', path: '/auth' } : {}) },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) {
            // The verifier survives until the email expires. The reset session is shorter.
            const maxAge = name.includes('code-verifier') ? 3600 : 600;
            store.set(name, value, recovery && value ? { ...options, maxAge } : options);
          }
        } catch (error) {
          if (writable) throw error;
          // Server Components cannot set cookies; proxy refreshes their session.
        }
      },
    },
  });
}
