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
