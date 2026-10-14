'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage, Text } from './components/language';
import { submitPracticeAnswer } from './actions';
import SessionSummary from './components/session-summary';

export default function Practice({ words, sessionId, listId, initialAnswers = [], initialIndex = 0 }) {
  const { language, t } = useLanguage();
  const sessionWords = words;
  const busy = useRef(false);
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(initialIndex);
  const [revealed, setRevealed] = useState(false);
  const [usedReveal, setUsedReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState('');
  const word = sessionWords[index];
  const completed = Math.min(index + (showAnswer ? 1 : 0), sessionWords.length);
  const progress = sessionWords.length ? Math.round(completed / sessionWords.length * 100) : 0;

  useEffect(() => {
    if (!showAnswer) return;
    const timer = setTimeout(() => {
      setIndex((previous) => previous + 1);
      setRevealed(false);
      setUsedReveal(false);
      setShowAnswer(false);
      setSaving(false);
      busy.current = false;
    }, 1000);
    return () => clearTimeout(timer);
  }, [showAnswer]);

  useEffect(() => {
    if (!word) return;

    function handleKeyDown(event) {
      if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.isComposing ||
          event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.closest('input, textarea, select, [role="textbox"], .language-bar'))) return;

      const isYes = event.code === 'Space';
      const isNo = event.code === 'KeyX' || event.key.toLowerCase() === 'x';
      const isSkip = event.key === 'ArrowRight';
      if (!isYes && !isNo && !isSkip) return;

      event.preventDefault();
      if (event.repeat) return;
      answer(isSkip ? null : isYes);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [word, usedReveal]);

  function nextWord() { answer(null); }

  async function answer(known) {
    if (busy.current || !word) return;
    busy.current = true;
    setSaving(true);
    setError('');
    let showingFeedback = false;
    try {
      await submitPracticeAnswer(sessionId, word.id, known, usedReveal);
      if (known !== null) {
        setAnswers((previous) => [...previous, { wordId: word.id, known, revealed: usedReveal }]);
        showingFeedback = true;
        setShowAnswer(true);
      } else {
        setIndex((previous) => previous + 1);
        setRevealed(false);
        setUsedReveal(false);
      }
    } catch { setError(true); }
    finally { if (!showingFeedback) { busy.current = false; setSaving(false); } }
  }

  return <section className={`card practice-card${word ? ' practice-active' : ''}`} aria-label={t("Vocabulary practice")}>
    <div className="session-progress">
      <div className="session-progress-label"><span>{word ? `${t('Word')} ${index + 1} ${t('of')} ${sessionWords.length}` : t('SESSION COMPLETE')}</span><strong>{progress}%</strong></div>
      <div className="session-progress-track" role="progressbar" aria-label={t('Session progress')} aria-valuemin={0} aria-valuemax={sessionWords.length} aria-valuenow={completed} aria-valuetext={`${completed} ${t('of')} ${sessionWords.length}`}>
        <div className="session-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
    {word ? <>
      <div className="practice-word-content">
        <h2 lang="pt-PT">{word.portuguese}</h2>
        {(revealed || showAnswer) && <p role={showAnswer ? 'status' : undefined} lang={language}>{(language === 'uk' ? word.ukrainian : word.english) || t('Translation unavailable')}</p>}
        <button disabled={saving} className="reveal" onClick={() => { setRevealed(!revealed); setUsedReveal(true); }}>{revealed ? t('Hide meaning') : t('Reveal meaning')}</button>
      </div>
      <div className="choices"><button disabled={saving} className="answer-no" aria-keyshortcuts="X" onClick={() => answer(false)}>
        <span className="answer-label-desktop"><Text>NO · Practice again</Text></span><span className="answer-label-mobile"><Text>NO</Text></span><kbd aria-hidden="true">X</kbd></button>
        <button disabled={saving} className="answer-skip" aria-keyshortcuts="ArrowRight" onClick={nextWord}><Text>Skip</Text> <kbd aria-hidden="true">→</kbd></button>
        <button disabled={saving} className="answer-yes" aria-keyshortcuts="Space" onClick={() => answer(true)}>
          <span className="answer-label-desktop"><Text>YES · I know it</Text></span><span className="answer-label-mobile"><Text>YES</Text></span><kbd aria-hidden="true"><Text>Space</Text></kbd></button></div>
    </> : <SessionSummary listId={listId} answers={answers} words={sessionWords} skipped={index - answers.length} />}
    {error && <p role="alert">{t('Could not save your session. Please try again.')}</p>}
  </section>;
}
