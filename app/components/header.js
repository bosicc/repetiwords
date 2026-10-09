'use client';

import Link from 'next/link';
import { useLanguage } from './language';
import StartPractice from './start-practice';

export default function Header() {
  const { t } = useLanguage();
  return <header className="app-header">
    <Link className="brand" href="/" aria-label={`Repeti · ${t('Vocabulary')}`}>
      <img src="/icons/repeti-orbit.svg" width="28" height="28" alt="" aria-hidden="true" />
      <span className="brand-name">repeti</span><span className="brand-product">{t('Vocabulary')}</span>
    </Link>
    <StartPractice />
  </header>;
}
