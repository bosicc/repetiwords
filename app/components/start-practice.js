'use client';
import { useFormStatus } from 'react-dom';
import { beginPractice } from '../actions';
import { useLanguage } from './language';

function StartButton() {
  const { pending } = useFormStatus();
  const { t } = useLanguage();
  return <button className="primary start-practice" disabled={pending}>{t(pending ? 'Starting…' : 'Practice')} <span aria-hidden="true">→</span></button>;
}

export default function StartPractice() {
  return <form action={beginPractice} className="header-practice">
    <StartButton />
  </form>;
}
