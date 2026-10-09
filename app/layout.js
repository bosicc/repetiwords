import './globals.css';
import { LanguageProvider } from './components/language';
import Header from './components/header';

export const metadata = {
  title: 'VocPT · Learn Portuguese',
  description: 'Daily European Portuguese vocabulary practice.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><LanguageProvider><Header />{children}</LanguageProvider></body></html>;
}
