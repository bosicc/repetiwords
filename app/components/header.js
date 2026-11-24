'use client';

import { useTransition } from 'react';
import { changeStudyLanguage } from '../actions';
import Link from 'next/link';
import { studyLanguages } from '../../lib/study-languages';
import { usePathname } from 'next/navigation';
import { useLanguage } from './language';
import StartPractice from './start-practice';
import LogoutButton from './logout-button';
import PublicLanguageSwitcher from './public-language-switcher';

const courseFlags = { 'pt-PT': '🇵🇹', 'es-ES': '🇪🇸' };

export default function Header({ signedIn, superAdmin = false, practiceCount, practiceMode }) {
  const { t, studyLanguage } = useLanguage();
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const inPractice = /^\/(?:shared\/)?practice(?:\/|$)/.test(pathname || '');
  const authNext = pathname?.startsWith('/shared/') ? `?next=${encodeURIComponent(pathname)}` : '';
  return <header className={`app-header${signedIn ? '' : ' public-header'}`}>
    <Link className="brand" href="/" aria-label="Repeti Words" translate="no">
      <img src="/icons/repeti-orbit.svg" width="28" height="28" alt="" aria-hidden="true" />
      <span className="brand-name">Repeti Words</span>
    </Link>
    {signedIn ? <>
      <div className="header-actions header-primary">
        <div className="study-switcher" role="group" aria-label={t('I’m learning')}>
          <span>{t('I’m learning')}</span>
          {Object.entries(courseFlags).map(([code, flag]) => (
            <button key={code} type="button" title={t(studyLanguages[code])} aria-label={t(studyLanguages[code])}
              aria-pressed={studyLanguage === code} disabled={pending}
              onClick={() => {
                if (code !== studyLanguage) startTransition(() => changeStudyLanguage(code, pathname));
              }}>
              <span aria-hidden="true">{flag}</span>
            </button>
          ))}
        </div>
        {superAdmin && <Link className="header-admin" href="/admin">{t('Admin')}</Link>}
        <LogoutButton />
      </div>
      <div className="header-actions header-secondary">
        <PublicLanguageSwitcher />
        {!inPractice && !pathname?.startsWith('/shared/') && <StartPractice count={practiceCount} mode={practiceMode} />}
      </div>
    </> : <div className="header-actions">
      <nav aria-label={t('Account')}><Link href={`/login${authNext}`}>{t('Log in')}</Link><Link href={`/register${authNext}`}>{t('Register')}</Link></nav>
      <PublicLanguageSwitcher />
    </div>}
  </header>;
}
