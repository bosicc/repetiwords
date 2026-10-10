'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ExerciseIcon from './exercise-icon';
import { useLanguage } from './language';
import styles from './landing-demo.module.css';

const words = [
  { id: 'janela', portuguese: 'janela', en: 'window', uk: 'вікно' },
  { id: 'porta', portuguese: 'porta', en: 'door', uk: 'двері' },
  { id: 'livro', portuguese: 'livro', en: 'book', uk: 'книга' },
  { id: 'casa', portuguese: 'casa', en: 'house', uk: 'будинок' },
];
const modes = [
  { id: 'self-assessment', label: 'YES / NO', title: 'Recall the meaning' },
  { id: 'multiple-choice', label: 'Translation', title: 'Choose a translation' },
  { id: 'matching', label: 'Pairs', title: 'Match the pairs' },
];
const optionOrders = [[2, 0, 3, 1], [3, 2, 1, 0], [1, 3, 0, 2]];
const translationOrder = [2, 0, 3, 1];
const ukrainian = {
  'TRY IT HERE': 'СПРОБУЙТЕ ТУТ',
  'A little practice, right now.': 'Трохи практики просто зараз.',
  'Sample exercise': 'Приклад вправи',
  'YES / NO': 'ТАК / НІ',
  'Translation': 'Переклад',
  'Pairs': 'Пари',
  'Recall the meaning': 'Згадайте значення',
  'Choose a translation': 'Виберіть переклад',
  'Match the pairs': 'Знайдіть пари',
  'Sample progress': 'Прогрес прикладу',
  'of': 'із',
  'complete': 'завершено',
  'Can you recall the meaning?': 'Можете згадати значення?',
  'Pick the correct meaning.': 'Виберіть правильне значення.',
  'Tap a word and its translation.': 'Натисніть на слово та його переклад.',
  'Reveal translation': 'Показати переклад',
  'Hide translation': 'Сховати переклад',
  'YES · I know it': 'ТАК · Знаю',
  'NO · Practise again': 'НІ · Повторити',
  'Meaning revealed. A YES answer counts with a hint.': 'Переклад показано. Відповідь ТАК буде зарахована з підказкою.',
  'Remembered without a hint.': 'Згадано без підказки.',
  'Remembered with a hint.': 'Згадано з підказкою.',
  'A word to come back to.': 'До цього слова варто повернутися.',
  'Correct!': 'Правильно!',
  'Not quite. Here is the meaning.': 'Не зовсім. Ось правильне значення.',
  'Next word': 'Наступне слово',
  'See your results': 'Переглянути результати',
  'Translation choices': 'Варіанти перекладу',
  'Portuguese': 'Португальська',
  'English': 'Англійська',
  'Ukrainian': 'Українська',
  'Matched': 'Поєднано',
  'Pair found!': 'Пару знайдено!',
  'Not a match. Try another pair.': 'Це не пара. Спробуйте ще раз.',
  'Now choose its translation.': 'Тепер виберіть переклад.',
  'Now choose the Portuguese word.': 'Тепер виберіть португальське слово.',
  'Sample complete': 'Приклад завершено',
  'A few words closer.': 'Ще кілька знайомих слів.',
  'Without hints': 'Без підказок',
  'With a hint': 'З підказкою',
  'To revisit': 'Для повторення',
  'Without mistakes': 'Без помилок',
  'Create an account to save future practice and follow your progress.': 'Створіть обліковий запис, щоб зберігати майбутню практику та стежити за прогресом.',
  'Create an account': 'Створити обліковий запис',
  'Try again': 'Спробувати ще раз',
  'A quick sample. These answers are not saved.': 'Короткий приклад. Ці відповіді не зберігаються.',
};

function initialState() {
  return { index: 0, answers: [], revealed: false, usedReveal: false, feedback: null, selectedOption: null,
    selectedWord: null, selectedTranslation: null, pairs: [], mistakes: [], pairFeedback: '' };
}

function DemoSession({ mode, language, t }) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);
  const nextButton = useRef(null);
  const wordHeading = useRef(null);
  const resultHeading = useRef(null);
  const wordButtons = useRef(new Map());
  const focusWord = useRef(false);
  const matching = mode === 'matching';
  const total = matching ? words.length : 3;
  const completed = matching ? state.pairs.length : state.answers.length;
  const finished = matching ? completed === total : state.index === total;
  const word = words[state.index];

  function update(next) {
    const value = typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = value;
    setState(value);
  }

  useEffect(() => {
    if (finished) resultHeading.current?.focus();
    else if (!matching && state.feedback) nextButton.current?.focus();
    else if (matching && state.pairs.length) {
      const available = words.find((candidate) => !state.pairs.some((pair) => pair.wordId === candidate.id));
      wordButtons.current.get(available?.id)?.focus();
    } else if (focusWord.current) wordHeading.current?.focus();
    focusWord.current = false;
  }, [finished, matching, state.index, state.feedback, state.pairs.length]);

  function reveal() {
    update((current) => current.feedback ? current : { ...current, revealed: !current.revealed, usedReveal: true });
  }

  function answer(known, optionId = null) {
    const current = stateRef.current;
    if (current.feedback || current.index >= 3) return;
    const activeWord = words[current.index];
    update({ ...current, selectedOption: optionId,
      answers: [...current.answers, { wordId: activeWord.id, known, revealed: mode === 'self-assessment' && current.usedReveal }],
      feedback: { known, revealed: mode === 'self-assessment' && current.usedReveal } });
  }

  function next() {
    const current = stateRef.current;
    if (!current.feedback) return;
    focusWord.current = true;
    update({ ...current, index: current.index + 1, revealed: false, usedReveal: false, feedback: null, selectedOption: null });
  }

  function selectPair(side, id) {
    const current = stateRef.current;
    if (current.pairs.length === words.length || current.pairs.some((pair) => side === 'word' ? pair.wordId === id : pair.translationId === id)) return;
    const left = side === 'word' ? id : current.selectedWord;
    const right = side === 'translation' ? id : current.selectedTranslation;
    if (!left || !right) {
      update({ ...current,
        selectedWord: side === 'word' ? current.selectedWord === id ? null : id : current.selectedWord,
        selectedTranslation: side === 'translation' ? current.selectedTranslation === id ? null : id : current.selectedTranslation,
        pairFeedback: side === 'word' ? 'Now choose its translation.' : 'Now choose the Portuguese word.' });
      return;
    }
    const correct = left === right;
    const mistakes = correct ? current.mistakes : [...new Set([...current.mistakes, left, right])];
    const pairs = correct ? [...current.pairs, { wordId: left, translationId: right }] : current.pairs;
    update({ ...current, selectedWord: null, selectedTranslation: null, pairs, mistakes,
      pairFeedback: correct ? 'Pair found!' : 'Not a match. Try another pair.',
      answers: pairs.length === words.length ? words.map((candidate) => ({ wordId: candidate.id, known: !mistakes.includes(candidate.id), revealed: false })) : current.answers });
  }

  function restart() {
    focusWord.current = true;
    update(initialState());
  }

  const independent = state.answers.filter((item) => item.known && !item.revealed).length;
  const helped = state.answers.filter((item) => item.known && item.revealed).length;
  const toReview = state.answers.filter((item) => !item.known).length;
  const feedbackCopy = state.feedback && (mode === 'multiple-choice'
    ? state.feedback.known ? 'Correct!' : 'Not quite. Here is the meaning.'
    : state.feedback.known ? state.feedback.revealed ? 'Remembered with a hint.' : 'Remembered without a hint.' : 'A word to come back to.');

  return <>
    <div className={styles.progressLabel}><span>{completed} {t('of')} {total} {t('complete')}</span><strong>{Math.round(completed / total * 100)}%</strong></div>
    <div className={styles.progress} role="progressbar" aria-label={t('Sample progress')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}>
      <span style={{ width: `${completed / total * 100}%` }} />
    </div>
    {finished ? <div className={styles.results}>
      <span className={styles.resultIcon} aria-hidden="true">✓</span>
      <span className={styles.eyebrow}>{t('Sample complete')}</span>
      <h3 ref={resultHeading} tabIndex={-1}>{t('A few words closer.')}</h3>
      <div className={styles.metrics}>
        <div><strong>{independent}</strong><span>{t(matching ? 'Without mistakes' : 'Without hints')}</span></div>
        {!matching && mode === 'self-assessment' && <div><strong>{helped}</strong><span>{t('With a hint')}</span></div>}
        <div><strong>{toReview}</strong><span>{t('To revisit')}</span></div>
      </div>
      <p>{t('Create an account to save future practice and follow your progress.')}</p>
      <Link className={styles.register} href="/register">{t('Create an account')} <span aria-hidden="true">→</span></Link>
      <button className={styles.restart} type="button" onClick={restart}>{t('Try again')} <span aria-hidden="true">↻</span></button>
    </div> : matching ? <div className={styles.matching}>
      <h3 ref={wordHeading} tabIndex={-1}>{t('Match the pairs')}</h3>
      <p className={styles.instruction}>{t('Tap a word and its translation.')}</p>
      <div className={styles.matchingBoard}>
        <div className={styles.matchingColumn} role="group" aria-label={t('Portuguese')}>
          <span className={styles.columnLabel}>{t('Portuguese')}</span>
          {words.map((candidate) => {
            const matched = state.pairs.some((pair) => pair.wordId === candidate.id);
            const selected = state.selectedWord === candidate.id;
            return <button ref={(node) => { if (node) wordButtons.current.set(candidate.id, node); else wordButtons.current.delete(candidate.id); }} key={candidate.id} type="button" className={`${styles.pairTile}${selected ? ` ${styles.selected}` : ''}${matched ? ` ${styles.matched}` : ''}`}
              lang="pt-PT" aria-pressed={selected} disabled={matched} aria-label={`${candidate.portuguese}${matched ? `, ${t('Matched')}` : ''}`} onClick={() => selectPair('word', candidate.id)}>
              {candidate.portuguese}{matched && <span aria-hidden="true">✓</span>}
            </button>;
          })}
        </div>
        <div className={styles.matchingColumn} role="group" aria-label={t(language === 'uk' ? 'Ukrainian' : 'English')}>
          <span className={styles.columnLabel}>{t(language === 'uk' ? 'Ukrainian' : 'English')}</span>
          {translationOrder.map((position) => {
            const candidate = words[position];
            const matched = state.pairs.some((pair) => pair.translationId === candidate.id);
            const selected = state.selectedTranslation === candidate.id;
            return <button key={candidate.id} type="button" className={`${styles.pairTile}${selected ? ` ${styles.selected}` : ''}${matched ? ` ${styles.matched}` : ''}`}
              lang={language} aria-pressed={selected} disabled={matched} aria-label={`${candidate[language]}${matched ? `, ${t('Matched')}` : ''}`} onClick={() => selectPair('translation', candidate.id)}>
              {candidate[language]}{matched && <span aria-hidden="true">✓</span>}
            </button>;
          })}
        </div>
      </div>
      <p className={styles.pairFeedback} role="status" aria-live="polite">{state.pairFeedback ? t(state.pairFeedback) : '\u00a0'}</p>
    </div> : <div className={styles.question}>
      <p className={styles.instruction}>{t(mode === 'multiple-choice' ? 'Pick the correct meaning.' : 'Can you recall the meaning?')}</p>
      <h3 ref={wordHeading} tabIndex={-1} lang="pt-PT">{word.portuguese}</h3>
      {mode === 'self-assessment' ? <>
        <div className={styles.revealArea} aria-live="polite">
          {(state.revealed || state.feedback) && <span className={styles.translation} lang={language}>{word[language]}</span>}
          {!state.feedback && <button type="button" className={styles.reveal} onClick={reveal}>{t(state.revealed ? 'Hide translation' : 'Reveal translation')} <span aria-hidden="true">{state.revealed ? '↑' : '↓'}</span></button>}
        </div>
        {!state.feedback && <>
          <p className={styles.hint} role="status">{state.usedReveal ? t('Meaning revealed. A YES answer counts with a hint.') : '\u00a0'}</p>
          <div className={styles.recallButtons}>
            <button type="button" className={styles.no} onClick={() => answer(false)}><span aria-hidden="true">✕</span> {t('NO · Practise again')}</button>
            <button type="button" className={styles.yes} onClick={() => answer(true)}><span aria-hidden="true">✓</span> {t('YES · I know it')}</button>
          </div>
        </>}
      </> : <div className={styles.options} role="group" aria-label={t('Translation choices')}>
        {optionOrders[state.index].map((position) => {
          const candidate = words[position];
          const correct = state.feedback && candidate.id === word.id;
          const selected = state.selectedOption === candidate.id;
          return <button key={candidate.id} type="button" lang={language} aria-pressed={selected} disabled={Boolean(state.feedback)}
            className={`${styles.option}${correct ? ` ${styles.correct}` : ''}${selected && state.feedback && !state.feedback.known ? ` ${styles.incorrect}` : ''}`}
            onClick={() => answer(candidate.id === words[stateRef.current.index]?.id, candidate.id)}>
            {candidate[language]}{state.feedback && (correct || selected) && <span aria-hidden="true">{correct ? '✓' : '✕'}</span>}
          </button>;
        })}
      </div>}
      {state.feedback && <div className={styles.answerFeedback}>
        <p role="status" className={state.feedback.known ? styles.positive : styles.review}><span aria-hidden="true">{state.feedback.known ? '✓' : '↻'}</span> {t(feedbackCopy)}</p>
        {mode === 'multiple-choice' && <span className={styles.feedbackTranslation} lang={language}>{word[language]}</span>}
        <button ref={nextButton} type="button" className={styles.next} onClick={next}>{t(state.index === 2 ? 'See your results' : 'Next word')} <span aria-hidden="true">→</span></button>
      </div>}
    </div>}
  </>;
}

export default function LandingDemo({ mode = 'self-assessment', onModeChange }) {
  const { language: preference } = useLanguage();
  const language = preference === 'uk' ? 'uk' : 'en';
  const t = (copy) => language === 'uk' ? ukrainian[copy] || copy : copy;
  const activeMode = modes.some((item) => item.id === mode) ? mode : 'self-assessment';

  return <section className={styles.card} aria-label={t('A little practice, right now.')}>
    <div className={styles.cardHeading}><span className={styles.eyebrow}>{t('TRY IT HERE')}</span><span className={styles.liveDot} aria-hidden="true" /></div>
    <div className={styles.modeButtons} role="group" aria-label={t('Sample exercise')}>
      {modes.map((item) => <button key={item.id} type="button" aria-pressed={activeMode === item.id} aria-label={`${t(item.label)}: ${t(item.title)}`} onClick={() => onModeChange?.(item.id)}>
        <ExerciseIcon mode={item.id} /><span>{t(item.label)}</span>
      </button>)}
    </div>
    <DemoSession key={`${activeMode}:${language}`} mode={activeMode} language={language} t={t} />
    <p className={styles.unsaved}><span aria-hidden="true">◌</span> {t('A quick sample. These answers are not saved.')}</p>
  </section>;
}
