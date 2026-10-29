'use client';
import { useLanguage } from '../components/language';
export default function PublicWords({ words }) {
  const { t, language } = useLanguage();
  return <section className="card"><h2>{t('Words in this list')}</h2><ul className="saved-list-words">{words.map(word => <li key={word.id}><span><strong lang="pt-PT">{word.portuguese}</strong><small>{language === 'uk' ? word.ukrainian || word.english : word.english}</small></span></li>)}</ul></section>;
}
