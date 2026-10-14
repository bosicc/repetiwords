'use client';
import { useLanguage } from '../components/language';

export default function ListProgress({ progress }) {
  const { t } = useLanguage();
  const parts = [['New', progress.new, '#777783'], ['Learning', progress.learning, '#f59e0b'], ['Mastered', progress.mastered, '#28c995']];
  return <div className="list-progress-bar" role="img" aria-label={parts.map(([label, value]) => `${t(label)}: ${value}`).join(', ')}>
    {parts.map(([label, value, color]) => value > 0 && <span key={label} aria-hidden="true" style={{ width: `${100 * value / progress.total}%`, background: color }} />)}
  </div>;
}
