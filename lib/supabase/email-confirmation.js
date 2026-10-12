import { getAuthConfig } from './config.js';

export async function emailConfirmationRequired() {
  const { url, key } = getAuthConfig();
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not verify Supabase email confirmation settings.');
  const settings = await response.json();
  return settings.mailer_autoconfirm === false;
}
