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

## 3. Test locally and deploy

```sh
npm test
npm run build
npm run dev
```

Check vocabulary categories, statistics, archived history, practice answers and
refresh/resume. `npm run words:import -- <batch.json> [--dry-run]` uses the
configured backend. The explicit `scripts/clean-words.js` tool remains a local
SQLite cleanup tool; it does not modify PostgreSQL.

In Vercel project settings, add `DATABASE_URL` or `POSTGRES_URL`, `VOCPT_SECURE_COOKIES=true`, and
`DATABASE_CA_CERT` if needed, then redeploy. Use a separate Supabase project for
Preview deployments so preview testing cannot change production progress.

This remains a single-learner app. Protect the deployment or add application
authentication before making it public; private database tables do not restrict
who can invoke the app's server actions. Supabase Auth and per-user data isolation
are separate work.

## Recovery

If a migration fails, its PostgreSQL transaction rolls back and the SQLite
backup remains. Correct the error and retry. If the target is already populated,
use a new empty project or investigate its contents; the command never clears it.

Keep the SQLite backup for recovery. The app does not fall back to SQLite when
connection settings are missing. PostgreSQL activity after the switch is not
automatically copied back to SQLite.

References: [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres),
[node-postgres transactions](https://node-postgres.com/features/transactions).
