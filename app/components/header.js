'use client';

import Link from 'next/link';
import { useLanguage } from './language';
import StartPractice from './start-practice';
import LogoutButton from './logout-button';
import PublicLanguageSwitcher from './public-language-switcher';

export default function Header({ signedIn, practiceCount, practiceMode }) {
  const { t } = useLanguage();
  return <header className={`app-header${signedIn ? '' : ' public-header'}`}>
    <Link className="brand" href="/" aria-label="Repeti Words" translate="no">
      <img src="/icons/repeti-orbit.svg" width="28" height="28" alt="" aria-hidden="true" />
      <span className="brand-name">Repeti Words</span>
    </Link>
    <div className="header-actions">{signedIn ? <><StartPractice count={practiceCount} mode={practiceMode} /><LogoutButton /></> : <><nav aria-label={t('Account')}><Link href="/login">{t('Log in')}</Link><Link href="/register">{t('Register')}</Link></nav><PublicLanguageSwitcher /></>}</div>
  </header>;
}
