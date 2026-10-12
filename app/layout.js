import './globals.css';
import SiteAnalytics from './components/site-analytics';
import { LanguageProvider } from './components/language';
import Header from './components/header';
import { getCurrentUser, getCurrentSuperAdmin } from '../lib/auth';
import { getPracticeWordCount, getPracticeMode } from '../lib/practice-settings';

export const metadata = {
  title: 'Repeti · Learn new words. Repeat daily.',
  description: 'Build your European Portuguese vocabulary with recall cards, translation choices and matching pairs. Practise with English or Ukrainian translations and save your progress.',
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  const superAdmin = Boolean(await getCurrentSuperAdmin());
  const [practiceCount, practiceMode] = user
    ? await Promise.all([getPracticeWordCount(), getPracticeMode(user.id)])
    : [30, 'self-assessment'];
  return <html lang="en"><body><LanguageProvider><Header signedIn={Boolean(user)} superAdmin={superAdmin} practiceCount={practiceCount} practiceMode={practiceMode} />{children}</LanguageProvider><SiteAnalytics /></body></html>;
}
