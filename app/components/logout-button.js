'use client';
import { useActionState } from 'react';
import { logout } from '../auth/actions';
import { useLanguage } from './language';

export default function LogoutButton() {
  const [state, action, pending] = useActionState(logout, {});
  const { t } = useLanguage();
  return <form action={action} className="header-logout">
    <button disabled={pending}>{t(pending ? 'Logging out…' : 'Log out')}</button>
    {state?.error && <span role="alert">{t(state.error)}</span>}
  </form>;
}
