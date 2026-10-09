'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { login, register } from '../auth/actions';
import { useLanguage } from './language';

export default function AuthForm({ mode, confirmationError = false }) {
  const signingUp = mode === 'register';
  const [state, action, pending] = useActionState(signingUp ? register : login, {});
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useLanguage();
  return <section className="auth-card" aria-labelledby="auth-heading">
    <span className="eyebrow">{t('A little progress, every day.')}</span>
    <h1 id="auth-heading">{t(signingUp ? 'Create your account' : 'Welcome back')}</h1>
    <p className="auth-intro">{t(signingUp ? 'Start learning European Portuguese.' : 'Log in to continue your Portuguese practice.')}</p>
    <form action={action} className="auth-form">
      <div className="auth-field">
        <label htmlFor="email">{t('Email')}</label>
        <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} defaultValue={state.email || ''} aria-invalid={Boolean(state.errors?.email)} aria-describedby={state.errors?.email ? 'email-error' : undefined} placeholder="you@example.com" />
        {state.errors?.email && <span id="email-error" className="auth-field-error">{t(state.errors.email)}</span>}
      </div>
      <div className="auth-field">
        <label htmlFor="password">{t('Password')}</label>
        <div className="auth-password">
          <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signingUp ? 'new-password' : 'current-password'} required minLength={signingUp ? 8 : 1} maxLength={1024} aria-invalid={Boolean(state.errors?.password)} aria-describedby={state.errors?.password ? 'password-error' : signingUp ? 'password-hint' : undefined} />
          <button type="button" onClick={() => setShowPassword(!showPassword)} aria-controls="password" aria-pressed={showPassword}>{t(showPassword ? 'Hide' : 'Show')}</button>
        </div>
        {state.errors?.password && <span id="password-error" className="auth-field-error">{t(state.errors.password)}</span>}
        {signingUp && <span id="password-hint" className="auth-hint">{t('Use at least 8 characters.')}</span>}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {(state.error || confirmationError) && <p className="auth-message auth-error" role="alert">{t(state.error || 'The confirmation link expired or is invalid. Please log in or register again.')}</p>}
        {state.message && <p className="auth-message auth-success" role="status">{t(state.message)}</p>}
      </div>
      <button className="primary auth-submit" disabled={pending}>{t(pending ? signingUp ? 'Creating account…' : 'Logging in…' : signingUp ? 'Register' : 'Log in')} <span aria-hidden="true">→</span></button>
    </form>
    <p className="auth-switch">{t(signingUp ? 'Already have an account?' : 'New to Repeti?')} <Link href={signingUp ? '/login' : '/register'}>{t(signingUp ? 'Log in' : 'Create an account')}</Link></p>
  </section>;
}
