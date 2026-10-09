'use client';
import Link from 'next/link';
import { useLanguage } from './language';

export default function SessionSummary({ answers, words, skipped }) {
  const { t, language } = useLanguage();
  const answersByWord = new Map(answers.map((answer) => [answer.wordId, answer]));
  const independent = answers.filter((answer) => answer.known && !answer.revealed).length;
  const helped = answers.filter((answer) => answer.known && answer.revealed).length;
  const mistakes = answers.filter((answer) => !answer.known).length;
  const score = answers.length ? Math.round(100 * (independent + helped * 0.5) / answers.length) : 0;
  const metrics = [
    { label: 'Without hints', value: independent, icon: '✓', className: 'summary-known' },
    { label: 'With hints', value: helped, icon: '◐', className: 'summary-helped' },
    { label: 'To review', value: mistakes, icon: '↻', className: 'summary-review' },
    { label: 'Skipped', value: skipped, icon: '→', className: 'summary-skipped' },
  ];
  return <div className="session-summary">
    <h2>{t('A little progress, every day.')}</h2>
    <div className="summary-score" style={{ '--score-angle': `${score * 3.6}deg` }}>
      <div><strong>{answers.length ? `${score}%` : '—'}</strong><span>{t('Session success')}</span></div>
    </div>
    <p className="summary-caption">{t('Words answered')}: <strong>{answers.length}</strong></p>
    <div className="summary-metrics">{metrics.map((metric) => <div key={metric.label} className={metric.className}>
      <span className="summary-icon" aria-hidden="true">{metric.icon}</span>
      <strong>{metric.value}</strong><span>{t(metric.label)}</span>
    </div>)}</div>
    <section className="session-word-results" aria-label={t('Session words')}>
      <h3>{t('Session words')}</h3>
      <div className="session-results-table"><table>
        <thead><tr><th scope="col">{t('Portuguese')}</th><th scope="col">{t(language === 'uk' ? 'Ukrainian' : 'English')}</th><th scope="col">{t('Your answer')}</th><th scope="col">{t('Success rate')}</th></tr></thead>
        <tbody>{words.map((word) => {
          const answer = answersByWord.get(word.id);
          const result = !answer ? { className: 'result-skipped', icon: '→', label: 'Skipped', score: '—' } :
            !answer.known ? { className: 'result-no', icon: '✕', label: 'NO', score: '0%' } :
            answer.revealed ? { className: 'result-helped', icon: '◐', label: 'YES · With hints', score: '50%' } :
            { className: 'result-yes', icon: '✓', label: 'YES · Without hints', score: '100%' };
          return <tr key={word.id} className={result.className}>
            <td lang="pt-PT"><strong>{word.portuguese}</strong></td>
            <td lang={language}>{(language === 'uk' ? word.ukrainian : word.english) || t('Translation unavailable')}</td>
            <td><span className="result-badge"><span aria-hidden="true">{result.icon}</span> {t(result.label)}</span></td>
            <td className="result-score">{result.score}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>
    <Link href="/" className="summary-home">{t('Home')} <span aria-hidden="true">→</span></Link>
  </div>;
}
