'use client';
import { useLanguage } from './language';

export default function WordProgress({ progress }) {
  const { t, language } = useLanguage();
  const parts = [ ['New', progress.new, '#777783'], ['Learning', progress.learning, '#f59e0b'], ['Mastered', progress.mastered, '#28c995'] ];
  const newAngle = progress.total ? progress.new / progress.total * 360 : 360;
  const learningAngle = newAngle + (progress.total ? progress.learning / progress.total * 360 : 0);
  const max = Math.max(4, ...progress.history.map((day) => day.mastered));
  const x = (index) => 40 + index * 440 / (progress.history.length - 1);
  const y = (count) => 150 - count / max * 120;
  const line = progress.history.map((day, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(day.mastered)}`).join(' ');
  const formatDate = (date) => new Intl.DateTimeFormat(language === 'uk' ? 'uk-UA' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  return <section className="progress-panels" aria-label={t('Word progress')}>
    <div className="progress-panel"><h2>{t('Distribution')}</h2>
      <div className="distribution-content">
        <div className="donut" role="img" aria-label={parts.map(([name, count]) => `${t(name)}: ${count}`).join(', ')} style={{ background: `conic-gradient(#777783 0deg ${newAngle}deg, #f59e0b ${newAngle}deg ${learningAngle}deg, #28c995 ${learningAngle}deg 360deg)` }} />
        <ul className="progress-legend">{parts.map(([name, count, color]) => <li key={name}><span className="legend-dot" style={{ background: color }} /><span>{t(name)}</span><strong>{progress.total ? Math.round(count / progress.total * 100) : 0}% <small>({count})</small></strong></li>)}</ul>
      </div>
    </div>
    <div className="progress-panel"><h2>{t('Mastered words')}</h2>
      <svg className="mastery-chart" viewBox="0 0 510 190" role="img" aria-label={`${t('Mastered words')}: ${progress.mastered}`}>
        <defs><linearGradient id="mastery-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#28c995" stopOpacity=".18" /><stop offset="100%" stopColor="#28c995" stopOpacity="0" /></linearGradient></defs>
        {[0, max / 2, max].map((value) => <g key={value}><line x1="40" x2="480" y1={y(value)} y2={y(value)} stroke="#e4e7ef" strokeDasharray="4 4" /><text x="30" y={y(value) + 4} textAnchor="end">{value}</text></g>)}
        <path d={`${line} L 480 150 L 40 150 Z`} fill="url(#mastery-fill)" />
        <path d={line} fill="none" stroke="#28c995" strokeWidth="2.5" strokeLinejoin="round" />
        {progress.history.map((day, index) => <circle key={day.date} cx={x(index)} cy={y(day.mastered)} r="3" fill="#28c995"><title>{`${formatDate(day.date)}: ${day.mastered}`}</title></circle>)}
        {[0, 4, 8, 13].map((index) => <text key={index} x={x(index)} y="178" textAnchor={index === 0 ? 'start' : index === 13 ? 'end' : 'middle'}>{formatDate(progress.history[index].date)}</text>)}
      </svg>
    </div>
    <p className="mastery-explanation">{t('Mastered = 3 consecutive YES answers without revealing the translation. Last 14 days.')}</p>
  </section>;
}
