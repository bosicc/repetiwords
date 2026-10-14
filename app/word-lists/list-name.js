'use client';
import { useId, useState, useTransition } from 'react';
import { useLanguage } from '../components/language';
import { renameList } from './actions';
import { usePathname, useRouter } from 'next/navigation';

export default function ListName({ listId, initialName, isNew }) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const inputId = useId();
  const [name, setName] = useState(isNew ? '' : initialName);
  const [saved, setSaved] = useState(initialName);
  const [status, setStatus] = useState('');
  const [pending, startTransition] = useTransition();
  function save() {
    const value = name.trim();
    if (!value) { setStatus('Enter a list name.'); return; }
    if (value === saved) { setName(value); setStatus(''); return; }
    startTransition(async () => {
      try {
        await renameList(listId, value);
        setSaved(value); setName(value); setStatus('Changes are saved automatically.');
        if (isNew) router.replace(pathname, { scroll: false });
      } catch { setStatus('Could not save the list name. Please try again.'); }
    });
  }
  const failed = status === 'Enter a list name.' || status === 'Could not save the list name. Please try again.';
  return <div className="list-name-editor">
    <label htmlFor={inputId}>{t('List name')}</label>
    <input id={inputId} className="list-name-input" value={name} onChange={(event) => { setName(event.target.value); setStatus(''); }} onBlur={save}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
      placeholder={t('Give your list a name')} maxLength={80} autoFocus={isNew} disabled={pending} aria-invalid={failed} aria-describedby={`${inputId}-status`} />
    <p id={`${inputId}-status`} role={failed ? 'alert' : 'status'} className={failed ? 'list-name-error' : 'list-name-status'}>{t(pending ? 'Saving…' : status)}</p>
  </div>;
}
