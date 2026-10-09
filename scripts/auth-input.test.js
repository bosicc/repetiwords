import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCredentials, authErrorMessage } from '../lib/auth-input.js';
import { getAuthConfig, getAuthCookieOptions } from '../lib/supabase/config.js';

function credentials(email, password) {
  const form = new FormData();
  if (email !== undefined) form.set('email', email);
  if (password !== undefined) form.set('password', password);
  return form;
}

test('email/password validation trims email and preserves the exact password', () => {
  const password = '  correct horse  ';
  assert.deepEqual(readCredentials(credentials(' Learner@Example.com ', password), { register: true }), {
    email: 'Learner@Example.com', password, errors: {},
  });
  assert.deepEqual(readCredentials(credentials('learner@example.com', 'short')).errors, {});
  assert.equal(readCredentials(credentials('learner@example.com', 'short'), { register: true }).errors.password, 'Use at least 8 characters.');
  assert.deepEqual(readCredentials(credentials('learner@example.com', '12345678'), { register: true }).errors, {});
  assert.deepEqual(readCredentials(credentials('learner@example.com', 'x'.repeat(1024))).errors, {});
  assert.equal(readCredentials(credentials('learner@example.com', 'x'.repeat(1025))).errors.password, 'Enter your password.');
  for (const passwordValue of [undefined, '']) {
    assert.equal(readCredentials(credentials('learner@example.com', passwordValue)).errors.password, 'Enter your password.');
  }
  for (const email of [undefined, '', '   ', 'learner', 'learner@host', 'a b@example.com', 'a@@example.com', 'a'.repeat(243) + '@example.com']) {
    assert.equal(readCredentials(credentials(email, '12345678')).errors.email, 'Enter a valid email address.');
  }
  const fileForm = credentials('learner@example.com', '12345678');
  fileForm.set('email', new Blob(['learner@example.com']), 'email.txt');
  fileForm.set('password', new Blob(['12345678']), 'password.txt');
  assert.deepEqual(readCredentials(fileForm).errors, {
    email: 'Enter a valid email address.', password: 'Enter your password.',
  });
});

test('authentication errors show safe, actionable messages without provider details', () => {
  for (const error of [{ status: 429 }, { code: 'over_email_send_rate_limit' }, { code: 'over_request_rate_limit' }]) {
    assert.equal(authErrorMessage(error), 'Too many attempts. Please try again later.');
  }
  assert.equal(authErrorMessage({ code: 'email_not_confirmed' }), 'Confirm your email before logging in.');
  assert.equal(authErrorMessage({ code: 'weak_password' }, { register: true }), 'Choose a stronger password.');
  assert.equal(authErrorMessage({ code: 'signup_disabled' }, { register: true }), 'Registration is currently unavailable.');
  for (const error of [undefined, { code: 'invalid_credentials' }, { code: 'user_already_exists' }, { message: 'private provider diagnostic and connection credentials', status: 500 }]) {
    assert.equal(authErrorMessage(error), 'Email or password is incorrect.');
    assert.equal(authErrorMessage(error, { register: true }), 'Could not create your account. Please try again.');
  }
});

test('Supabase Auth config accepts publishable or anon keys and rejects elevated keys', () => {
  const url = 'https://test-project.supabase.co';
  const publishable = 'sb_publishable_test';
  const jwt = (payload) => ['header', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'signature'].join('.');
  assert.deepEqual(getAuthConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishable }), { url, key: publishable });
  assert.deepEqual(getAuthConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable }), { url, key: publishable });
  const anon = jwt({ role: 'anon' });
  assert.deepEqual(getAuthConfig({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon }), { url, key: anon });
  assert.deepEqual(getAuthConfig({ SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co', SUPABASE_PUBLISHABLE_KEY: publishable, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' }), { url, key: publishable });
  for (const key of ['sb_secret_test', jwt({ role: 'service_role' }), jwt({ role: 'authenticated' }), jwt({}), 'header.invalid-json.signature']) {
    assert.throws(() => getAuthConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key }), /Use a Supabase .* key for authentication/);
  }
  for (const env of [{}, { SUPABASE_URL: url }, { SUPABASE_PUBLISHABLE_KEY: publishable }, { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' }]) {
    assert.throws(() => getAuthConfig(env), /Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY/);
  }
});

test('auth cookies are HttpOnly and SameSite=lax, with HTTPS required in production', () => {
  assert.deepEqual(getAuthCookieOptions({ NODE_ENV: 'production' }), { secure: true, sameSite: 'lax', httpOnly: true });
  for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, {}]) {
    assert.deepEqual(getAuthCookieOptions(env), { secure: false, sameSite: 'lax', httpOnly: true });
  }
});
