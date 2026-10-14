'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './language';
import PracticeLaunchForm from './practice-launch-form';

export default function StartPractice({ count = 30, mode = 'self-assessment' }) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  const dialogId = useId();
  const pathname = usePathname();
  const listMatch = pathname?.match(/^\/word-lists\/([1-9]\d*)\/?$/);
  const listId = listMatch && Number.isSafeInteger(Number(listMatch[1])) ? Number(listMatch[1]) : undefined;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => { setOpen(false); setPending(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function dismiss() {
    if (!pending) setOpen(false);
  }

  function showDialog(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 ||
        typeof dialogRef.current?.showModal !== 'function') return;
    event.preventDefault();
    setOpen(true);
  }

  return <div className="header-practice">
    <Link href={listId ? `/practice?listId=${listId}` : '/practice'} prefetch={false} className="primary start-practice" aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={showDialog}>
      <span className="header-practice-label">{t(listId ? 'Practice my list' : 'Practice')}</span> <span aria-hidden="true">→</span>
    </Link>
    <dialog ref={dialogRef} id={dialogId} className="practice-dialog" aria-labelledby={`${dialogId}-title`}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClose={() => { setOpen(false); setPending(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
      onKeyDown={(event) => event.stopPropagation()}>
      <div className="practice-dialog-content">
        <div className="practice-dialog-heading">
          <div>
            <h2 id={`${dialogId}-title`}>{t(listId ? 'Practice my list' : 'Choose your practice')}</h2>
          </div>
          <button type="button" className="practice-dialog-close" aria-label={t('Close')} disabled={pending} onClick={dismiss}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {open && <PracticeLaunchForm count={count} mode={mode} listId={listId} onCancel={dismiss} onPendingChange={setPending} />}
      </div>
    </dialog>
  </div>;
}
