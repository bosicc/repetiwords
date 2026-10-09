'use client';
import { useState } from 'react';
import { savePracticeSettings } from '../actions';
import { useLanguage } from '../components/language';

export default function SettingsForm({ count }) {
  const { t } = useLanguage();
  const [value, setValue] = useState(String(count));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function changeCount(event) {
    const previous = value;
    const next = event.target.value;
    setValue(next);
    setSaving(true);
    setError(false);
    const data = new FormData();
    data.set('count', next);
    try { await savePracticeSettings(data); }
    catch { setValue(previous); setError(true); }
    finally { setSaving(false); }
  }

  return <section className="card practice-launch settings-form settings-section" aria-labelledby="practice-settings-heading">
    <h2 id="practice-settings-heading">{t('Practice')}</h2>
    <label>{t('Words per session')}<select name="count" value={value} disabled={saving} onChange={changeCount}>
      {[10, 30, 100].map((number) => <option key={number} value={number}>{number}</option>)}
    </select></label>
    <p>{t('This choice applies to new practice sessions.')}</p>
    <p className="settings-note" role="status">{t(saving ? 'Saving…' : 'Changes are saved automatically.')}</p>
    {error && <p role="alert">{t('Could not save settings. Please try again.')}</p>}
  </section>;
}
