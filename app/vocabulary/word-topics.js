'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../components/language';
import { formatWordCount, getVocabularyTopics } from '../../lib/vocabulary-topics';
import { getTopicIcon } from '../../lib/topic-icons';
import styles from './word-topics.module.css';

export default function WordTopics({ words, selected, onSelect, level }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const topics = getVocabularyTopics(words);
  const label = (name) => t(name === 'uncategorized' ? 'Uncategorized' : name);
  const query = search.trim().toLocaleLowerCase(language);
  const matches = topics.filter(({ name }) => `${label(name)} ${name}`.toLocaleLowerCase(language).includes(query));
  const visible = query || expanded ? matches : matches.slice(0, 8);

  return <section id="word-topics" className={styles.panel} aria-labelledby="word-topics-title">
    <div className={styles.heading}>
      <div><span className={styles.eyebrow}>{t('LEARN BY TOPIC')}</span>
        <h2 id="word-topics-title">{t('Find your next words')}</h2></div>
      <span className={styles.total}>{t('Topics')}: {topics.length}</span>
    </div>
    <p className={styles.intro}>{t('Choose a topic to explore its words and start a focused practice.')}</p>
    <label className={styles.search}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <span className={styles.srOnly}>{t('Search topics')}</span>
      <input type="search" placeholder={t('Search topics')} value={search} onChange={(event) => setSearch(event.target.value)} />
    </label>
    <ul className={styles.grid} id="topic-options">
      {visible.map((topic) => <li key={topic.name}>
        <button type="button" className={styles.topic} aria-pressed={selected === topic.name} aria-controls="vocabulary-results" onClick={() => onSelect(selected === topic.name ? '' : topic.name)}>
          <span className={styles.icon} aria-hidden="true">{getTopicIcon(topic.name)}</span>
          <span className={styles.topicName}>{label(topic.name)}</span>
          <span className={styles.count}>{formatWordCount(topic.count, language)}{selected === topic.name && <span aria-hidden="true"> · ✓</span>}</span>
          <span className={styles.examples} lang="pt-PT">{topic.examples.join(' · ')}</span>
        </button>
        <Link className={styles.cardPractice} href={`/practice?${new URLSearchParams({ topic: topic.name, ...(level ? { level } : {}) })}`} aria-label={`${t('Practice this topic')}: ${label(topic.name)}`}>
          {t('Practice')} <span aria-hidden="true">→</span>
        </Link>
      </li>)}
    </ul>
    {!matches.length && <p role="status" className={styles.empty}>{t(words.length ? 'No topics match your search.' : 'No topics at this level.')}</p>}
    {!query && topics.length > 8 && <button type="button" className={styles.expand} aria-expanded={expanded} aria-controls="topic-options" onClick={() => setExpanded(!expanded)}>
      {t(expanded ? 'Show fewer topics' : 'Show all topics')}{!expanded && ` (${topics.length})`} <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
    </button>}
    <p className={styles.note}>{t('Words can belong to more than one topic.')}</p>
  </section>;
}
