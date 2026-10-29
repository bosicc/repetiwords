'use client';
import { useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import { setListSharing } from '../shared/actions';

export default function ShareList({ listId, initialToken }) {
  const { t } = useLanguage();
  const [token, setToken] = useState(initialToken);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  function share(enabled) {
    setError(false); setCopied(false);
    startTransition(async () => {
      try { setToken(await setListSharing(listId, enabled)); setOpen(enabled); }
      catch { setError(true); }
    });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`); setCopied(true); }
    catch { setError(true); }
  }
  return <section className="list-sharing">
    <button type="button" disabled={pending} onClick={() => token ? setOpen(!open) : share(true)}>{t(pending ? 'Saving…' : 'Share list by link')}</button>
    {open && token && <div className="shared-link-panel">
      <p>{t('Anyone with this link can view and practise this list.')}</p>
      <a href={`/shared/${token}`}>{t('Open public list')}</a>
      <input aria-label={t('Public link')} readOnly value={typeof window === 'undefined' ? `/shared/${token}` : `${window.location.origin}/shared/${token}`} onFocus={event => event.target.select()} />
      <div className="shared-actions"><button type="button" onClick={copy}>{t(copied ? 'Link copied!' : 'Copy link')}</button><button type="button" disabled={pending} onClick={() => share(false)}>{t('Stop sharing')}</button></div>
    </div>}
    {error && <p role="alert">{t('Could not share or copy the link. Please try again.')}</p>}
  </section>;
}
