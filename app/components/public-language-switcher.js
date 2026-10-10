'use client';

import { useId } from 'react';
import { useLanguage } from './language';

export default function PublicLanguageSwitcher() {
  const { language, t, selectLanguage } = useLanguage();
  const id = useId();
  return <div className="public-language-switcher">
    <label htmlFor={id} className="public-language-label">{t('Language')}</label>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></svg>
    <select id={id} value={language} onChange={(event) => selectLanguage(event.target.value)}>
      <option value="en" lang="en">English</option><option value="uk" lang="uk">Українська</option>
    </select>
  </div>;
}
