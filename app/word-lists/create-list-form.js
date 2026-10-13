'use client';
import { useActionState, useId } from 'react';
import { useLanguage } from '../components/language';
import { createList } from './actions';

export default function CreateListForm() {
  const { t } = useLanguage();
  const id = useId();
  const [state, action, pending] = useActionState(createList, null);
  return <form action={action} className="card settings-section word-list-create">
    <h2>{t('Create a word list')}</h2>
    <label htmlFor={id}>{t('List name')}</label>
    <div className="word-list-create-fields"><input id={id} name="name" maxLength={80} required placeholder={t('For example: At the café')} disabled={pending} /><button className="primary" disabled={pending}>{t(pending ? 'Creating…' : 'Create list')}</button></div>
    {state?.error && <p role="alert">{t(state.error)}</p>}
  </form>;
}
