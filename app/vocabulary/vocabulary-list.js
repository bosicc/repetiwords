'use client';

import { useState } from 'react';
import { useLanguage, Text } from '../components/language';
import Link from 'next/link';
import WordTopics from './word-topics';
import { WORD_LEVELS, filterVocabulary, formatWordCount } from '../../lib/vocabulary-topics';
import styles from './word-topics.module.css';

export default function VocabularyList({ words }) {
  const { language, t } = useLanguage();
  const [levels, setLevels] = useState([]);
  const level = levels.join(',');
  const [category, setCategory] = useState('');
  const categories = [...new Set(words.flatMap((word) => word.categories))].sort((a, b) => a.localeCompare(b));
  const levelWords = filterVocabulary(words, { level });
  const filtered = filterVocabulary(levelWords, { topic: category });
  const practiceQuery = new URLSearchParams({ topic: category });
  if (level) practiceQuery.set('level', level);

  return <section aria-label={t("Vocabulary list")}>
    <div className="filters">
      <fieldset className="vocabulary-level-filter">
        <legend><Text>Word level</Text></legend>
        <div className="vocabulary-level-options">
          <button type="button" aria-pressed={!levels.length} aria-controls="vocabulary-results" onClick={() => setLevels([])}><Text>All levels</Text></button>
          {[...WORD_LEVELS, 'unassigned'].map(value => <button key={value} type="button" aria-pressed={levels.includes(value)} aria-controls="vocabulary-results" onClick={() => setLevels(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>{value === 'unassigned' ? t('Unassigned') : value}</button>)}
        </div>
      </fieldset>
      <label><Text>Category</Text><span className="vocabulary-category-select"><select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value=""><Text>All categories</Text></option>
        {categories.map((value) => <option key={value} value={value}>{t(value)}</option>)}
        <option value="uncategorized"><Text>Uncategorized</Text></option>
      </select><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m7 10 5 5 5-5" /></svg></span></label>
      <button type="button" onClick={() => { setLevels([]); setCategory(''); }}><Text>Reset filters</Text></button>
    </div>
    <WordTopics words={levelWords} selected={category} onSelect={setCategory} level={level} />
    {category && <div className={styles.selection}>
      <div><strong>{t(category === 'uncategorized' ? 'Uncategorized' : category)}</strong>
        <p>{formatWordCount(filtered.length, language)} · {levels.length ? levels.map(value => t(value === 'unassigned' ? 'Unassigned' : value)).join(' + ') : t('All levels')}</p></div>
      {filtered.length > 0 && <Link href={`/practice?${practiceQuery}`} className={styles.practice}>{t('Practice this topic')} <span aria-hidden="true">→</span></Link>}
    </div>}
    <p id="vocabulary-results" role="status"><Text>Showing</Text> {filtered.length} <Text>of</Text> {words.length} <Text>words</Text></p>
    {filtered.length ? <div className="vocabulary-table"><table>
      <thead><tr><th scope="col"><Text>Portuguese</Text></th><th scope="col">{t(language === "uk" ? "Ukrainian" : "English")}</th><th scope="col"><Text>Level</Text></th><th scope="col"><Text>Category</Text></th></tr></thead>
      <tbody>{filtered.map((word) => <tr key={word.id}>
        <td lang="pt-PT"><strong>{word.portuguese}</strong></td><td lang={language}>{(language === "uk" ? word.ukrainian : word.english) || t("Translation unavailable")}</td><td>{word.level || t('Unassigned')}</td>
        <td>{word.categories.length ? word.categories.map(t).join(', ') : t('Uncategorized')}</td>
      </tr>)}</tbody>
    </table></div> : <div className="card"><p><Text>No words match these filters.</Text></p></div>}
  </section>;
}
