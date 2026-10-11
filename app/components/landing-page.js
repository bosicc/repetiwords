'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { LANDING_COPY } from '../../lib/landing-copy';
import { useLanguage } from './language';
import ExerciseIcon from './exercise-icon';
import LandingDemo from './landing-demo';
import WordProgress from './word-progress';

const sampleProgress = {
  total: 100,
  new: 62,
  learning: 26,
  mastered: 12,
  history: [1, 1, 2, 3, 3, 4, 5, 5, 7, 8, 8, 9, 11, 12].map((mastered, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    mastered,
  })),
};

function Arrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>;
}

export default function LandingPage() {
  const { language } = useLanguage();
  const copy = LANDING_COPY[language] || LANDING_COPY.en;
  const [mode, setMode] = useState('self-assessment');
  const demoRef = useRef(null);

  function showDemo(event, nextMode) {
    event.preventDefault();
    if (nextMode) setMode(nextMode);
    demoRef.current?.scrollIntoView({ block: 'center' });
    demoRef.current?.focus({ preventScroll: true });
  }

  return <main className="landing-page" lang={language}>
    <nav className="landing-navigation" aria-label={copy.nav.label}>
      <a href="#practice-demo" onClick={showDemo}>{copy.nav.practice}</a>
      <a href="#how-it-works">{copy.nav.how}</a>
      <a href="#your-progress">{copy.nav.progress}</a>
      <a href="#questions">{copy.nav.faq}</a>
    </nav>
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-intro">
        <h1 id="landing-title">{copy.hero.headline.map((line, index) => <span key={line}>{line}{index < copy.hero.headline.length - 1 ? ' ' : ''}</span>)}</h1>
        <p>{copy.hero.description}</p>
        <div className="landing-actions">
          <a className="landing-primary" href="#practice-demo" onClick={showDemo}>{copy.hero.tryDemo}<Arrow /></a>
          <Link className="landing-secondary" href="/register">{copy.hero.createAccount}<Arrow /></Link>
        </div>
        <p className="landing-note"><span aria-hidden="true">✓</span>{copy.hero.note}</p>
      </div>
      <div className="landing-preview" id="practice-demo" ref={demoRef} tabIndex={-1} aria-label={copy.hero.tryDemo}>
        <LandingDemo mode={mode} onModeChange={setMode} />
      </div>
    </section>

    <section className="landing-exercises" aria-labelledby="landing-exercises-title">
      <div className="landing-section-heading">
        <span className="landing-eyebrow">{copy.exercises.eyebrow}</span>
        <h2 id="landing-exercises-title">{copy.exercises.title}</h2>
        <p>{copy.exercises.description}</p>
      </div>
      <div className="landing-exercise-grid">{copy.exercises.modes.map((exercise) => <article className="landing-exercise" key={exercise.id}>
        <span className="landing-exercise-icon"><ExerciseIcon mode={exercise.id} /></span>
        <h3>{exercise.title}</h3>
        <p>{exercise.description}</p>
        <div className="landing-exercise-example">{exercise.example}</div>
        <button type="button" aria-label={`${copy.hero.tryDemo}: ${exercise.title}`} onClick={(event) => showDemo(event, exercise.id)}>{copy.hero.tryDemo}<Arrow /></button>
      </article>)}</div>
    </section>

    <section className="landing-how" id="how-it-works" aria-labelledby="landing-how-title">
      <div className="landing-section-heading">
        <span className="landing-eyebrow">{copy.how.eyebrow}</span>
        <h2 id="landing-how-title">{copy.how.title}</h2>
      </div>
      <ol className="landing-steps">{copy.how.steps.map((step, index) => <li key={step.title}>
        <span className="landing-step-number" aria-hidden="true">0{index + 1}</span>
        <h3>{step.title}</h3><p>{step.description}</p>
      </li>)}</ol>
    </section>

    <section className="landing-progress" id="your-progress" aria-labelledby="landing-progress-title">
      <div className="landing-section-heading">
        <span className="landing-eyebrow">{copy.progress.eyebrow}</span>
        <h2 id="landing-progress-title">{copy.progress.title}</h2>
        <p>{copy.progress.description}</p>
      </div>
      <div className="landing-dashboard" role="region" aria-label={`${copy.progress.previewTitle} · ${copy.progress.previewLabel}`}>
        <div className="landing-dashboard-heading"><h3>{copy.progress.previewTitle}</h3><span>{copy.progress.previewLabel}</span></div>
        <div className="landing-dashboard-stats">
          <div><span>{copy.progress.reviewed}</span><strong>120</strong></div>
          <div><span>{copy.progress.success}</span><strong>80<span>%</span></strong></div>
        </div>
        <WordProgress progress={sampleProgress} />
        <p className="landing-preview-note">{copy.progress.previewNote}</p>
      </div>
      <ul className="landing-progress-benefits">{copy.progress.benefits.map((benefit) => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul>
    </section>

    <section className="landing-faq" id="questions" aria-labelledby="landing-faq-title">
      <div className="landing-section-heading">
        <span className="landing-eyebrow">{copy.faq.eyebrow}</span>
        <h2 id="landing-faq-title">{copy.faq.title}</h2>
      </div>
      <div className="landing-faq-list">{copy.faq.items.map((item) => <details key={item.question}>
        <summary>{item.question}<span className="landing-faq-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" focusable="false"><path d="M8 3v10M3 8h10" /></svg></span></summary><p>{item.answer}</p>
      </details>)}</div>
    </section>

    <section className="landing-closing" aria-labelledby="landing-closing-title">
      <div><h2 id="landing-closing-title">{copy.closing.title}</h2><p>{copy.closing.description}</p></div>
      <Link className="landing-primary" href="/register">{copy.closing.createAccount}<Arrow /></Link>
    </section>
    <footer className="landing-footer">
      <span>Repeti · {copy.footer.focus}</span><span>{copy.footer.note}</span><Link href="/login">{copy.footer.login}<Arrow /></Link>
    </footer>
  </main>;
}
