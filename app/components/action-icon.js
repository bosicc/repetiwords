const paths = {
  trash: <><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7m4-7v7" /></>,
  share: <><path d="M12 16V3m-4 4 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></>,
  link: <><path d="m10 13 4-4" /><path d="M8 16H6a4 4 0 0 1 0-8h3m6 0h3a4 4 0 0 1 0 8h-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  external: <><path d="M14 4h6v6m0-6L10 14" /><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  unlink: <><path d="m3 3 18 18M9 8H6a4 4 0 0 0 0 8h2m7-8h3a4 4 0 0 1 2.8 6.8M10 13l1-1m2-2 1-1" /></>,
  bookmark: <path d="M6 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4-6 4V5Z" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
};

export default function ActionIcon({ name, size = 20, className }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
