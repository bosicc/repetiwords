'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import { saveSharedList } from './actions';
import ActionIcon from '../components/action-icon';

export default function SaveList({ token, signedIn, isOwner, listId, saveOnReturn = false }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const attempted = useRef(false);
  const next = encodeURIComponent(`/shared/${token}?save=1`);
  function save() {
    setError(false);
    startTransition(async () => {
      try { const id = await saveSharedList(token); router.push(`/word-lists/${id}`); }
      catch { setError(true); }
    });
  }
  useEffect(() => {
    if (saveOnReturn && signedIn && !isOwner && !attempted.current) { attempted.current = true; save(); }
  }, [saveOnReturn, signedIn, isOwner]);
  if (isOwner) return <Link href={`/word-lists/${listId}`}>{t('Edit my list')}</Link>;
  return <section className="shared-save" aria-label={t('Save this list')}>
    <span className="shared-save-icon"><ActionIcon name="bookmark" size={22} /></span>
    <div className="shared-save-content">
      <h2>{t('Save this list')}</h2>
      <p>{t(signedIn ? 'Add a copy to your lists to edit and practise.' : 'Log in to keep a copy in your account.')}</p>
      {signedIn ? <button className="shared-save-button" type="button" disabled={pending} onClick={save}><ActionIcon name="copy" size={18} />{t(pending ? 'Saving…' : 'Save to My Lists')}</button> : <>
        <div className="shared-save-actions">
          <Link className="shared-save-button" href={`/login?next=${next}`}>{t('Log in to save')}<ActionIcon name="arrow" size={18} /></Link>
          <Link className="shared-save-register" href={`/register?next=${next}`}>{t('Create an account')}</Link>
        </div>
        <p className="shared-save-note">{t('You can practise without an account.')}</p>
      </>}
      {error && <p className="shared-save-error" role="alert">{t('Could not save the list. Please try again.')}</p>}
    </div>
  </section>;
}
