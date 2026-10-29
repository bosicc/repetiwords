'use client';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import ActionIcon from '../components/action-icon';
import { setListSharing } from '../shared/actions';

export default function ShareList({ listId, initialToken }) {
  const { t } = useLanguage();
  const id = useId();
  const dialog = useRef(null);
  const [token, setToken] = useState(initialToken);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [origin, setOrigin] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  function share(enabled) {
    setError(false); setCopied(false);
    startTransition(async () => {
      try {
        setToken(await setListSharing(listId, enabled));
        if (!enabled) setOpen(false);
      } catch { setError(true); }
    });
  }
  function show() {
    setOrigin(window.location.origin);
    setCopied(false); setError(false); setOpen(true);
    if (!token) share(true);
  }
  async function copy() {
    setError(false);
    try { await navigator.clipboard.writeText(`${origin}/shared/${token}`); setCopied(true); }
    catch { setError(true); }
  }
  return <div className="list-sharing">
    <button className={`list-share-trigger icon-button${token ? ' is-sharing' : ''}`} type="button" onClick={show} disabled={pending && !open} aria-label={t('Share list by link')} title={t('Share list by link')} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}>
      <ActionIcon name="share" />
    </button>
    <dialog ref={dialog} id={id} className="share-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)}
      onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="share-dialog-content">
        <div className="share-dialog-heading">
          <span className="share-dialog-icon"><ActionIcon name="share" size={22} /></span>
          <h2 id={`${id}-title`}>{t('Share list')}</h2>
          <button className="icon-button share-dialog-close" type="button" aria-label={t('Close')} onClick={() => setOpen(false)}><ActionIcon name="close" /></button>
        </div>
        <p id={`${id}-description`} className="share-dialog-description">{t('Anyone with the link can practise.')}</p>
        {token ? <>
          <div className="share-link-row">
            <ActionIcon name="link" size={18} />
            <input aria-label={t('Public link')} readOnly value={`${origin}/shared/${token}`} onFocus={event => event.target.select()} />
            <button type="button" className={`icon-button share-copy${copied ? ' is-copied' : ''}`} onClick={copy} aria-label={t(copied ? 'Link copied!' : 'Copy link')} title={t(copied ? 'Link copied!' : 'Copy link')}><ActionIcon name={copied ? 'check' : 'copy'} /></button>
            <a className="icon-button share-open" href={`/shared/${token}`} target="_blank" rel="noopener noreferrer" aria-label={t('Open public list')} title={t('Open public list')}><ActionIcon name="external" size={18} /></a>
          </div>
          <div className="share-dialog-footer">
            <span className="share-link-status" role="status"><span aria-hidden="true" />{t(copied ? 'Link copied!' : 'Link sharing is on')}</span>
            <button type="button" className="share-revoke" disabled={pending} onClick={() => share(false)}><ActionIcon name="unlink" size={16} />{t(pending ? 'Saving…' : 'Stop sharing')}</button>
          </div>
        </> : <div className="share-link-loading" role="status">{t(pending ? 'Creating link…' : 'Link unavailable')}</div>}
        {error && <div className="share-dialog-error" role="alert"><p>{t('Could not share or copy the link. Please try again.')}</p>{!token && <button type="button" disabled={pending} onClick={() => share(true)}>{t('Try again')}</button>}</div>}
      </div>
    </dialog>
  </div>;
}
