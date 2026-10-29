# Personal word lists

Signed-in accounts can open My words lists from the main navigation. Create list
opens a new list editor with its name focused at the top and word search below.
Names save on blur or Enter; new unnamed lists are stored as Untitled list.
Accounts can rename lists, search Portuguese words or English/Ukrainian translations in the
existing vocabulary, and add or remove words. Search returns up to 12 matching
words and excludes words already in the list. Removing a word removes only list
membership, preserving the vocabulary and learning history.

The same field accepts comma-separated Portuguese words (for example,
`café, água, casa`). Add words adds all exact matches without regard to case,
skips duplicates and existing members, and reports the number newly added.
Unknown words appear above the field in red and remain visible while editing
the next submission. Accents matter; surrounding whitespace and empty entries
are ignored. Multiword expressions are supported. Bulk additions accept up to
10,000 characters and check ownership on the server; they use one atomic insert.
Single-word substring and translation search remains available below the field.

## Public sharing and practice

Share list by link creates one stable, unguessable `/shared/<token>` URL.
Anyone holding it can read the current list and start any of the three practice
modes without signing in. Public pages expose the title and vocabulary, never
the author's identity or progress, and request no search-engine indexing.
Stop sharing revokes the URL; enabling sharing again creates a different token.
Already-started practices retain their word/translation/question snapshots and
can finish even after the author edits the list or revokes its link.

Save to My Lists copies the current title and memberships into the visitor's
account. Copies are independent; saving the same source again opens the existing
copy. Saving your own shared list opens its editor. Guests are returned to their
requested save after login/signup, including the email-confirmation callback.

Shared practice reuses the existing exercises and summary. Signed-in visitors'
answers and skips are recorded in their own ordinary sessions, answers, history
and word progress; the author's account is unaffected. Saving a copy is optional.
Guest practices instead use a separate temporary table, a random session UUID
and an HttpOnly browser secret (stored hashed in the database). Guest sessions
expire 24 hours after starting and expired rows are purged on new practice starts.
They never enter account statistics. After completion, the signup/login CTA
returns to the result and transfers it transactionally, exactly once, into the
authenticated account. This requires the same browser and an unexpired session.
Visitors can retry a failed transfer. Incomplete guest practices can also resume
after login and transfer after completion. Account sessions remain private after
transfer; the original guest browser secret alone no longer grants access.

Deployment: run `npm run db:lists:init` before deploying this version. It now also
applies `202610290001_shared_lists.sql`, adding sharing, temporary practices and
copy-source bookkeeping with RLS and no public policies. Configure Supabase Auth
to allow the site's `/auth/callback` URL with its return query parameters.
No changes to existing vocabulary or progress are required.

Validation: `scripts/shared-lists.test.js` covers ownership, revocation,
independent copies, each exercise as guest/account, retries, expired sessions,
single-use transfers and safe authentication return destinations.

The header's Practice button, when opened from an individual list, uses the
same exercise picker and answer-saving flow as
general practice. Its candidate pool is restricted to list members, with the
existing practice mix applied within that pool. Sessions snapshot their words,
so changing list membership does not change sessions already started. Smaller
lists yield shorter sessions without repeating words. Multiple-choice distractors
still use the shared vocabulary, as in ordinary practice; target words are all
from the list. Progress is saved to the account's existing learning history.

Before deploying the new app version, apply the additive migration to each
target database:

```sh
npm run db:lists:init
```

This creates private tables with RLS enabled and no public policies. All reads,
membership changes, and practice starts verify the signed-in owner on the server.
The migration is transactional and safe to rerun. It does not change existing
tables or vocabulary. No new dictionary words are imported by this feature.

Validation: `npm test` includes owner isolation, literal search, duplicates,
empty lists, short lists, and all practice modes; `npm run build` checks routes.
