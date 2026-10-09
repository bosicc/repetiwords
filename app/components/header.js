'use client';

import Link from 'next/link';
import { useLanguage } from './language';
import StartPractice from './start-practice';
import LogoutButton from './logout-button';

export default function Header({ signedIn }) {
  const { t } = useLanguage();
  return <header className="app-header">
    <Link className="brand" href="/" aria-label="Repeti Words" translate="no">
      <img src="/icons/repeti-orbit.svg" width="28" height="28" alt="" aria-hidden="true" />
      <span className="brand-name">Repeti Words</span>
    </Link>
    <div className="header-actions">{signedIn ? <><StartPractice /><LogoutButton /></> : <nav aria-label="Account"><Link href="/login">{t('Log in')}</Link><Link href="/register">{t('Register')}</Link></nav>}</div>
  </header>;
}
