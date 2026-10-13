# Personal word lists

Signed-in accounts can open My word lists from the main navigation, create a
named list, search Portuguese words or English/Ukrainian translations in the
existing vocabulary, and add or remove words. Search returns up to 12 matching
words and excludes words already in the list. Removing a word removes only list
membership, preserving the vocabulary and learning history.

Practice this list uses the same exercise picker and answer-saving flow as
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
