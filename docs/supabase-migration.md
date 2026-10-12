# Deploying with Supabase PostgreSQL

The app always uses Supabase PostgreSQL. Configure `DATABASE_URL` or the Supabase integration’s `POSTGRES_URL`; `DATABASE_URL` takes precedence. A missing connection setting raises a configuration error.
The same PostgreSQL backend is used locally and on Vercel. SQLite is retained only for migration tooling and test fixtures.
PostgreSQL tables live in the private `vocpt` schema. They are not exposed through
Supabase's default public Data API. The app connects only from the server.

## 1. Create and connect a Supabase project

Create a Supabase project in a region near your Vercel functions. In its dashboard,
click **Connect**, select **Transaction pooler**, and copy the PostgreSQL URI
(usually port **6543**). Use the database password, not an API key.
If your password contains special characters, URL-encode the password component.

Copy `.env.example` to `.env.local` and set:

```dotenv
DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@POOLER_HOST:6543/postgres
VOCPT_SECURE_COOKIES=true
```

Credentials stay in `.env.local`, which Git ignores. Never use a `NEXT_PUBLIC_`
prefix for database credentials. TLS certificate verification is enabled, using
the bundled Supabase Root 2021 CA for Supabase hosts. Its source is
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`
and its SHA-256 fingerprint is
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
To override it, put the project's certificate PEM contents in `DATABASE_CA_CERT`
with literal `\n` between lines.
The driver uses bound parameters without named prepared statements, a small
connection pool, and a single checked-out connection per transaction.

## 2. Inspect and migrate the local database

Stop the app and pause imports during the final transfer so new SQLite answers
are not written after the backup. The SQLite backup API includes committed WAL
data; copying only the `.sqlite` file would risk losing recent answers.

```sh
npm run db:migrate:supabase -- --dry-run
npm run db:migrate:supabase
npm run db:migrate:supabase -- --verify
```

The dry run checks integrity, foreign keys and expected columns, and prints row
counts and SHA-256 hashes without connecting to Supabase. The actual migration:

- Creates a consistent SQLite backup in `data/backups/`.
- Applies `supabase/migrations/202610090001_vocabulary.sql` in a transaction.
- Locks the target tables and refuses to overwrite any populated table.
- Imports users, words, sessions, groups, memberships, answers, archived words,
  archived answers and planned practice words while preserving IDs.
- Resets generated ID sequences so subsequent inserts work.
- Compares every imported column against the snapshot using row counts and hashes.
- Commits only after all comparisons pass and saves a report beside the backup.

`--verify` compares the current target with the current SQLite source. Run it
before allowing new PostgreSQL answers or imports, since legitimate changes
after migration will make the two databases differ. To verify the exact backup,
set `SQLITE_SOURCE_PATH` to the backup file path. `VOCPT_DATA_DIR` can also change
the default source directory.

The source must have the current SQLite schema. For an older source, use the
legacy `createSqliteDatabase` helper explicitly to upgrade it before migrating. The migration creates an empty
target schema and does not seed sample words into PostgreSQL. `npm run db:init`
checks the configured PostgreSQL database; migrations remain explicit.

## 3. Configure authentication and account progress

Email/password registration and login use Supabase Auth. The public `/` page is
available before login; signed-in accounts see their own learning dashboard.
Vocabulary and categories are shared, while sessions, answers, statistics, word
progress, and practice selection history are scoped to the authenticated account.

### Apply the account-progress migration

After the vocabulary schema is installed, run this once for each database:

```sh
npm run db:auth:init
```

The command backs up the existing PostgreSQL application tables to a private JSON
file in `data/backups/`, then applies
`supabase/migrations/202610090002_account_progress.sql` in a transaction. It adds
the session owner UUID, an index, and the one-time legacy progress claim table.
Existing sessions remain unassigned. It does not create an Auth account or send
an email. The migration is safe to rerun and has already been applied to the
configured Supabase project on 2026-10-09. That initial run preserved 14 legacy
sessions, reserved for `b.pratsiuk@gmail.com` through the setting below.

### Configure Auth environment variables

Get the project URL and publishable key from the Supabase project's **Connect**
dialog or API settings, then add them to `.env.local`:

```dotenv
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
LEGACY_PROGRESS_EMAIL=b.pratsiuk@gmail.com
```

The URL is resolved from `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. The key
is resolved from `SUPABASE_PUBLISHABLE_KEY`, then
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
The last option accepts the older anon JWT key. Use a publishable or anon key;
service-role and secret keys are rejected for user authentication. Database
passwords remain separate, in `DATABASE_URL` or `POSTGRES_URL`.

### Configure email confirmation and callback URLs

In Supabase **Authentication**, enable the Email provider and keep **Confirm
email** enabled. Registration requests a confirmation email, and unconfirmed
accounts cannot log in. The app uses a PKCE code exchange at `/auth/callback`.
Keep the default confirmation email link based on `{{ .ConfirmationURL }}`;
custom templates must preserve that verification flow.
[Supabase password authentication](https://supabase.com/docs/guides/auth/passwords),
[confirmation email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

In **Authentication → URL Configuration**, add these **Redirect URLs**:

- `http://localhost:3000/auth/callback`
- `http://localhost:3001/auth/callback`
- `https://words.repeti.me/auth/callback`

Set Supabase's **Site URL** to `https://words.repeti.me`, and set Vercel's
Production `SITE_URL` environment variable to the same origin. Locally, leave
`SITE_URL` unset so the app uses the request
origin, or set it to `http://localhost:3000` or `http://localhost:3001` to match
the running server. Add a callback URL for a custom domain if you use one.
These URLs must be allowed for signup confirmation redirects.
[Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)

If a confirmation link lands on `http://localhost:3000/?code=...`, check both
Supabase's Site URL and the redirect allowlist. The app explicitly requests
`/auth/callback`; an unallowed callback can fall back to Supabase's Site URL.
After correcting the settings, use a newly sent confirmation email. Register
and open the email link on the same app domain so the PKCE verifier cookie is
available; otherwise, confirm the email and then log in with email and password.

Open the confirmation link in the browser used to register, so its PKCE verifier
cookie is available. If the email was confirmed in another browser, return to
`/login` and sign in with email and password. For registrations beyond Supabase's
built-in email service restrictions, configure custom SMTP in Auth settings.
[Supabase email delivery](https://supabase.com/docs/guides/auth/auth-smtp)

### Reserve existing learning history

`LEGACY_PROGRESS_EMAIL=b.pratsiuk@gmail.com` reserves all unassigned pre-login
sessions and their answers, planned practice words, and archived history for
that account. After registration, email confirmation, and login, the first
authenticated access to learning data transfers the sessions once. The app
verifies that Supabase email confirmation is enabled before allowing the claim.
Other accounts cannot claim or view that history and start with new progress.
If the variable is unset, existing sessions remain safely unassigned.

## 4. Test locally and deploy

### Apply practice types

Before running this version, apply the additive practice-type migration:

```sh
npm run db:practice:init
```

This command backs up session metadata and adds `sessions.practice_mode` with
the three supported exercise types. Existing sessions stay in their original
YES / NO mode. It verifies that their metadata is preserved before committing
and is safe to rerun. Apply it separately to each Preview database as well.
The Practice button opens `/practice`, where the account chooses an exercise
and word count before starting. The last exercise choice is remembered per
account in this browser. Multiple-choice answers are checked on the server;
matching rounds are checked and saved atomically after all pairs are completed.

The repository's `vercel.json` selects Next.js, runs `npm run build`, and uses
the framework's default output directory. Keep the Vercel Root Directory at the
repository root and use Node.js 24.x. The `Other` framework preset serves only
the `public` assets and leaves the app's pages returning `404 NOT_FOUND`.
Configuration changes take effect on the next deployment; push the configuration
file to the production branch or redeploy after saving dashboard changes.

```sh
npm test
npm run build
npm run dev
```

Check the public landing page, registration and confirmation, login/logout,
vocabulary categories, statistics, archived history, practice answers and
refresh/resume. Check with two accounts that progress is separate and that an
account cannot open another account's practice URL. `npm run words:import -- <batch.json> [--dry-run]` uses the
configured backend. The explicit `scripts/clean-words.js` tool remains a local
SQLite cleanup tool; it does not modify PostgreSQL.

In Vercel project settings, add `DATABASE_URL` or `POSTGRES_URL`, the Supabase
Auth URL and publishable key, the production `SITE_URL`,
`LEGACY_PROGRESS_EMAIL=b.pratsiuk@gmail.com`, `VOCPT_SECURE_COOKIES=true`, and
`DATABASE_CA_CERT` if needed, then redeploy. Auth cookies are HttpOnly, use
SameSite=Lax, and are Secure in production. Use a separate Supabase project for
Preview deployments, apply its migrations, and configure its Auth callback URLs
and `SITE_URL` so preview testing cannot change production progress.

Application data access and practice mutations verify the Supabase user on the
server and filter session data by that account's UUID. Private database tables
remain inaccessible through the public Data API; import and migration commands
use the server's database connection.

## Recovery

If a migration fails, its PostgreSQL transaction rolls back and the SQLite
backup remains. Correct the error and retry. If the target is already populated,
use a new empty project or investigate its contents; the command never clears it.

Keep the SQLite backup for recovery. The app does not fall back to SQLite when
connection settings are missing. PostgreSQL activity after the switch is not
automatically copied back to SQLite.

References: [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres),
[node-postgres transactions](https://node-postgres.com/features/transactions).
