'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import { claimSharedProgress } from './actions';
import ActionIcon from '../components/action-icon';
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
  const isSaved = saved || shared.signedIn;
  return <section className={`shared-progress-cta${isSaved ? ' is-saved' : ''}`} aria-label={t(isSaved ? 'Your progress is saved to your account.' : 'Keep your progress')}>
    <span className="progress-cta-icon"><ActionIcon name={isSaved ? 'check' : 'bookmark'} size={24} /></span>
    {isSaved ? <p role="status">{t('Your progress is saved to your account.')}</p> : <div className="progress-cta-content">
      <h3>{t('Keep your progress')}</h3>
      <p className="progress-cta-description">{t('Save this session and keep learning.')}</p>
      {shared.canClaim ? <button className="progress-cta-button" type="button" disabled={pending} onClick={claim}>{t(pending ? 'Saving…' : 'Save my progress')}<ActionIcon name="arrow" size={18} /></button> : <>
        <Link className="progress-cta-button" href={`/register?next=${next}`}>{t('Sign up to save progress')}<ActionIcon name="arrow" size={18} /></Link>
        <p className="progress-cta-login">{t('Already have an account?')} <Link href={`/login?next=${next}`}>{t('Log in')}</Link></p>
        <p className="progress-cta-note">{t('Your results stay in this browser for 24 hours.')}</p>
      </>}
      {error && <p className="progress-cta-error" role="alert">{t('Could not save your session. Please try again.')}</p>}
    </div>}
  </section>;
}
