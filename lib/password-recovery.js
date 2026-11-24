import { readEmail } from './auth-input.js';

export const invalidRecoveryLink = 'This reset link has expired or is invalid. Request a new one.';
const connectionError = 'Could not connect. Please try again.';
const rateLimit = 'Too many attempts. Please try again later.';

export function recoveryOrigin(env, requestOrigin) {
  if (env.SITE_URL) return new URL(env.SITE_URL).origin;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`).origin;
  const url = new URL(requestOrigin);
  if (env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Configure SITE_URL for password recovery');
  }
  return url.origin;
}

export async function sendRecoveryEmail(auth, formData, origin) {
  const { email, errors } = readEmail(formData);
  if (errors.email) return { email, error: errors.email };
  const redirectTo = new URL('/auth/callback?recovery=1', origin).href;
  const { error } = await auth.resetPasswordForEmail(email, { redirectTo });
  if (error?.status === 429) return { email, error: rateLimit };
  if (error && !['user_not_found', 'email_not_confirmed'].includes(error.code)) return { email, error: connectionError };
  return { email, sent: true };
}

export async function updateRecoveredPassword(auth, formData) {
  const password = formData.get('password');
  if (typeof password !== 'string' || password.length < 8) return { error: 'Use at least 8 characters.' };
  if (password.length > 1024) return { error: 'Use at most 1024 characters.' };
  if (password !== formData.get('confirmation')) return { error: 'Passwords do not match.' };
  const { data, error: verificationError } = await auth.getUser();
  if (verificationError || !data.user) return { error: invalidRecoveryLink };
  const { error } = await auth.updateUser({ password });
  if (error?.code === 'same_password') return { error: 'Choose a different password.' };
  if (error?.code === 'weak_password') return { error: 'Choose a stronger password.' };
  if (error?.status === 429) return { error: rateLimit };
  if (error) return { error: error.status === 401 || error.status === 403 ? invalidRecoveryLink : connectionError };
  return { updated: true };
}
