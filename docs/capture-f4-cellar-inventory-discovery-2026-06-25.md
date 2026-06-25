# F4 Cellar / Inventory Integration Discovery — 2026-06-25

## Objective

Discover how `/capture` should connect captured tastings to cellar truth without creating a second, confusing wine model.

Roadmap F4 target:

- keep restaurant/shop captures memory-only by default;
- allow explicit `add_to_cellar` when Brian owns or bought the bottle;
- allow `link_existing_inventory` when `/capture` is opened from a cellar bottle;
- avoid duplicate wine identity and broken post-save links.

## Commands / inspections run

```bash
git status --short --branch
git log -3 --oneline
supabase db query --linked "select table_name, column_name, data_type, is_nullable ..."
```

Files inspected:

- `src/lib/field-capture.ts`
- `src/components/wine/field-capture-experience.tsx`
- `src/app/api/field-capture/save/route.ts`
- `src/app/(dashboard)/cellar/page.tsx`
- `src/app/(dashboard)/cellar/[id]/page.tsx`
- `src/app/(dashboard)/cellar/add/page.tsx`
- `src/lib/hooks/use-cellar.ts`
- `src/lib/hooks/use-ratings.ts`
- `src/lib/acquisition-receipt.ts`
- `src/app/api/acquisition-receipts/route.ts`
- `src/lib/bottle-intelligence.ts`
- `supabase/migrations/00001_initial_schema.sql`
- `supabase/migrations/00009_brian_fit.sql`
- `supabase/migrations/00013_pourfolio_intelligence_sprint_a.sql`

## Current model split

Pourfolio currently has two separate but complementary wine-memory models.

### 1. Cellar-owned inventory model

Tables:

- `cellars`
- `cellar_inventory`
- `ratings`
- `rating_signals`
- `wine_reference`

Shape:

- `cellar_inventory.id` is the canonical Bottle Detail route id.
- `/cellar/[id]` queries `cellar_inventory.id` directly.
- Bottle Intelligence actions already link to `/capture?inventory_id={cellar_inventory.id}`.
- `ratings.inventory_id` links tasting memory to owned cellar bottles.
- `rating_signals` provides Brian-Fit/taste-genome structure.

Remote schema proof confirmed these columns exist:

- `cellar_inventory.cellar_id`
- `cellar_inventory.wine_reference_id`
- `cellar_inventory.custom_name`
- `cellar_inventory.custom_producer`
- `cellar_inventory.custom_vintage`
- `cellar_inventory.custom_region`
- `cellar_inventory.custom_wine_type`
- `cellar_inventory.vintage`
- `cellar_inventory.quantity`
- `cellar_inventory.purchase_*`
- `cellar_inventory.label_image_url`
- `cellar_inventory.notes`
- `cellar_inventory.tags`
- `ratings.inventory_id`
- `ratings.wine_reference_id`
- `ratings.score`
- `ratings.tasting_notes`
- `rating_signals.buy_again`

### 2. Capture/intelligence memory model

Tables:

- `wines`
- `tastings`
- private Storage bucket `wine-evidence`

Shape:

- `wines.id` is a personal captured wine identity.
- `tastings.wine_id` links to `wines.id`.
- `tastings.evidence_path` stores private label evidence path.
- `tastings.extraction` stores field-capture extraction metadata.
- Replenishment currently reads both inventory-backed `ratings` and capture-only `tastings`.

Remote schema proof confirmed these columns exist:

- `wines.owner_id`
- `wines.vintage`
- `tastings.owner_id`
- `tastings.wine_id`
- `tastings.score`
- `tastings.buy_again`
- `tastings.descriptors`
- `tastings.notes`
- `tastings.evidence_path`
- `tastings.extraction`

## Key finding: current post-save Bottle Detail link is wrong for memory-only captures

Current field capture actions build:

```ts
/cellar/${wine_id}?tasting=${tasting_id}
```

But `/cellar/[id]` expects:

```ts
cellar_inventory.id
```

Current `/api/field-capture/save` returns `wine.id` from the `wines` table, not a `cellar_inventory.id`.

Impact:

- Memory-only captures save correctly.
- Evidence storage saves correctly.
- But `View bottle intelligence` points to a route that cannot find the captured wine unless a cellar inventory row happens to have the same UUID, which it should not.

This is the first F4 fix.

## Existing reusable patterns

### Add to cellar

`/cellar/add` and `useAddToInventory` already show the canonical client pattern:

```ts
cellar_inventory.insert({
  cellar_id,
  wine_reference_id,
  custom_name,
  custom_producer,
  custom_vintage,
  custom_wine_type,
  custom_region,
  vintage,
  quantity,
  purchase_price_cents,
  purchase_location,
  purchase_date,
  notes,
  tags,
  simple_location,
  location_id,
})
```

`acquisition-receipts` already has a server-side add-to-cellar pattern via `receiptItemToCellarPayload(...)` and `POST /api/acquisition-receipts`.

### Link to existing inventory

`Bottle Intelligence` already emits:

```ts
/capture?inventory_id={cellar_inventory.id}
```

But `/capture` currently ignores `inventory_id`.

`/cellar/[id]` already adds ratings against inventory via:

```ts
ratings.insert({
  inventory_id: id,
  wine_reference_id: wine?.wine_reference_id ?? null,
  score,
  tasting_notes,
  ...
})
```

This is the correct target for linked cellar tastings.

### Rating signals

`rating_signals` can preserve structure for Brian-Fit and Taste Genome:

- `buy_again`
- `decision_tags`
- `occasion_tags`
- `brian_phrases`
- `extracted_from_text`

F4 should create these for linked/add-to-cellar saves when score or descriptors exist.

## Recommended implementation approach

### Add a save mode to field capture

Add pure type/helper first:

```ts
export type FieldCaptureSaveMode =
  | "memory_only"
  | "add_to_cellar"
  | "link_existing_inventory";
```

Draft/payload should carry:

```ts
save_mode: FieldCaptureSaveMode;
inventory_id?: string | null;
cellar_id?: string | null;
quantity?: number;
```

Default:

- `memory_only` for normal `/capture`.
- `link_existing_inventory` when `/capture?inventory_id=...` is present and the inventory row belongs to the user.
- explicit `add_to_cellar` only when Brian chooses it in the review UI.

### Server-side behavior

Use a single authenticated route, still `POST /api/field-capture/save`.

#### `memory_only`

Current behavior, except fix returned action:

- save/reuse `wines` row;
- save `tastings` row;
- return no Bottle Detail action unless there is an inventory id;
- use a safer route/action like `Capture another`, `Find more`, or a future captured-wine route.

#### `link_existing_inventory`

- Verify `inventory_id` belongs to the authenticated user through `cellar_inventory -> cellars.owner_id`.
- Insert canonical `ratings` row with:
  - `inventory_id`
  - `wine_reference_id` from inventory row
  - `score`
  - `tasting_notes`
  - `occasion`
  - `tasting_date`
- Insert matching `rating_signals` row from descriptors/buy-again/extraction.
- Still save the capture-only `tastings` row if we want evidence/capture trace continuity, but include `inventory_id` inside `tastings.extraction` because the `tastings` schema does not currently have an `inventory_id` column.
- Return Bottle Detail action using `/cellar/{inventory_id}?tasting={rating_id}`.

#### `add_to_cellar`

- Fetch default cellar for authenticated user.
- Insert `cellar_inventory` from captured identity:
  - `custom_name = label || title`
  - `custom_producer = producer`
  - `custom_vintage = vintage`
  - `custom_region = region`
  - `custom_wine_type = normalized wine_type`
  - `vintage = vintage`
  - `quantity = 1` by default
  - `notes` includes capture provenance
  - `tags = ['field-capture', is_benchmark ? 'benchmark' : 'tasting-memory']`
- Insert `ratings` + `rating_signals` against that new inventory row when score exists.
- Save capture-only `wines/tastings` as evidence memory if desired, with `inventory_id` in extraction.
- Return Bottle Detail action using `/cellar/{new_inventory_id}?tasting={rating_id}`.

## Schema boundary

F4 can be implemented without a remote migration if we put `inventory_id`, `rating_id`, and `save_mode` inside `tastings.extraction`.

A cleaner later migration would add:

```sql
alter table public.tastings add column if not exists inventory_id uuid references public.cellar_inventory(id) on delete set null;
alter table public.tastings add column if not exists rating_id uuid references public.ratings(id) on delete set null;
```

Recommendation for the next slice:

- avoid migration for now;
- make the UX and route behavior correct first;
- store cross-links in `tastings.extraction`;
- consider typed columns in a later hardening slice if downstream queries need them.

## TDD targets for implementation

Add tests before production code:

1. `buildFieldCaptureCellarPayload(...)`
   - maps captured Tapiz candidate to cellar inventory payload.
   - quantity defaults to 1.
   - tags include `field-capture` and benchmark/tasting signal.

2. `buildFieldCaptureRatingPayload(...)`
   - maps score/notes/descriptors to `ratings` insert shape.
   - uses existing `inventory_id` and `wine_reference_id` when linking.

3. `createPostSaveActions(...)`
   - when `inventory_id` exists, Bottle Detail href is `/cellar/{inventory_id}`.
   - when only `wine_id` exists, do not generate a broken `/cellar/{wine_id}` action.

4. `/api/field-capture/save` behavior with fake client or pure helper extraction:
   - `memory_only` keeps existing behavior.
   - `link_existing_inventory` validates ownership before insert.
   - `add_to_cellar` creates inventory then rating.

## Recommended next implementation slice

Smallest safe F4 implementation:

1. Fix post-save action generation so memory-only captures never link `/cellar/{wines.id}`.
2. Add `save_mode` + `inventory_id` to pure payload types/tests.
3. Implement `/capture?inventory_id=...` as `link_existing_inventory`.
4. Server validates inventory ownership and writes `ratings` + `rating_signals`.
5. Return Bottle Detail action with the correct `cellar_inventory.id`.
6. Browser smoke:
   - `/capture?demo=tapiz` still memory-only.
   - `/capture?inventory_id=<real proof inventory>` shows linked-cellar context.
7. Live proof with temporary user/inventory if safe, then cleanup.

## Open decisions

None block the next local slice.

Default decision:

- Keep `/capture` memory-only unless launched from an inventory context or Brian explicitly chooses “Add to cellar”.
- Use existing `ratings`/`rating_signals` for cellar-linked tasting memory.
- Do not add a migration until downstream querying needs typed `tastings.inventory_id` / `tastings.rating_id`.
