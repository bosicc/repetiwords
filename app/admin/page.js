import 'server-only';
import Link from 'next/link';
import { Text } from '../components/language';
import { requireSuperAdmin } from '../../lib/auth';
import { getAdminOverview, getAdminUsers } from '../../lib/admin-database';
import { PRACTICE_MODES } from '../../lib/practice-modes';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = {
  title: 'Admin · Repeti',
  robots: { index: false, follow: false },
};

function usersPageURL(query, page) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return `/admin${search ? `?${search}` : ''}#admin-users`;
}

function AccountDate({ value, emptyLabel = 'Not provided' }) {
  return value ? <time dateTime={value}>{value.slice(0, 10)}</time> : <Text>{emptyLabel}</Text>;
}

export default async function AdminPage({ searchParams }) {
  const user = await requireSuperAdmin();
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 254) : '';
  const page = typeof params.page === 'string' && /^[1-9]\d*$/.test(params.page) ? Number(params.page) : 1;
  const [overview, accounts] = await Promise.all([getAdminOverview(), getAdminUsers({ query, page })]);
  const metrics = [
    ['Registered accounts', overview.accounts],
    ['Vocabulary words', overview.words],
    ['Categories', overview.categories],
    ['Practice sessions', overview.sessions],
  ];
  const coverage = [
    { id: 'admin-english', label: 'English translations', count: overview.englishTranslations },
    { id: 'admin-ukrainian', label: 'Ukrainian translations', count: overview.ukrainianTranslations },
  ];

  return <main className={styles.page}>
    <nav className={`navigation ${styles.navigation}`} aria-label="Main navigation">
      <Link href="/"><Text>Home</Text></Link>
      <Link href="/vocabulary"><Text>Vocabulary</Text></Link>
      <Link href="/settings"><Text>Settings</Text></Link>
      <Link href="/admin" aria-current="page"><Text>Admin</Text></Link>
    </nav>
    <div className={styles.heading}>
      <span className={styles.badge}><Text>Super admin</Text></span>
      <h1><Text>User management</Text></h1>
      <p><Text>Find accounts and view their registration and practice activity.</Text></p>
      <span className={styles.account} translate="no">{user.email}</span>
    </div>

    <dl className={styles.metrics}>{metrics.map(([label, count]) => <div key={label}>
      <dt><Text>{label}</Text></dt><dd>{count.toLocaleString('en-GB')}</dd>
    </div>)}</dl>

    <section className={`${styles.panel} ${styles.users}`} id="admin-users" aria-labelledby="admin-users-title">
      <h2 id="admin-users-title"><Text>Accounts</Text></h2>
      <form className={styles.search} action="/admin" method="get">
        <label htmlFor="admin-user-search"><Text>Search by email</Text></label>
        <div>
          <input id="admin-user-search" type="search" name="q" maxLength={254} defaultValue={query} autoComplete="off" />
          <button className="primary" type="submit"><Text>Search</Text></button>
          {query && <Link href="/admin#admin-users"><Text>Clear search</Text></Link>}
        </div>
      </form>
      <p className={styles.results}><Text>Matching accounts</Text>: <strong>{accounts.total.toLocaleString('en-GB')}</strong></p>
      {accounts.users.length ? <div className={styles.tableScroll} role="region" aria-labelledby="admin-users-title" tabIndex={0}>
        <table className={styles.table}>
          <caption className={styles.tableCaption}><Text>Registered accounts and practice activity</Text></caption>
          <thead><tr>
            <th scope="col"><Text>Email</Text></th>
            <th scope="col"><Text>Confirmation status</Text></th>
            <th scope="col"><Text>Registered</Text></th>
            <th scope="col"><Text>Last sign in</Text></th>
            <th scope="col"><Text>Sessions</Text></th>
          </tr></thead>
          <tbody>{accounts.users.map((account) => <tr key={account.id}>
            <th scope="row" translate="no">{account.email || <Text>Not provided</Text>}</th>
            <td><span className={`${styles.status} ${account.emailConfirmed ? styles.confirmed : styles.pending}`}><Text>{account.emailConfirmed ? 'Confirmed' : 'Unconfirmed'}</Text></span></td>
            <td><AccountDate value={account.createdAt} /></td>
            <td><AccountDate value={account.lastSignInAt} emptyLabel="Never" /></td>
            <td>{account.sessions.toLocaleString('en-GB')}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className={styles.empty}><Text>No accounts match your search.</Text></p>}
      {accounts.totalPages > 1 && <nav className={styles.pagination} aria-label="Account pages">
        {accounts.page > 1 && <Link href={usersPageURL(query, accounts.page - 1)} rel="prev"><Text>Previous page</Text></Link>}
        <span><Text>Page</Text> {accounts.page} <Text>of</Text> {accounts.totalPages}</span>
        {accounts.page < accounts.totalPages && <Link href={usersPageURL(query, accounts.page + 1)} rel="next"><Text>Next page</Text></Link>}
      </nav>}
    </section>

    <div className={styles.panels}>
      <section className={styles.panel} aria-labelledby="admin-coverage-title">
        <h2 id="admin-coverage-title"><Text>Translation coverage</Text></h2>
        <p><Text>Words with a translation available.</Text></p>
        {coverage.map(({ id, label, count }) => <div className={styles.coverage} key={id}>
          <div><span id={id}><Text>{label}</Text></span><strong>{count.toLocaleString('en-GB')} / {overview.words.toLocaleString('en-GB')}</strong></div>
          <meter aria-labelledby={id} min="0" max={Math.max(overview.words, 1)} value={count}>{count} / {overview.words}</meter>
        </div>)}
      </section>
      <section className={styles.panel} aria-labelledby="admin-practice-title">
        <h2 id="admin-practice-title"><Text>Practice types</Text></h2>
        <p><Text>Sessions across all accounts, including legacy history.</Text></p>
        <dl className={styles.modeCounts}>{overview.sessionModes.map(({ mode, count }) => <div key={mode}>
          <dt><Text>{PRACTICE_MODES.find((exercise) => exercise.id === mode).title}</Text></dt>
          <dd>{count.toLocaleString('en-GB')}</dd>
        </div>)}</dl>
        <p className={styles.legacy}><Text>Unassigned practice sessions</Text>: <strong>{overview.unassignedSessions.toLocaleString('en-GB')}</strong></p>
      </section>
    </div>
  </main>;
}
