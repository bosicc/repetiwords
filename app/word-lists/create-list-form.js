'use client';
import { useActionState } from 'react';
import { useLanguage } from '../components/language';
import { createList } from './actions';

export default function CreateListForm() {
  const { t } = useLanguage();
  const [state, action, pending] = useActionState(createList, null);
  return <form action={action} className="word-list-create-button">
    <input type="hidden" name="name" value={t('Untitled list')} />
    <button className="landing-primary" disabled={pending}>{t(pending ? 'Creating…' : 'Create list')} <span aria-hidden="true">+</span></button>
    {state?.error && <p role="alert">{t(state.error)}</p>}
  </form>;
}
