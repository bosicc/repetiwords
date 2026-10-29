'use client';
import { useEffect, useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../components/language';
import { addListWords, changeListWord } from './actions';

export default function ListWords({ listId, words }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [pending, startTransition] = useTransition();
  const [revision, setRevision] = useState(0);
  const batch = query.includes(',');
  useEffect(() => {
    const controller = new AbortController();
    setResults([]); setError(false); setLoading(Boolean(query.trim()) && !batch);
    if (!query.trim() || batch) return () => controller.abort();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/word-lists/${listId}/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        if (!controller.signal.aborted) setResults(data);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, listId, revision, batch]);
  function addBatch(event) {
    event.preventDefault();
    if (pending || !query.split(',').some(word => word.trim())) return;
    setError(false);
    startTransition(async () => {
      try {
        const result = await addListWords(listId, query);
        setBatchResult(result);
        setQuery(''); setResults([]);
        setRevision(value => value + 1);
        router.refresh();
      } catch { setError(true); }
    });
  }
  function update(wordId, remove) {
    setError(false);
    startTransition(async () => {
      try {
        await changeListWord(listId, wordId, remove);
        if (!remove) { setQuery(''); setResults([]); }
        setRevision((value) => value + 1);
        router.refresh();
      } catch { setError(true); }
    });
  }
  const meaning = (word) => language === 'uk' ? word.ukrainian || word.english : word.english;
  return <section className="card settings-section word-list-editor" aria-labelledby="list-words-heading">
    <h2 id="list-words-heading">{t('Words in this list')} <span className="word-list-count">{words.length}</span></h2>
    <div role="status" aria-live="polite">
      {batchResult && <p>{t('Words added:')} {batchResult.added}</p>}
      {batchResult?.missing.length > 0 && <div className="word-list-missing"><strong>{t('Words not found in the dictionary:')}</strong><ul>{batchResult.missing.map(word => <li key={word} lang="pt-PT">{word}</li>)}</ul></div>}
    </div>
    <form className="word-list-add-form" onSubmit={addBatch}>
      <label htmlFor={inputId}>{t('Find a word or paste words separated by commas')}</label>
      <textarea className="word-search-input" id={inputId} rows={3} value={query} maxLength={10000} onChange={(event) => setQuery(event.target.value)} placeholder={t('For example: café, água, casa')} disabled={pending} autoComplete="off" aria-describedby={`${inputId}-hint`} />
      <p id={`${inputId}-hint`} className="word-list-add-hint">{t('Add exact Portuguese words separated by commas. Repeated words are skipped. You can also search for one word or translation.')}</p>
      <button type="submit" disabled={pending || !query.split(',').some(word => word.trim())}>{t(pending ? 'Adding…' : 'Add words')}</button>
    </form>
    <div role="status">{loading && <p>{t('Searching…')}</p>}{!batch && query.trim() && !loading && !error && !results.length && <p>{t('No matching words to add.')}</p>}</div>
    {!batch && results.length > 0 && <ul className="word-search-results" aria-label={t('Matching words')}>{results.map((word) => <li key={word.id}><button type="button" disabled={pending} onClick={() => update(word.id, false)}><span><strong lang="pt-PT">{word.portuguese}</strong><small>{meaning(word)}</small></span><span>{t('Add')} +</span></button></li>)}</ul>}
    {error && <p role="alert">{t('Could not update or search this list. Please try again.')}</p>}
    {words.length ? <ul className="saved-list-words">{words.map((word) => <li key={word.id}><span><strong lang="pt-PT">{word.portuguese}</strong><small>{meaning(word)}</small></span><button type="button" disabled={pending} onClick={() => update(word.id, true)} aria-label={`${t('Remove')} ${word.portuguese}`}>{t('Remove')}</button></li>)}</ul> : <p>{t('Your list is empty. Search above to add words.')}</p>}
  </section>;
}
