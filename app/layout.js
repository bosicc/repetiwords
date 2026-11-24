import './globals.css';
import { Fragment } from 'react';
import SiteAnalytics from './components/site-analytics';
import { LanguageProvider } from './components/language';
import { getAccountLanguage } from '../lib/app-database';
import Header from './components/header';
import { getCurrentUser, getCurrentSuperAdmin } from '../lib/auth';
import { getPracticeWordCount, getPracticeMode } from '../lib/practice-settings';

export const metadata = {
  title: 'Repeti · Learn new words. Repeat daily.',
  description: 'Build your Portuguese and Spanish vocabulary with recall cards, translation choices and matching pairs. Practise with English or Ukrainian translations and save your progress.',
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  const superAdmin = Boolean(await getCurrentSuperAdmin());
  const [practiceCount, practiceMode, studyLanguage] = user
    ? await Promise.all([getPracticeWordCount(), getPracticeMode(user.id), getAccountLanguage(user.id)])
    : [30, 'self-assessment', 'pt-PT'];
  return <html lang="en"><body><LanguageProvider studyLanguage={studyLanguage}><Header signedIn={Boolean(user)} superAdmin={superAdmin} practiceCount={practiceCount} practiceMode={practiceMode} /><Fragment key={studyLanguage}>{children}</Fragment></LanguageProvider><SiteAnalytics /></body></html>;
}
