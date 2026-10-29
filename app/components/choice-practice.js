'use client';

import { useEffect, useRef, useState } from 'react';
import { submitChoiceAnswer, submitPracticeSkip } from '../actions';
import { submitSharedChoice, submitSharedSkip } from '../shared/actions';
import { getTranslation, getTranslationLanguage } from '../../lib/practice-exercises';
import { useLanguage } from './language';
import SessionSummary from './session-summary';
import ExerciseIcon from './exercise-icon';

export default function ChoicePractice({ sessionId, listId, words, initialAnswers = [], initialIndex = 0, questions, shared }) {
  const { language, t } = useLanguage();
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(initialIndex);
  const [selectedId, setSelectedId] = useState(null);
  const [questionLanguage, setQuestionLanguage] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const nextButton = useRef(null);
  const retryButton = useRef(null);
  const wordHeading = useRef(null);
  const summary = useRef(null);
  const movedForward = useRef(false);
  const word = words[index];
  const activeLanguage = questionLanguage || language;
  const options = questions?.[activeLanguage]?.[word?.id] || [];
  const available = options.length === 4;
  const completed = Math.min(index + (feedback ? 1 : 0), words.length);
  const progress = words.length ? Math.round(completed / words.length * 100) : 0;

  useEffect(() => {
    if (feedback) nextButton.current?.focus();
  }, [feedback]);

  useEffect(() => {
    if (error) retryButton.current?.focus();
  }, [error]);

  useEffect(() => {
    if (movedForward.current) (wordHeading.current || summary.current)?.focus();
    movedForward.current = false;
  }, [index]);

  async function choose(optionId, retry = false) {
    if (!word || busy.current || feedback || !available || (error && !retry)) return;
    const submittedLanguage = activeLanguage;
    busy.current = true;
    setSaving(true);
    setError(false);
    setSelectedId(optionId);
    setQuestionLanguage(submittedLanguage);
    try {
      const result = await (shared ? submitSharedChoice : submitChoiceAnswer)(sessionId, word.id, optionId, submittedLanguage);
      setAnswers((previous) => [...previous, { wordId: word.id, known: result.known, revealed: false }]);
      setFeedback({ known: result.known });
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  function next() {
    if (!feedback || busy.current) return;
    movedForward.current = true;
    setIndex((previous) => previous + 1);
    setSelectedId(null);
    setQuestionLanguage(null);
    setFeedback(null);
    setError(false);
  }

  async function skip(retry = false) {
    if (!word || busy.current || feedback || (error && !retry)) return;
    busy.current = true;
    setSaving(true);
    setError(false);
    setQuestionLanguage(activeLanguage);
    try {
      await (shared ? submitSharedSkip : submitPracticeSkip)(sessionId, word.id);
      movedForward.current = true;
      setIndex((previous) => previous + 1);
      setSelectedId(null);
      setQuestionLanguage(null);
    } catch { setError(true); }
    finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <section className="card practice-card choice-practice" aria-label={t('Choice practice')}>
    <div className="session-progress">
      <div className="session-progress-label"><span>{word ? `${t('Word')} ${index + 1} ${t('of')} ${words.length}` : t('SESSION COMPLETE')}</span><strong>{progress}%</strong></div>
      <div className="session-progress-track" role="progressbar" aria-label={t('Session progress')} aria-valuemin={0} aria-valuemax={words.length} aria-valuenow={completed}>
        <div className="session-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
    {word ? <>
      <div className="exercise-heading"><span className="eyebrow"><ExerciseIcon mode="multiple-choice" /><span>{t('Choose the translation')}</span></span><h2 ref={wordHeading} tabIndex={-1} lang="pt-PT">{word.portuguese}</h2><p>{t('Select the correct meaning.')}</p></div>
      {available ? <div className="choice-options" role="group" aria-label={t('Translation choices')}>
        {options.map((option) => {
          const selected = selectedId === option.id;
          const correct = feedback && option.id === word.id;
          return <button key={option.id} type="button" disabled={saving || Boolean(feedback) || error} aria-pressed={selected} lang={option.language || activeLanguage}
            className={`choice-option${selected ? ' is-selected' : ''}${correct ? ' is-correct' : ''}${feedback && selected && !feedback.known ? ' is-wrong' : ''}`}
            onClick={() => choose(option.id)}>
            <span>{option.label}</span>{option.language && option.language !== activeLanguage && <small className="translation-fallback">{t('English')}</small>}{feedback && (correct || selected) && <span aria-hidden="true">{correct ? '✓' : '✕'}</span>}
          </button>;
        })}
      </div> : <p className="exercise-unavailable" role="status">{t('Not enough translations for this question. Skip this word to continue.')}</p>}
      {feedback && <div className={`exercise-feedback ${feedback.known ? 'is-correct' : 'is-wrong'}`} role="status">
        <strong>{t(feedback.known ? 'Correct!' : 'Not quite.')}</strong>
        <span>{t('Correct translation')}</span>
        <p lang={getTranslationLanguage(word, activeLanguage)}>{getTranslation(word, activeLanguage) || t('Translation unavailable')}</p>
        {getTranslationLanguage(word, activeLanguage) !== activeLanguage && <small className="translation-fallback">{t('English')}</small>}
      </div>}
      {feedback ? <button ref={nextButton} type="button" className="primary exercise-next" onClick={next}>{t(index + 1 === words.length ? 'Finish session' : 'Next word')} <span aria-hidden="true">→</span></button> :
        <button type="button" className="exercise-skip" disabled={saving || error} onClick={() => skip()}>{t(saving ? 'Saving…' : 'Skip')}</button>}
      {error && <><p role="alert">{t('Could not save your session. Please try again.')}</p>
        <button ref={retryButton} type="button" className="primary exercise-next" disabled={saving} onClick={() => selectedId === null ? skip(true) : choose(selectedId, true)}>{t('Retry save')}</button></>}
    </> : <div ref={summary} tabIndex={-1} aria-label={t('SESSION COMPLETE')}><SessionSummary shared={shared} listId={listId} answers={answers} words={words} skipped={index - answers.length} /></div>}
  </section>;
}
