export function getAuthConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for Supabase Auth.');
  // Never use a service-role or secret key for user authentication.
  if (key.startsWith('sb_secret_')) throw new Error('Use a Supabase publishable key for authentication.');
  if (key.split('.').length === 3) {
    try {
      if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') {
        throw new Error('Use a Supabase anon or publishable key for authentication.');
      }
    } catch { throw new Error('Use a Supabase anon or publishable key for authentication.'); }
  }
  return { url, key };
}

export function getAuthCookieOptions(env = process.env) {
  return { secure: env.NODE_ENV === 'production', sameSite: 'lax', httpOnly: true };
}
