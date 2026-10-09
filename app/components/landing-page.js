'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [revealed, setRevealed] = useState(false);
  return <main className="landing-page">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-intro">
        <span className="landing-eyebrow"><span aria-hidden="true">✦</span> A little Portuguese. A daily habit.</span>
        <h1 id="landing-title">Learn words<br /><span>every day.</span></h1>
        <p>Find your words in European Portuguese. Build your vocabulary with simple practice, helpful translations, and a little progress each day.</p>
        <div className="landing-actions"><Link className="landing-primary" href="/register">Start learning <span aria-hidden="true">↗</span></Link><a className="landing-secondary" href="#how-it-works">How it works <span aria-hidden="true">↓</span></a></div>
        <div className="landing-note"><span aria-hidden="true">✓</span> Your pace. Your progress. One word at a time.</div>
      </div>
      <div className="landing-preview">
        <div className="landing-floating-note"><span aria-hidden="true">✦</span> Small steps, lasting words</div>
        <div className="landing-word-card">
          <div className="landing-card-top"><span>TRY A WORD</span><span>EUROPEAN PORTUGUESE</span></div>
          <div className="landing-demo-progress"><span /></div>
          <span className="landing-word-label">A word for your everyday</span>
          <h2 lang="pt-PT">obrigado</h2>
          <div className="landing-translation" aria-live="polite">{revealed ? <span>thank you</span> : <button type="button" onClick={() => setRevealed(true)}>Reveal translation <span aria-hidden="true">↓</span></button>}</div>
          <p className="landing-word-example" lang="pt-PT">“Obrigado pela ajuda!”</p>
          <div className="landing-card-bottom"><span aria-hidden="true">↻</span> A little practice goes a long way.</div>
        </div>
        <div className="landing-progress-note"><span className="landing-check" aria-hidden="true">✓</span><div><strong>Make room for one more word.</strong><span>Start a habit you can come back to.</span></div></div>
      </div>
    </section>
    <section className="landing-how" id="how-it-works" aria-labelledby="landing-how-title">
      <div className="landing-section-heading"><span className="landing-eyebrow">A SIMPLE ROUTINE</span><h2 id="landing-how-title">A little practice. A growing vocabulary.</h2><p>Less to figure out. More words to remember.</p></div>
      <div className="landing-steps">
        <article><span className="landing-step-number">01</span><h3>Make it your habit</h3><p>Choose how many words to practice in each session. Fit learning into your day.</p></article>
        <article><span className="landing-step-number">02</span><h3>Find the meaning</h3><p>Try to recall each word, reveal its translation when you need it, and record what you know.</p></article>
        <article><span className="landing-step-number">03</span><h3>See yourself improve</h3><p>Revisit words that need more practice and watch your vocabulary grow with your progress.</p></article>
      </div>
    </section>
    <section className="landing-closing"><div><h2>Your next word is waiting.</h2><p>Start building your everyday Portuguese.</p></div><Link className="landing-primary" href="/register">Create an account <span aria-hidden="true">↗</span></Link></section>
    <footer className="landing-footer"><span>repeti · European Portuguese</span><span>A little progress, every day.</span></footer>
  </main>;
}
