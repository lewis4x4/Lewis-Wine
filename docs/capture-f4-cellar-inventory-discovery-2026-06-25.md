# F4 Cellar / Inventory Integration Discovery — 2026-06-25

## Objective

Discover and implement how `/capture` should connect captured tastings to cellar truth without creating a second, confusing wine model.

Roadmap F4 target:

- keep restaurant/shop captures memory-only by default;
- allow explicit `add_to_cellar` when Brian owns or bought the bottle;
- allow `link_existing_inventory` when `/capture` is opened from a cellar bottle;
- avoid duplicate wine identity and broken post-save links.

## Key finding

Pourfolio has two separate wine-memory models:

1. **Cellar-owned inventory model**
   - `cellars`
   - `cellar_inventory`
   - `ratings`
   - `rating_signals`
   - `wine_reference`

2. **Capture/intelligence memory model**
   - `wines`
   - `tastings`
   - private Storage bucket `wine-evidence`

`/cellar/[id]` expects `cellar_inventory.id`.

The old field-capture action built:

```ts
/cellar/${wine_id}?tasting=${tasting_id}
```

But that `wine_id` came from `public.wines`, not `public.cellar_inventory`, so memory-only captures could save correctly while creating a broken Bottle Detail link.

## Implementation completed

### Save modes

Added:

```ts
export type FieldCaptureSaveMode =
  | "memory_only"
  | "add_to_cellar"
  | "link_existing_inventory";
```

Defaults:

- normal `/capture` → `memory_only`;
- `/capture?inventory_id=...` → `link_existing_inventory`;
- explicit review choice → `add_to_cellar`.

### Pure helpers

Added tested helpers:

- `buildFieldCaptureCellarPayload(...)`
- `buildFieldCaptureRatingPayload(...)`
- `buildFieldCaptureRatingSignalPayload(...)`
- expanded `createPostSaveActions(...)`

Behavior:

- memory-only captures do **not** generate `/cellar/{wines.id}`;
- cellar-linked captures generate `/cellar/{inventory_id}?tasting={rating_id}`;
- cellar payload defaults quantity to `1` and includes field-capture provenance tags;
- rating payload writes canonical cellar ratings;
- rating-signal payload preserves buy-again, decision tags, descriptors, and extraction context.

### API route

Extended `POST /api/field-capture/save` to accept:

```ts
save_mode?: FieldCaptureSaveMode;
inventory_id?: string | null;
cellar_id?: string | null;
quantity?: number | null;
```

#### `memory_only`

- Saves/reuses `wines` row.
- Saves `tastings` row.
- Stores evidence in `wine-evidence` when provided.
- Returns no Bottle Detail action unless there is a real inventory id.

#### `link_existing_inventory`

- Validates inventory ownership through `cellar_inventory -> cellars.owner_id`.
- Inserts canonical `ratings` row.
- Upserts `rating_signals` row.
- Still saves the capture-only `tastings` row for evidence/capture continuity.
- Stores cross-links in `tastings.extraction`:

```json
{
  "save_mode": "link_existing_inventory",
  "inventory_id": "...",
  "rating_id": "..."
}
```

- Returns Bottle Detail action using `/cellar/{inventory_id}?tasting={rating_id}`.

#### `add_to_cellar`

- Fetches the authenticated user’s cellar.
- Inserts `cellar_inventory` from captured identity.
- Inserts `ratings` and `rating_signals` when score exists.
- Returns Bottle Detail action using `/cellar/{new_inventory_id}?tasting={rating_id}`.

### UI route

`/capture` now reads `inventory_id` from search params and passes it into `FieldCaptureExperience`.

The review UI now includes “Where should this memory land?” with:

- `Just remember this tasting`
- `Link to this cellar bottle` when launched with `inventory_id`
- `Add one bottle to cellar`

Copy explains that memory-only capture will not create a broken cellar route.

## Live proof completed

A temporary confirmed Supabase Auth user and temporary cellar/inventory row were created, then cleaned up.

Proof assertions passed:

- `POST /api/field-capture/save` returned HTTP `200` and `success: true`.
- `ratings.inventory_id` matched the linked `cellar_inventory.id`.
- `rating_signals` was created with `buy_again = true` and `link-existing-inventory` decision tag.
- `tastings.extraction.inventory_id` and `tastings.extraction.rating_id` matched the linked rows.
- Returned Bottle Detail href was `/cellar/{inventory_id}?tasting={rating_id}`.
- Evidence object was stored in private `wine-evidence` storage.
- Raw base64 evidence did not leak into `tastings.extraction`.

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

The interrupted prior proof user/cellar/inventory were also removed before this proof ran.

## Browser smoke

Verified in browser:

- `/capture?demo=tapiz` defaults to `Just remember this tasting` and has no linked-cellar option.
- `/capture?demo=tapiz&inventory_id=<uuid>` defaults to `Link to this cellar bottle` and shows linked-cellar copy.
- Browser console errors: `0`.

## Verification gates

Passed:

```bash
npm run test:field-capture
npm run typecheck
npm run lint
git diff --check
npm run check
```

`npm run check` included the full current Pourfolio gate suite plus `next build`.

## Schema boundary

No migration was required for this slice.

Cross-links are stored in `tastings.extraction` for now. A later hardening migration can add typed columns if downstream queries need first-class joins:

```sql
alter table public.tastings add column if not exists inventory_id uuid references public.cellar_inventory(id) on delete set null;
alter table public.tastings add column if not exists rating_id uuid references public.ratings(id) on delete set null;
```

## Deferred work

- Add typed `tastings.inventory_id` and `tastings.rating_id` columns if downstream queries need first-class joins.
- Add a proper captured-wine detail route if memory-only captures become a primary review surface.
- Add idempotency for repeated save attempts from flaky mobile/offline paths.
- Add richer quantity/purchase controls to `add_to_cellar` after the linked-inventory path proves stable in normal use.
