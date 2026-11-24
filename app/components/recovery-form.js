'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestRecovery, resetPassword } from '../auth/recovery-actions';
import { invalidRecoveryLink } from '../../lib/password-recovery';
import { useLanguage } from './language';

export default function RecoveryForm({ reset = false, expired = false }) {
  const { t } = useLanguage();
  const [state, action, pending] = useActionState(reset ? resetPassword : requestRecovery, {});
  return <section className="auth-card" aria-labelledby="recovery-heading">
    <h1 id="recovery-heading">{t(reset ? 'Choose a new password' : 'Reset your password')}</h1>
    {state.sent ? <p className="auth-message auth-success" role="status">{t('If an account exists for this email, a reset link is on its way. Open the latest link in this browser. Check your spam folder too.')}</p> :
      <p className="auth-intro">{t(reset ? 'Use at least 8 characters.' : 'Enter your account email to receive a reset link. Open it in this browser.')}</p>}
    <form action={action} className="auth-form">
      {reset ? <>
        <div className="auth-field"><label htmlFor="password">{t('New password')}</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required /></div>
        <div className="auth-field"><label htmlFor="confirmation">{t('Confirm new password')}</label>
          <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required /></div>
      </> : <div className="auth-field"><label htmlFor="email">{t('Email')}</label>
        <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} defaultValue={state.email || ''} required /></div>}
      {(state.error || (expired && !state.sent)) && <p role="alert" className="auth-message auth-error">{t(state.error || invalidRecoveryLink)}</p>}
      {state.error === invalidRecoveryLink && reset ? <Link href="/auth/forgot-password">{t('Request a new link')}</Link> :
        <button className="primary auth-submit" disabled={pending}>{t(reset ? 'Save new password' : state.sent ? 'Send another link' : 'Send reset link')}</button>}
    </form>
    <p className="auth-switch"><Link href="/login">{t('Back to log in')}</Link></p>
  </section>;
}
