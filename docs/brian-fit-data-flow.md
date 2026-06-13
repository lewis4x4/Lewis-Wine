# Brian-fit Data Flow

## Goal

Tie Brian Wine Intelligence directly to Brian's existing Pourfolio account instead of creating a parallel tracker.

User anchor:
- `dd49d396-763b-42e0-af6f-1b465d9532dc`

## What was added

### Database
- `brian_taste_profiles`
  - one personalized palate profile per user
- `rating_signals`
  - one structured preference record per rating

### App logic
- `useAddRating()` now supports optional `rating_signal` payloads when saving ratings
- recommendation API now reads:
  - cellar inventory
  - ratings
  - Brian taste profile
  - rating signals
- recommendation output now includes Brian-fit reasoning

### Seed path
- `docs/brian-wine-journal.json` remains the seed artifact
- `npm run db:seed:brian-fit` upserts Brian's taste profile
- if a matching live rating exists, it also attaches `rating_signals` to that rating

## Live account strategy

This is intentionally additive:
- no account split
- no duplicate user
- no destructive reset
- existing ratings remain valid
- future ratings can carry structured palate signals

## Practical next step

1. Run the migration
2. Run `npm run db:seed:brian-fit`
3. Start attaching `rating_signal` when Brian rates wines from the app or Telegram intake
4. Optionally expose Brian-fit score in the ratings and recommendations UI
