'use client';

import { useState } from 'react';
import { useLanguage } from './language';

const outcomes = [
  { key: 'independent', label: 'Without hints', color: '#28c995' },
  { key: 'helped', label: 'With hints', color: '#f59e0b' },
  { key: 'mistakes', label: 'To review', color: '#ef6464' },
  { key: 'skipped', label: 'Skipped', color: '#929aaa' },
];

export default function SessionHistory({ sessions }) {
  const { t, language } = useLanguage();
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredWord, setHoveredWord] = useState(null);
  const selected = sessions.find((session) => session.id === selectedId) || sessions.at(-1);
  const max = Math.max(10, ...sessions.map((session) => session.total));
  const axisMax = Math.ceil(max / 10) * 10;
  const wordHeight = 220 / axisMax;
  const formatDate = (date, withTime = false) => new Intl.DateTimeFormat(language === 'uk' ? 'uk-UA' : 'en-GB', {
    timeZone: 'Europe/Lisbon', day: 'numeric', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(date.replace(' ', 'T') + 'Z'));
  const describe = (session) => `${t('Session')} #${session.id}, ${formatDate(session.createdAt, true)}, ${outcomes.map((outcome) => `${t(outcome.label)}: ${session[outcome.key]}`).join(', ')}`;

  return <section className="session-history" aria-labelledby="session-history-heading">
    <div className="session-history-heading"><h2 id="session-history-heading">{t('Practice sessions')}</h2>
      <span>{t('Last 20 sessions')}</span></div>
    <ul className="session-chart-legend">{outcomes.map((outcome) => <li key={outcome.key}>
      <span className="legend-dot" style={{ background: outcome.color }} aria-hidden="true" />{t(outcome.label)}
    </li>)}</ul>
    {!sessions.length ? <p className="session-chart-empty">{t('Complete your first practice to see your sessions here.')}</p> : <>
      <div className="session-chart-layout">
        <div className="session-chart-axis" aria-hidden="true">
          {[axisMax, Math.round(axisMax / 2), 0].map((value) => <span key={value}>{value}</span>)}
        </div>
        <div className="session-chart-scroll" role="region" aria-label={t('Practice sessions')} tabIndex={0}>
          <div className="session-chart-columns" style={{ minWidth: `${Math.max(280, sessions.length * 64)}px` }}>
            {sessions.map((session) => <div className="session-chart-column" key={session.id}>
              <button type="button" className="session-chart-bar" aria-label={describe(session)} aria-pressed={selected?.id === session.id}
                onClick={() => { setSelectedId(session.id); setHoveredWord(null); }}
                onFocus={() => { setSelectedId(session.id); setHoveredWord(null); }}>
                <span className="session-chart-stack" style={{ height: `${session.completed * wordHeight}px` }} aria-hidden="true">
                  {session.segments.map((word, index) => {
                    const outcome = outcomes.find((item) => item.key === word.outcome);
                    const translation = (language === 'uk' ? word.ukrainian : word.english) || t('Translation unavailable');
                    return <span key={`${word.wordId}-${index}`} className="session-chart-word" style={{ background: outcome.color }}
                      title={`${word.portuguese} · ${translation} · ${t(outcome.label)}`}
                      onMouseEnter={() => setHoveredWord({ ...word, sessionId: session.id })}
                      onMouseLeave={() => setHoveredWord(null)} />;
                  })}
                </span>
              </button>
              <div className="session-chart-label" aria-hidden="true"><strong>#{session.id}</strong><span>{formatDate(session.createdAt)}</span></div>
            </div>)}
          </div>
        </div>
      </div>
      <div className="session-chart-detail" aria-live="polite">
        {hoveredWord ? <>
          <strong lang="pt-PT">{hoveredWord.portuguese}</strong>
          <span>{(language === 'uk' ? hoveredWord.ukrainian : hoveredWord.english) || t('Translation unavailable')}</span>
          <span>{t(outcomes.find((item) => item.key === hoveredWord.outcome).label)} · {t('Session')} #{hoveredWord.sessionId}</span>
        </> : <>
          <strong>{t('Session')} #{selected.id} <span className="session-chart-date">· {formatDate(selected.createdAt, true)}</span></strong>
          <span>{t('Words completed')}: {selected.completed} {t('of')} {selected.total}{selected.completed < selected.total ? ` · ${t('In progress')}` : ''}</span>
          <div className="session-chart-totals">{outcomes.map((outcome) => <span key={outcome.key}><span className="legend-dot" style={{ background: outcome.color }} />{t(outcome.label)}: <strong>{selected[outcome.key]}</strong></span>)}</div>
        </>}
      </div>
      <p className="session-chart-note">{t('One segment = one word. Select a session or hover over a word for details.')}</p>
    </>}
  </section>;
}
