'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { beginPractice } from '../actions';
import { PRACTICE_MODES, isPracticeMode } from '../../lib/practice-modes';
import { useLanguage } from './language';
import ExerciseIcon from './exercise-icon';

function StartButton() {
  const { pending } = useFormStatus();
  const { t } = useLanguage();
  return <button type="submit" className="primary practice-picker-submit" disabled={pending}>
    {t(pending ? 'Starting…' : 'Start practice')} <span aria-hidden="true">→</span>
  </button>;
}

export default function PracticeLaunchForm({ count, mode, listId, onCancel, onPendingChange }) {
  const { t } = useLanguage();
  const countId = useId();
  const [selectedMode, setSelectedMode] = useState(isPracticeMode(mode) ? mode : 'self-assessment');
  const [wordCount, setWordCount] = useState(String([10, 30, 100].includes(count) ? count : 30));
  const [state, action, pending] = useActionState(beginPractice, null);
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  return <form action={action} className="practice-picker-form" aria-busy={pending}>
    {listId && <input type="hidden" name="listId" value={listId} />}
    <fieldset className="practice-mode-fieldset" disabled={pending}>
      <legend>{t('Practice type')}</legend>
      <div className="practice-mode-grid">
        {PRACTICE_MODES.map((exercise) => <label className="practice-mode-card" key={exercise.id}>
          <input type="radio" name="mode" value={exercise.id} checked={selectedMode === exercise.id} onChange={() => setSelectedMode(exercise.id)} required />
          <span className="practice-mode-content">
            <span className="practice-mode-icon"><ExerciseIcon mode={exercise.id} /></span>
            <span className="practice-mode-check" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" focusable="false"><circle cx="10" cy="10" r="9" fill="currentColor" /><path d="m6 10 2.5 2.5L14 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="practice-mode-copy"><strong>{t(exercise.title)}</strong><span>{t(exercise.description)}</span></span>
          </span>
        </label>)}
      </div>
    </fieldset>
    <div className="practice-picker-footer">
      <label className="practice-count-field" htmlFor={countId}>{t('Words per session')}
        <select id={countId} name="count" value={wordCount} onChange={(event) => setWordCount(event.target.value)} disabled={pending}>
          {[10, 30, 100].map((number) => <option key={number} value={number}>{number}</option>)}
        </select>
      </label>
      <div className="practice-picker-actions">
        {onCancel && <button type="button" className="practice-picker-cancel" disabled={pending} onClick={onCancel}>{t('Cancel')}</button>}
        <StartButton />
      </div>
    </div>
    {state?.error && <p className="practice-picker-error" role="alert">{t(state.error)}</p>}
  </form>;
}
