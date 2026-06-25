# F5 Field Capture Idempotency / Retry Hardening — 2026-06-25

## Objective

Make `/capture` safe under flaky mobile/offline retry conditions. A repeated save attempt with the same client operation key must return the existing saved result instead of creating duplicate capture tastings, cellar ratings, or rating signals.

## Implementation

### Schema

Added migration:

```text
supabase/migrations/00021_field_capture_idempotency.sql
```

It adds:

```sql
alter table public.tastings
  add column if not exists field_capture_idempotency_key text;

alter table public.ratings
  add column if not exists field_capture_idempotency_key text;

create unique index if not exists idx_tastings_field_capture_idempotency
  on public.tastings(owner_id, field_capture_idempotency_key)
  where field_capture_idempotency_key is not null;

create unique index if not exists idx_ratings_field_capture_idempotency
  on public.ratings(user_id, field_capture_idempotency_key)
  where field_capture_idempotency_key is not null;
```

The migration was applied to the linked Supabase project and verified remotely:

- `ratings.field_capture_idempotency_key`
- `tastings.field_capture_idempotency_key`
- `idx_ratings_field_capture_idempotency`
- `idx_tastings_field_capture_idempotency`

### Client / payload

`FieldCaptureExperience` now creates a stable `field-capture-{uuid}` key per capture attempt and sends it with the save payload as:

```ts
idempotency_key
```

The key is regenerated only when a new file/capture attempt starts or the user resets the capture. Retrying the same save keeps the same key.

Pure helper added:

```ts
normalizeFieldCaptureIdempotencyKey(...)
```

Rules:

- trims whitespace;
- empty/null becomes `null`;
- length over 160 is rejected.

`buildSaveTastingPayload(...)` now carries the normalized key and also includes it in `tastings.extraction.field_capture_idempotency_key` for traceability.

### API replay behaviour

`POST /api/field-capture/save` now:

1. Checks for an existing `tastings` row for the authenticated user + idempotency key before doing any writes.
2. If found, returns the existing wine/tasting/inventory/rating/action payload with:

```json
{ "replayed": true }
```

3. Writes `field_capture_idempotency_key` to both:
   - `tastings`
   - `ratings` when a cellar-linked rating is created
4. Handles unique-constraint races by looking up the existing saved row instead of creating duplicates.

## Live replay proof

A temporary confirmed Supabase Auth user and temporary cellar/inventory row were created. The same linked-cellar field-capture payload was posted twice with the same idempotency key.

Assertions passed:

```json
{
  "firstStatus": true,
  "secondStatus": true,
  "replayed": true,
  "sameTasting": true,
  "sameRating": true,
  "oneTasting": true,
  "oneRating": true,
  "oneSignal": true,
  "bottleHref": true
}
```

Cleanup verification returned:

```json
{
  "user": 0,
  "cellar": 0,
  "inventory": 0,
  "wine": 0,
  "tasting": 0,
  "rating": 0,
  "signal": 0,
  "evidence": false,
  "cleanupErrors": []
}
```

## Verification gates

Passed:

```bash
npm run test:field-capture
npm run typecheck
npm run lint
git diff --check
npm run check
```

`npm run check` included the full Pourfolio suite and `next build`.

Browser smoke:

- `/capture?demo=tapiz` still renders review correctly.
- Browser console errors: `0`.

## Deferred work

- Add offline queue UX for field-capture saves, using the same persisted idempotency key.
- Add a visible “retrying existing save” UI message if a replay response comes back from the API.
- Consider a generic idempotency table if more save flows need cross-table operation replay semantics.
