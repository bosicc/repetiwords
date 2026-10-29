'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import { claimSharedProgress } from './actions';
export default function ProgressCta({ shared }) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(shared.signedIn);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const attempted = useRef(false);
  const next = encodeURIComponent(`/shared/practice/${shared.sessionId}`);
  function claim() {
    setError(false);
    startTransition(async () => {
      try { await claimSharedProgress(shared.sessionId); setSaved(true); }
      catch { setError(true); }
    });
  }
  useEffect(() => {
    if (shared.canClaim && !attempted.current) { attempted.current = true; claim(); }
  }, [shared.canClaim]);
  return <section className="shared-progress-cta">
    {saved ? <p role="status">{t('Your progress is saved to your account.')}</p> : shared.canClaim ? <><p>{t('Save this practice to your account.')}</p><button type="button" disabled={pending} onClick={claim}>{t(pending ? 'Saving…' : 'Save my progress')}</button></> : <>
      <h3>{t('Keep your progress')}</h3><p>{t('Create an account or log in to save this practice. Your results are available in this browser for 24 hours.')}</p>
      <div className="shared-actions"><Link className="primary" href={`/register?next=${next}`}>{t('Sign up to save progress')}</Link><Link href={`/login?next=${next}`}>{t('Log in')}</Link></div>
    </>}
    {error && <p role="alert">{t('Could not save your session. Please try again.')}</p>}
  </section>;
}
