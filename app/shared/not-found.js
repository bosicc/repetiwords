import Link from 'next/link';
import { Text } from '../components/language';

export default function SharedNotFound() {
  return <main className="card">
    <h1><Text>This shared list or practice is unavailable.</Text></h1>
    <p><Text>The link may have been disabled, or this practice has expired or belongs to another browser or account.</Text></p>
    <Link href="/"><Text>Home</Text></Link>
  </main>;
}
