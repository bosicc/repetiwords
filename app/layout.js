import './globals.css';
import { LanguageProvider } from './components/language';
import Header from './components/header';
import { getCurrentUser } from '../lib/auth';
import { getPracticeWordCount, getPracticeMode } from '../lib/practice-settings';

export const metadata = {
  title: 'Repeti · Learn words every day',
  description: 'Daily European Portuguese vocabulary practice.',
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  const [practiceCount, practiceMode] = user
    ? await Promise.all([getPracticeWordCount(), getPracticeMode(user.id)])
    : [30, 'self-assessment'];
  return <html lang="en"><body><LanguageProvider><Header signedIn={Boolean(user)} practiceCount={practiceCount} practiceMode={practiceMode} />{children}</LanguageProvider></body></html>;
}
