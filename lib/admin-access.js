const SUPER_ADMIN_EMAIL = 'b.pratsiuk@gmail.com';

// Only pass a user returned by Supabase Auth's server-side getUser().
export function isSuperAdmin(user) {
  return typeof user?.id === 'string' && user.id.length > 0
    && typeof user.email === 'string'
    && user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL
    && typeof user.email_confirmed_at === 'string' && user.email_confirmed_at.length > 0;
}

export async function getSuperAdmin(user, verifyConfirmation) {
  if (!isSuperAdmin(user)) return null;
  try {
    return await verifyConfirmation() === true ? user : null;
  } catch {
    return null;
  }
}
