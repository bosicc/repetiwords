'use client';

import { useState } from 'react';
import { useLanguage, Text } from '../components/language';
import Link from 'next/link';
import WordTopics from './word-topics';
import { filterVocabulary, formatWordCount } from '../../lib/vocabulary-topics';
import styles from './word-topics.module.css';

export default function VocabularyList({ words }) {
  const { language, t } = useLanguage();
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(words.flatMap((word) => word.categories))].sort((a, b) => a.localeCompare(b));
  const levelWords = filterVocabulary(words, { level });
  const filtered = filterVocabulary(levelWords, { topic: category });
  const practiceQuery = new URLSearchParams({ topic: category });
  if (level) practiceQuery.set('level', level);

  return <section aria-label={t("Vocabulary list")}>
    <div className="filters">
      <label><Text>Word level</Text><select value={level} onChange={(event) => setLevel(event.target.value)}>
        <option value=""><Text>All levels</Text></option>
        {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((value) => <option key={value}>{value}</option>)}
        <option value="unassigned"><Text>Unassigned</Text></option>
      </select></label>
      <label><Text>Category</Text><select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value=""><Text>All categories</Text></option>
        {categories.map((value) => <option key={value} value={value}>{t(value)}</option>)}
        <option value="uncategorized"><Text>Uncategorized</Text></option>
      </select></label>
      <button onClick={() => { setLevel(''); setCategory(''); }}><Text>Reset filters</Text></button>
    </div>
    <WordTopics words={levelWords} selected={category} onSelect={setCategory} level={level} />
    {category && <div className={styles.selection}>
      <div><strong>{t(category === 'uncategorized' ? 'Uncategorized' : category)}</strong>
        <p>{formatWordCount(filtered.length, language)} · {t(level === 'unassigned' ? 'Unassigned' : level || 'All levels')}</p></div>
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
