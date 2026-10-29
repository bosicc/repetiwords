'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import { saveSharedList } from './actions';

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
  if (!signedIn) return <div className="shared-save"><Link className="primary" href={`/register?next=${next}`}>{t('Save to My Lists')}</Link><p>{t('Create an account or log in to save your own copy.')} <Link href={`/login?next=${next}`}>{t('Log in')}</Link></p></div>;
  return <div className="shared-save"><button type="button" disabled={pending} onClick={save}>{t(pending ? 'Saving…' : 'Save to My Lists')}</button>{error && <p role="alert">{t('Could not save the list. Please try again.')}</p>}</div>;
}
