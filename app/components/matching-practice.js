'use client';

import { useEffect, useRef, useState } from 'react';
import { submitMatchingRound } from '../actions';
import { getTranslation, getTranslationLanguage, translationsEquivalent } from '../../lib/practice-exercises';
import { useLanguage } from './language';
import SessionSummary from './session-summary';
import ExerciseIcon from './exercise-icon';

function shuffledTranslations(words, sessionId, index, language) {
  let seed = 2166136261;
  for (const character of `${sessionId}:${index}:${language}:${words.map((word) => word.id).join(',')}`) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const shuffled = [...words];
  for (let position = shuffled.length - 1; position > 0; position--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const other = seed % (position + 1);
    [shuffled[position], shuffled[other]] = [shuffled[other], shuffled[position]];
  }
  if (shuffled.length > 1 && shuffled.every((word, position) => word.id === words[position].id)) shuffled.push(shuffled.shift());
  return shuffled;
}

function initialBoard() {
  return { selectedWordId: null, selectedTranslationId: null, pairs: [], attempts: [], mistakes: [], errorWordId: null, errorTranslationId: null, feedback: '' };
}

function MatchingRound({ sessionId, words, index, capacity, language, focusOnMount, onLock, onContinue }) {
  const { t } = useLanguage();
  const [roundWords] = useState(() => words.slice(index, index + capacity));
  const [translations] = useState(() => shuffledTranslations(roundWords, sessionId, index, language));
  const [board, setBoard] = useState(initialBoard);
  const boardRef = useRef(board);
  const [saveState, setSaveState] = useState('idle');
  const [savedAnswers, setSavedAnswers] = useState(null);
  const saving = useRef(false);
  const nextButton = useRef(null);
  const roundHeading = useRef(null);
  const complete = board.pairs.length === roundWords.length;
  const limitReached = board.attempts.length >= 500;
  const completed = Math.min(index + board.pairs.length, words.length);
  const progress = words.length ? Math.round(completed / words.length * 100) : 0;

  useEffect(() => {
    if (saveState === 'saved') nextButton.current?.focus();
  }, [saveState]);

  useEffect(() => {
    if (focusOnMount) roundHeading.current?.focus();
  }, [focusOnMount]);

  function updateBoard(nextBoard) {
    boardRef.current = nextBoard;
    setBoard(nextBoard);
  }

  async function saveRound(attempts) {
    if (saving.current || saveState === 'saved') return;
    saving.current = true;
    onLock(true);
    setSaveState('saving');
    try {
      const result = await submitMatchingRound(sessionId, attempts, language, roundWords.length);
      setSavedAnswers(Array.isArray(result) ? result : result.answers);
      setSaveState('saved');
    } catch {
      setSaveState('error');
      onLock(false);
    } finally { saving.current = false; }
  }

  function checkPair(wordId, translationId) {
    const current = boardRef.current;
    if (saving.current || current.attempts.length >= 500 || current.pairs.some((pair) => pair.wordId === wordId || pair.translationId === translationId)) return;
    const word = roundWords.find((item) => item.id === wordId);
    const translation = roundWords.find((item) => item.id === translationId);
    if (!word || !translation) return;
    const correct = translationsEquivalent(word, translation, language);
    const nextBoard = {
      ...current, selectedWordId: null, selectedTranslationId: null,
      attempts: [...current.attempts, { wordId, translationId }],
      pairs: correct ? [...current.pairs, { wordId, translationId }] : current.pairs,
      mistakes: correct ? current.mistakes : [...new Set([...current.mistakes, wordId, translationId])],
      errorWordId: correct ? null : wordId,
      errorTranslationId: correct ? null : translationId,
      feedback: correct ? 'Correct pair!' : 'Try another pair.',
    };
    updateBoard(nextBoard);
    if (nextBoard.pairs.length === roundWords.length) saveRound(nextBoard.attempts);
  }

  function selectWord(wordId) {
    const current = boardRef.current;
    if (saving.current || saveState === 'saved' || current.attempts.length >= 500 || current.pairs.some((pair) => pair.wordId === wordId)) return;
    if (current.selectedTranslationId !== null) checkPair(wordId, current.selectedTranslationId);
    else updateBoard({ ...current, selectedWordId: current.selectedWordId === wordId ? null : wordId, errorWordId: null, errorTranslationId: null, feedback: '' });
  }

  function selectTranslation(translationId) {
    const current = boardRef.current;
    if (saving.current || saveState === 'saved' || current.attempts.length >= 500 || current.pairs.some((pair) => pair.translationId === translationId)) return;
    if (current.selectedWordId !== null) checkPair(current.selectedWordId, translationId);
    else updateBoard({ ...current, selectedTranslationId: current.selectedTranslationId === translationId ? null : translationId, errorWordId: null, errorTranslationId: null, feedback: '' });
  }

  return <>
    <div className="session-progress">
      <div className="session-progress-label"><span>{t('Words completed')}: {completed} {t('of')} {words.length}</span><strong>{progress}%</strong></div>
      <div className="session-progress-track" role="progressbar" aria-label={t('Session progress')} aria-valuemin={0} aria-valuemax={words.length} aria-valuenow={completed}>
        <div className="session-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
    <div className="exercise-heading"><span className="eyebrow"><ExerciseIcon mode="matching" /><span>{t('Match the pairs')}</span></span><h2 ref={roundHeading} tabIndex={-1}>{t('Find every pair')}</h2><p>{t('Tap a Portuguese word, then its translation.')}</p></div>
    <p className="matching-round-progress">{t('Pairs matched')}: {board.pairs.length} {t('of')} {roundWords.length}</p>
    <div className="matching-board">
      <div className="matching-column" role="group" aria-label={t('Portuguese')}>
        <h3>{t('Portuguese')}</h3>
        {roundWords.map((word) => {
          const matched = board.pairs.some((pair) => pair.wordId === word.id);
          const selected = board.selectedWordId === word.id;
          return <button key={word.id} type="button" lang="pt-PT" aria-pressed={selected} disabled={matched || saving.current || limitReached} aria-label={`${word.portuguese}${matched ? `, ${t('Matched')}` : ''}`}
            className={`matching-tile${selected ? ' is-selected' : ''}${matched ? ' is-matched' : ''}${board.errorWordId === word.id ? ' is-error' : ''}`} onClick={() => selectWord(word.id)}>
            <span>{word.portuguese}</span>{matched && <span aria-hidden="true">✓</span>}
          </button>;
        })}
      </div>
      <div className="matching-column" role="group" aria-label={t(language === 'uk' ? 'Ukrainian' : 'English')}>
        <h3>{t(language === 'uk' ? 'Ukrainian' : 'English')}</h3>
        {translations.map((word) => {
          const pair = board.pairs.find((item) => item.translationId === word.id);
          const selected = board.selectedTranslationId === word.id;
          const label = getTranslation(word, language) || t('Translation unavailable');
          const labelLanguage = getTranslationLanguage(word, language);
          const pairedWord = pair && roundWords.find((item) => item.id === pair.wordId);
          return <button key={word.id} type="button" aria-pressed={selected} disabled={Boolean(pair) || saving.current || limitReached} aria-label={`${label}${pair ? `, ${t('Matched')}, ${pairedWord.portuguese}` : ''}`}
            className={`matching-tile matching-translation${selected ? ' is-selected' : ''}${pair ? ' is-matched' : ''}${board.errorTranslationId === word.id ? ' is-error' : ''}`} onClick={() => selectTranslation(word.id)}>
            <span lang={labelLanguage}>{label}</span>{labelLanguage !== language && <small className="translation-fallback">{t('English')}</small>}
            {pair && <small lang="pt-PT">✓ {pairedWord.portuguese}</small>}
          </button>;
        })}
      </div>
    </div>
    <div className="matching-status" role="status" aria-live="polite" aria-atomic="true">
      {saveState === 'saving' ? t('Saving…') : saveState === 'saved' ? t('Round saved.') : complete ? t('Round complete.') : board.feedback ? t(board.feedback) : t('Your round is not saved yet.')}
    </div>
    {saveState === 'error' && <p role="alert">{t('Could not save your session. Please try again.')}</p>}
    {limitReached && !complete && <p role="alert">{t('Too many attempts. Reset this round to try again.')}</p>}
    <div className="matching-controls">
      {saveState === 'saved' && <button ref={nextButton} type="button" className="primary exercise-next" onClick={() => onContinue(savedAnswers, roundWords.length)}>{t(index + roundWords.length === words.length ? 'Finish session' : 'Next round')} <span aria-hidden="true">→</span></button>}
      {saveState === 'saving' && <button type="button" className="primary exercise-next" disabled>{t('Saving…')}</button>}
      {saveState === 'error' && <button type="button" className="primary exercise-next" onClick={() => saveRound(board.attempts)}>{t('Retry save')}</button>}
      {!complete && limitReached && <button type="button" className="exercise-reset" onClick={() => updateBoard(initialBoard())}>{t('Reset round')}</button>}
    </div>
  </>;
}

export default function MatchingPractice({ sessionId, words, initialAnswers = [], initialIndex = 0 }) {
  const { language, t } = useLanguage();
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(initialIndex);
  const [capacity, setCapacity] = useState(null);
  const [roundLanguage, setRoundLanguage] = useState(language);
  const [locked, setLocked] = useState(false);
  const continued = useRef(false);
  const summary = useRef(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)');
    const update = () => setCapacity(query.matches ? 4 : 6);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!locked) setRoundLanguage(language);
  }, [language, locked]);

  useEffect(() => {
    if (continued.current && index >= words.length) summary.current?.focus();
  }, [index, words.length]);

  function continueRound(results, count) {
    continued.current = true;
    setAnswers((previous) => [...previous, ...results.filter((answer) => typeof answer.known === 'boolean')]);
    setIndex((previous) => previous + count);
    setRoundLanguage(language);
    setLocked(false);
  }

  return <section className="card practice-card matching-practice" aria-label={t('Matching practice')}>
    {index >= words.length ? <><div className="session-progress-label"><span>{t('SESSION COMPLETE')}</span><strong>100%</strong></div><div ref={summary} tabIndex={-1} aria-label={t('SESSION COMPLETE')}><SessionSummary answers={answers} words={words} skipped={index - answers.length} /></div></> :
      capacity === null ? <p role="status">{t('Loading practice…')}</p> :
        <MatchingRound key={`${index}:${roundLanguage}`} sessionId={sessionId} words={words} index={index} capacity={capacity} language={roundLanguage} focusOnMount={continued.current} onLock={setLocked} onContinue={continueRound} />}
  </section>;
}
