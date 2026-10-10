export default function ExerciseIcon({ mode, className }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {mode === 'self-assessment' && <>
      <path d="m3 7 3 3 5-6" />
      <path d="m15 14 6 6m0-6-6 6" />
      <path d="M14 5h7M3 18h7" />
    </>}
    {mode === 'multiple-choice' && <>
      <circle cx="5" cy="5" r="2.5" />
      <circle cx="5" cy="5" r=".65" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <path d="M11 5h10M11 12h10M11 19h10" />
    </>}
    {mode === 'matching' && <>
      <rect x="2" y="3" width="5" height="6" rx="1.5" />
      <rect x="2" y="15" width="5" height="6" rx="1.5" />
      <rect x="17" y="3" width="5" height="6" rx="1.5" />
      <rect x="17" y="15" width="5" height="6" rx="1.5" />
      <path d="M7 6h2c4 0 2 12 6 12h2M7 18h2c4 0 2-12 6-12h2" />
    </>}
  </svg>;
}
