import './globals.css';
import { LanguageProvider } from './components/language';
import Header from './components/header';
import { getCurrentUser } from '../lib/auth';

export const metadata = {
  title: 'Repeti · Learn words every day',
  description: 'Daily European Portuguese vocabulary practice.',
};

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  return <html lang="en"><body><LanguageProvider><Header signedIn={Boolean(user)} />{children}</LanguageProvider></body></html>;
}
