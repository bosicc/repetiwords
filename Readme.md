# Portuguese Vocabulary Learning 

A project for learning European Portuguese as spoken in Lisbon through a vocabulary-based learning approach.

The main idea is to learn new words every day, review mistakes, track progress through statistics, and focus repeated practice on recurring errors.

## How it works

1. Collect and maintain a database of Portuguese words.
2. Show words to the learner, who marks whether they know each word: **YES** or **NO**.
3. Save the answers from each learning session.
4. Update statistics to track progress and identify words that need more practice.

## Practice word selection rule

Build each practice session from a mix of familiar words, new vocabulary, and words that need review.

| Word pool | Target share | In a 10-word session |
| --- | --- | --- |
| Practiced | 10% | 1 word with at least 3 correct YES answers without Reveal in earlier sessions |
| New | Up to 40%, when available | 4 words that have never been practiced |
| Review | 50% or more | 5 words previously skipped, answered NO, or answered using Reveal |

If fewer new words are available, fill their remaining slots with review words. For example, with only 2 new words available, a 10-word session contains 1 practiced word, 2 new words, and 7 review words.

Apply the same proportions to the session sizes available in Settings:

| Session size | Practiced | New, if available | Review |
| --- | --- | --- | --- |
| 10 | 1 | 4 | 5+ |
| 30 | 3 | 12 | 15+ |
| 100 | 10 | 40 | 50+ |

Choose words randomly within each pool, include each word only once per session, and shuffle the final list. If a pool cannot fill its allocation, use available words from the other pools, prioritizing review, then new words, then practiced words. With no practice history, fill the session with new words. If the vocabulary has fewer words than the requested session size, use all available words once.

Pools do not overlap: words with at least 3 unassisted correct answers belong to Practiced, even if they have older mistakes or skips. Other words with mistakes, skips, or hinted answers belong to Review. Words with only 1–2 unassisted correct answers are still learning; use them as the last fallback after the three main pools. Unanswered words in unfinished sessions still count as new. The practiced threshold counts correct answers across sessions; the Mastered statistic separately requires 3 consecutive unassisted correct answers.

The app applies this selection rule whenever a new practice session is created.

## Technology

- **Next.js** — the application framework.
- **Supabase PostgreSQL** — the database for words and learning session data.
- **Supabase Auth** — email/password registration, login, and account sessions.

## Words parsing and importing

The import workflow builds a vocabulary database from word sources such as URLs, websites, and files. A local agent skill prepares sources into JSON batches, and a command-line importer saves validated batches to Supabase PostgreSQL.

### Word record structure

Each word record in PostgreSQL includes:

| Field | Description | Allowed values |
| --- | --- | --- |
| Portuguese word | One word in European Portuguese (PT), including compounds with hyphens. | Letters, optionally joined by hyphens; no phrases or slash shorthand |
| Level | CEFR language proficiency level, separate from the learner's mastery. | A1, A2, B1, B2, C1, C2 |
| English translation | The word's meaning in English. | Text |
| Ukrainian translation | The word's meaning in Ukrainian. | Text |
| Mastery level | Legacy vocabulary field retained for migrated records. The app calculates each account's displayed progress from its answers. | Integer from 0 to 5 |

The database columns are `portuguese`, `level`, `english`, `ukrainian`, and `mastery_level`, plus the primary key `id`. Level and Ukrainian translation can be `NULL` until supplied. New vocabulary records initialize the legacy `mastery_level` field to 0; account progress is stored through session answers. Schema changes use explicit PostgreSQL migrations, preserving words and practice history.

### Word groups

Words can be organized into groups such as **Colors**, **Numbers**, **Animals**, and **Pets**. A word can belong to multiple groups, and each group can contain multiple words. For example, **gato** can belong to **Animals**, **Pets**, and **Common nouns**. Words can also remain ungrouped until categorized.

Groups describe topics or word types. Source names, book titles, unit/practice numbers and import collections belong in source metadata, not in vocabulary categories. Keep provenance in the local import JSON and curriculum files.

Store group membership in separate PostgreSQL tables:

| Table | Fields | Purpose |
| --- | --- | --- |
| `words` | `id` plus the word fields above | Store each word once. |
| `groups` | `id`, `name` | Store the available groups. |
| `word_groups` | `word_id`, `group_id` | Link a word to each of its groups. |

The `word_groups` fields reference `words.id` and `groups.id`. Make the pair `(word_id, group_id)` unique to prevent duplicate memberships. Group membership shares the same word record and mastery level across all groups.

The planned learning interface will support practicing all words or filtering practice by a selected group.

### Import workflow

1. **Add sources:** collect URLs, websites, files, or other sources of Portuguese words.
2. **Parse words:** save source phrases locally for context, split them into individual words, expand gender alternatives, and deduplicate. Keep compounds such as `pequeno-almoço` intact.
3. **Label levels:** assign each word a CEFR level: A1, A2, B1, B2, C1, or C2.
4. **Add translations:** provide both English and Ukrainian translations for each word, using existing translations when available.
5. **Assign groups:** choose thematic or grammatical groups, reusing existing names where appropriate. Assign zero, one, or multiple groups to each word. Keep source and textbook-section labels in metadata.
6. **Insert into Supabase PostgreSQL:** save the words, levels, translations, and group memberships, with mastery level initialized to 0 for new words.

### Local JSON backups and importing

Save every extracted and enriched batch in `imports/` before importing. Use dated filenames with the source name, and a new suffix for subsequent batches; preserve earlier files. The extracted file retains source meanings; the enriched file includes translations, estimated levels, groups, and preparation notes. These JSON files back up vocabulary imports; learner progress requires a separate database backup.

An enriched batch has this shape:

```json
{
  "source": "https://example.com/vocabulary",
  "prepared_at": "2026-10-09",
  "words": [
    {
      "portuguese": "gato",
      "english": "cat",
      "ukrainian": "кіт",
      "level": "A1",
      "groups": ["Animals", "Pets"]
    }
  ]
}
```

Preview and import a saved batch from the repository root:

```sh
npm run words:import -- imports/2026-10-09-carla-unique-words-enriched.json --dry-run
npm run words:import -- imports/2026-10-09-carla-unique-words-enriched.json
```

The importer validates the entire batch before importing, then writes words, groups, and memberships in one transaction. New words start at mastery 0. Existing words retain IDs, translations, levels, mastery, and practice history; missing Ukrainian translations and levels are filled, and additional groups are linked. Conflicting existing fields are reported and preserved. Replaying a batch creates no duplicate records. A dry run reports proposed changes without importing the batch; opening the database still performs normal schema initialization and starter seeding.

The local skill is `skills/vocpt-import-words/SKILL.md`, registered through `.agents/skills/vocpt-import-words` and linked from `AGENTS.md`. Invoke it as `$vocpt-import-words` in a session that has discovered the skill, or ask the agent to read that file. It guides extraction, translation, level estimation, local backups, and importing. The source-specific parser `scripts/parse-carla.py` handles the article's written Part 1 lists.

The first batch comes from [Portuguese with Carla](https://portuguesewithcarla.com/1000-most-common-portuguese-words/): 508 written entries, merged into 499 unique records across 40 topic and parent groups. Only the written Part 1 lists were extracted; vocabulary in videos was not included. English meanings and groups come from the source, with corrections recorded in the enriched JSON. Ukrainian translations and CEFR estimates were prepared by the assistant and have not been independently reviewed.

The [99 Essential European Portuguese Phrases](https://portuguesewithcarla.com/99-essential-european-portuguese-phrases/) batch contains all 100 entries in the article's main lists, including standalone vocabulary. Expanding alternate verbs and gender forms produces 106 complete phrase variants. A separate list contains 193 unique word forms, with links to their source phrase indices. Words are lowercased and NFC-normalized; punctuation, numeric annotations, and placeholders are removed. Lexical compounds are retained, attached pronouns are separated, and other inflected forms remain distinct. `scripts/parse-carla-phrases.py` prepares the extracted JSON; `python3 scripts/test_phrase_parser.py` checks its parsing and tokenization.

The extracted phrases, enriched phrases, unique-word batch, and import reports are saved as `imports/2026-10-09-carla-phrases-extracted.json`, `imports/2026-10-09-carla-phrases-enriched.json`, `imports/2026-10-09-carla-unique-words-enriched.json`, and the corresponding `*-import-report.json` files. The phrase import added 77 records and reused 29; the word import added 123 and reused 70. Existing conflicting meanings were preserved, with contextual translations retained in JSON. Ukrainian translations and CEFR levels are assistant translations and estimates. The source's English emergency-number error was corrected from 911 to 112 in the enriched phrase batch.

### Words-only database

Only individual words belong in `words`. The importer rejects whitespace, punctuation, and slash shorthand in Portuguese entries. Gender variants are separate records (`professor`, `professora`); hyphenated compounds remain intact. Original phrase JSON files are preserved as source context. Older enriched files containing phrases or shorthand must be split before replaying.

The 2026-10-09 cleanup archived 161 phrase, punctuation, and shorthand records and added 113 component words, leaving 653 words. The replacement batch is `imports/2026-10-09-word-cleanup-enriched.json`. A full pre-cleanup SQLite backup is in `data/backups/`, and a JSON report is alongside the batch. `archived_words` preserves original records, mastery, and group IDs; `archived_answers` preserves their answers and session links. Overall statistics include archived answers, while practice and vocabulary show only current words. Phrase progress is not assigned to component words.

The vocabulary fields, group tables, JSON importer, and source preparation skill are implemented. Automatic in-app source ingestion remains planned.

### Textbook curriculum map

The [Passaporte para Português 1 topic map](curriculum/passaporte-portugues-1/topic-word-map.md) organizes the supplied PDF's 40 units and 10 practical scenarios into learning topics and word lists. The [structured JSON](curriculum/passaporte-portugues-1/topic-word-map.json) contains 789 unique words, many-to-many section associations, source page references, and matches to existing database word IDs. The [extracted source text](curriculum/passaporte-portugues-1/source-extraction.json) is saved locally.

The supplied file is a 16-page A1–A2 preview, with a full contents table and a few sample lessons. Most word associations and the suggested A1 starting path are assistant recommendations; verified sample occurrences are marked separately. The curriculum map records the comparison before import; the replayable import batch is saved separately.

On 2026-10-09, the [enriched Passaporte batch](imports/2026-10-09-passaporte-topic-words-enriched.json) added 439 words and reused 350, bringing SQLite to 1,092 active words. It added 52 curriculum groups (40 units, 10 practical scenarios, the course, and its suggested A1 starting vocabulary) and 2,661 memberships, including links to existing topic groups. New words have English and Ukrainian translations and estimated CEFR levels prepared by the assistant. Existing translations, levels, mastery and learning history were preserved; eight words have additional contextual meanings recorded in the JSON for review.

The [extracted backup](imports/2026-10-09-passaporte-topic-words-extracted.json), [import report](imports/2026-10-09-passaporte-topic-words-import-report.json), [verification report](imports/2026-10-09-passaporte-topic-words-verification-report.json), and [backup manifest](imports/2026-10-09-passaporte-topic-words-manifest.json) are saved locally. A complete pre-import SQLite backup is in `data/backups/`. Validation confirmed all word/group links, preservation of original records, database integrity, and a repeat dry run with no additions or conflicts.

### Category vocabulary supplements

The [2026-10-09 category review](imports/2026-10-09-category-supplement-report.md) inspected all 104 groups and expanded 96. The [replayable batch](imports/2026-10-09-category-supplement-enriched.json) added 341 words and new memberships for 343 existing words, creating 2,068 links and bringing the vocabulary to 1,433 words. No new categories were needed.

New English/Ukrainian translations and A1/A2 estimates are assistant-generated. Additions to textbook sections are teaching suggestions, not claimed textbook extractions. Existing translations and learning progress were preserved. Complete basic sets such as weekdays, months and seasons were retained; source-specific collections were not expanded with generated words. The [audit](imports/2026-10-09-category-supplement-audit.json) records before/after counts and proposed additions for every group, and the [manifest](imports/2026-10-09-category-supplement-manifest.json) lists JSON files and the full SQLite backup. Database integrity and a duplicate-free replay were verified.

### Source-category cleanup

The 2026-10-09 cleanup removed all 52 Passaporte course/unit/practice groups plus `Essential Travel Phrases` and `Words from Essential Travel Phrases`. The database now has 50 categories and retains all 1,433 words. The 132 words that would otherwise have lost all categories received 157 memberships in existing topical groups. Words, translations, mastery, sessions, answers and archived records were unchanged.

The [cleanup report](imports/2026-10-09-source-category-cleanup-report.json) records the result and SQLite backup path; the [plan](imports/2026-10-09-source-category-cleanup-plan.json) preserves removed categories and memberships. The [current vocabulary snapshot](imports/2026-10-09-source-category-cleanup-vocabulary.json) contains the remaining categories and can be replayed without restoring source groups. Historical import files remain unchanged as backups: before replaying them, prepare a new copy that maps source groups to appropriate topical categories. This is an import-preparation rule; the generic CLI does not automatically strip source labels.

## Accounts and progress

The public home page introduces the app and links to `/login` and `/register`. Both forms use only email and password; registration requires at least 8 password characters. Supabase Auth manages credentials and email confirmation. After signing in, Home shows the learner's statistics and session history; vocabulary, practice, and settings require an authenticated account.

Vocabulary and categories are shared. Each account has its own sessions, answers, word progress, and practice selection history, linked by `vocpt.sessions.user_id` to `auth.users.id`. A learner cannot open or answer another account's practice session. The older `vocpt.users` profile table is retained for migrated data and CLI compatibility; it does not authenticate learners.

Set `LEGACY_PROGRESS_EMAIL=b.pratsiuk@gmail.com` to reserve the pre-login sessions and learning history for that account. They remain unassigned until the account registers, confirms its email, and signs in. The first authenticated access to learning data transfers them once, including archived session history. Other accounts start with fresh progress. Keep Supabase **Confirm email** enabled: the app refuses to transfer legacy progress when email confirmation is disabled.

See the [Supabase setup guide](docs/supabase-migration.md#3-configure-authentication-and-account-progress) for the account migration, Auth keys, and confirmation callback URLs.

## Run locally

Requires Node.js 20.9 or later (Node.js 24 LTS recommended). Copy `.env.example` to `.env.local` and configure `DATABASE_URL` or `POSTGRES_URL`, plus `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, before starting. Supabase's `NEXT_PUBLIC_SUPABASE_URL` and publishable/anon key alternatives are also supported; see the setup guide for their precedence.

```sh
npm install
npm run db:init
npm run dev
```

Open http://localhost:3000. `db:init` verifies access to the existing Supabase database; schema migrations run explicitly. The account-progress migration has already been applied to the configured Supabase project. For another database with the vocabulary schema installed, run `npm run db:auth:init` before starting the app. Allow the local `/auth/callback` URL in Supabase Auth; leave `SITE_URL` unset locally to use the current request origin, or set it to the local origin you are using.

```sh
npm run build
npm start
```

## Current functionality

- Public landing page, email/password registration and login, email confirmation, and logout.
- Separate learning progress and session history for every registered account.
- Starter words, plus vocabulary imported from local JSON batches.
- Reveal a word's English or Ukrainian meaning and answer YES, NO, or Skip.
- Create a session from Home, save answers automatically, and view session and cumulative statistics.
- Build practice sessions with the 10/40/50 selection mix described above and shuffle their word order.

The app stores vocabulary and learning progress in Supabase PostgreSQL, both locally and on Vercel. See the [Supabase migration and deployment guide](docs/supabase-migration.md) for database credentials, Auth configuration, and transferring existing vocabulary and progress. Each answer and skip is saved immediately, so refreshing the practice page resumes the signed-in account's session at the next unprocessed word.

Deploy on Vercel with the database connection, Supabase Auth URL/key, and production `SITE_URL` configured. SQLite files in `data/` are legacy migration sources and backups, excluded from Git.
