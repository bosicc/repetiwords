export function readCredentials(formData, { register = false } = {}) {
  const emailValue = formData.get('email');
  const password = formData.get('password');
  const email = typeof emailValue === 'string' ? emailValue.trim() : '';
  const errors = {};
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (typeof password !== 'string' || !password || password.length > 1024) errors.password = 'Enter your password.';
  else if (register && password.length < 8) errors.password = 'Use at least 8 characters.';
  return { email, password, errors };
}

export function authErrorMessage(error, { register = false } = {}) {
  if (error?.status === 429 || ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error?.code)) return 'Too many attempts. Please try again later.';
  if (error?.code === 'email_not_confirmed') return 'Confirm your email before logging in.';
  if (error?.code === 'weak_password') return 'Choose a stronger password.';
  if (error?.code === 'signup_disabled') return 'Registration is currently unavailable.';
  return register ? 'Could not create your account. Please try again.' : 'Email or password is incorrect.';
}
