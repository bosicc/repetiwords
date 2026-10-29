'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './language';
import StartPractice from './start-practice';
import LogoutButton from './logout-button';
import PublicLanguageSwitcher from './public-language-switcher';

export default function Header({ signedIn, superAdmin = false, practiceCount, practiceMode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const inPractice = /^\/(?:shared\/)?practice(?:\/|$)/.test(pathname || '');
  const authNext = pathname?.startsWith('/shared/') ? `?next=${encodeURIComponent(pathname)}` : '';
  return <header className={`app-header${signedIn ? '' : ' public-header'}`}>
    <Link className="brand" href="/" aria-label="Repeti Words" translate="no">
      <img src="/icons/repeti-orbit.svg" width="28" height="28" alt="" aria-hidden="true" />
      <span className="brand-name">Repeti Words</span>
    </Link>
    <div className="header-actions">{signedIn ? <>{superAdmin && <Link className="header-admin" href="/admin">{t('Admin')}</Link>}{!inPractice && !pathname?.startsWith('/shared/') && <StartPractice count={practiceCount} mode={practiceMode} />}<LogoutButton /></> : <><nav aria-label={t('Account')}><Link href={`/login${authNext}`}>{t('Log in')}</Link><Link href={`/register${authNext}`}>{t('Register')}</Link></nav><PublicLanguageSwitcher /></>}</div>
  </header>;
}
