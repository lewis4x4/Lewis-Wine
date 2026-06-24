# Pourfolio Intelligence Layer

Pourfolio Intelligence turns Brian's wine moments into reusable decision memory: capture why a bottle mattered, mark 94+ wines as benchmarks, find more with sourced price evidence, refresh Brian's taste profile, and rank restaurant wine lists against that profile.

## Schema

All six new tables are additive, owner-scoped, and protected with RLS.

### `wines`

Canonical bottle identity.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `owner_id` | `uuid` | Required, references `auth.users(id)` |
| `producer` | `text` | Producer / estate |
| `label` | `text` | Required cuvee / label name |
| `vintage` | `integer` | Nullable; constrained `1800..2200` |
| `region` | `text` | Region |
| `subregion` | `text` | Subregion / vineyard detail |
| `country` | `text` | Country |
| `varietal` | `text` | Varietal or blend family |
| `wine_type` | `text` | `red`, `white`, `rose`, `sparkling`, `dessert`, `fortified` |
| `created_at` | `timestamptz` | Default `now()` |

Indexes:

- `idx_wines_owner(owner_id)`
- `idx_wines_dedupe(owner_id, lower(coalesce(producer,'')), vintage, lower(label))`

### `tastings`

A user's tasting memory for a wine.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | Required, references `auth.users(id)` |
| `wine_id` | `uuid` | Required, references `wines(id)` |
| `score` | `integer` | Nullable; constrained `50..100` |
| `buy_again` | `text` | `yes`, `no`, `maybe`, `cellar_only` |
| `occasion` | `text` | Context / life moment |
| `descriptors` | `text[]` | Taste descriptors, default empty array |
| `notes` | `text` | Brian's note |
| `is_benchmark` | `boolean generated` | Stored computed value: `score >= 94` |
| `evidence_path` | `text` | Private Storage path for bottle/list evidence |
| `extraction` | `jsonb` | Raw model/fixture extraction plus confidence |
| `tasted_at` | `timestamptz` | Default `now()` |
| `created_at` | `timestamptz` | Default `now()` |

Indexes:

- `idx_tastings_owner(owner_id, tasted_at desc)`
- `idx_tastings_wine(wine_id)`
- `idx_tastings_benchmark(owner_id, is_benchmark, score desc) where is_benchmark`

### `price_observations`

Sourced replacement-price / availability evidence. Unsourced prices are not allowed.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | Required, references `auth.users(id)` |
| `wine_id` | `uuid` | Required, references `wines(id)` |
| `source_name` | `text` | Required |
| `source_url` | `text` | Required non-empty URL/source link |
| `price` | `numeric(10,2)` | Required, `>= 0` |
| `currency` | `text` | Default `USD` |
| `availability` | `text` | `in_stock`, `limited`, `unknown`, `oos` |
| `confidence` | `numeric(3,2)` | Required `0..1` |
| `observed_at` | `timestamptz` | Default `now()` |
| `raw` | `jsonb` | Raw evidence payload |
| `created_at` | `timestamptz` | Default `now()` |

Indexes:

- `idx_price_observations_wine(owner_id, wine_id, observed_at desc)`
- `idx_price_observations_availability(owner_id, availability, confidence desc)`

### `buy_again_queue`

Action lane for benchmark bottles Brian should consider buying again.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | Required, references `auth.users(id)` |
| `wine_id` | `uuid` | Required, references `wines(id)` |
| `status` | `text` | `active`, `acquired`, `dismissed`; default `active` |
| `target_price` | `numeric(10,2)` | Optional target price |
| `best_observation_id` | `uuid` | Nullable FK to `price_observations(id)` |
| `added_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Default `now()` |

Constraints/indexes:

- Unique `(owner_id, wine_id)`
- `idx_buy_again_queue_owner_status(owner_id, status, updated_at desc)`

### `taste_profile`

Historical snapshots of Brian's computed taste profile. The most recent row by `refreshed_at` is active.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | Required, references `auth.users(id)` |
| `loved_descriptors` | `text[]` | Weighted 90+ tasting descriptors |
| `preferred_regions` | `text[]` | Weighted 90+ regions |
| `preferred_varietals` | `text[]` | Weighted 90+ varietals |
| `preferred_producers` | `text[]` | Weighted 94+ producers |
| `price_band` | `jsonb` | `{low, typical, high}` from observations |
| `avoid_list` | `text[]` | Low-score or `buy_again='no'` patterns |
| `benchmark_wine_ids` | `uuid[]` | Wines with 94+ tastings |
| `refreshed_at` | `timestamptz` | Default `now()` |

Index:

- `idx_taste_profile_owner_refreshed(owner_id, refreshed_at desc)`

### `wine_lists`

Persisted restaurant wine-list parse and ranked recommendation output.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | Required, references `auth.users(id)` |
| `evidence_path` | `text` | Optional private Storage path for list photo |
| `restaurant` | `text` | Optional restaurant name |
| `cuisine` | `text` | Optional cuisine/context signal |
| `context` | `text` | Optional Brian-facing occasion/context |
| `parsed` | `jsonb` | Parsed list line items |
| `recommendations` | `jsonb` | Ranked picks with Brian-Fit/reasons |
| `created_at` | `timestamptz` | Default `now()` |

Index:

- `idx_wine_lists_owner_created(owner_id, created_at desc)`

### Storage

Bucket: `wine-evidence`.

- Private bucket.
- Intended paths: `{owner_id}/bottles/...` and `{owner_id}/lists/...`.
- Storage policy requires the first path folder to equal `auth.uid()`.

## Edge function contracts

All LLM calls are server-side in Supabase Edge Functions. Browser code must never contain `ANTHROPIC_API_KEY`.

### `capture-wine`

Purpose: extract structured bottle identity from an image and enforce the one-question rule.

Request:

```json
{
  "image_base64": "base64-image-data",
  "media_type": "image/jpeg",
  "hint": "optional tasting note or label hint"
}
```

Response:

```json
{
  "candidate": {
    "producer": "Tapiz",
    "label": "Alta Collection Cabernet Sauvignon",
    "vintage": 2021,
    "region": "Mendoza",
    "subregion": "San Pablo Vineyard, Uco Valley",
    "country": "Argentina",
    "varietal": "Cabernet Sauvignon",
    "wine_type": "red",
    "confidence": {
      "producer": 0.95,
      "label": 0.9,
      "vintage": 0.92,
      "region": 0.86,
      "varietal": 0.94,
      "wine_type": 0.9
    },
    "ambiguous_fields": []
  },
  "matched_wine_id": null,
  "needs_follow_up": false,
  "follow_up_question": null
}
```

Rules:

- Live model: `claude-sonnet-4-6`.
- Fixture mode returns the Tapiz Cabernet fixture.
- `needs_follow_up=true` only when producer or vintage is missing/low-confidence (`< 0.6`).
- Only one follow-up question is ever returned.

### `find-more`

Purpose: find current sourced price/availability evidence for a benchmark wine and populate the Buy Again queue.

Request:

```json
{ "wine_id": "uuid-of-wines-row" }
```

Response:

```json
{
  "ok": true,
  "wine": {
    "id": "uuid-of-wines-row",
    "producer": "Tapiz",
    "label": "Alta Collection Cabernet Sauvignon",
    "vintage": 2021,
    "region": "Mendoza",
    "varietal": "Cabernet Sauvignon"
  },
  "observations": [
    {
      "source_name": "Wine.com fixture",
      "source_url": "https://www.wine.com/product/tapiz-alta-collection-cabernet-sauvignon-2021/fixture",
      "price": 38.99,
      "currency": "USD",
      "availability": "in_stock",
      "confidence": 0.86
    }
  ],
  "best_observation_id": "uuid-of-price-observation-row",
  "summary": "Fixture evidence found two sourced replacement-price signals; Wine.com fixture is the best in-stock price.",
  "searched_at": "2026-06-23T00:00:00.000Z"
}
```

Rules:

- Live model: `claude-sonnet-4-6` with Anthropic `web_search_20250305` tool.
- Every persisted observation must have `source_url` and `confidence`.
- Rows missing source URL or valid confidence are dropped.
- `best_observation_id` points to the lowest-price available observation, preferring `in_stock` / `limited` over unknown/OOS.

### `refresh-profile`

Purpose: recompute Brian's active taste profile from tastings and price observations.

Request:

```json
{}
```

Response:

```json
{
  "ok": true,
  "profile": {
    "id": "uuid-of-profile-row",
    "owner_id": "uuid-of-user",
    "loved_descriptors": ["smooth", "rich", "long finish"],
    "preferred_regions": ["Mendoza", "Napa Valley"],
    "preferred_varietals": ["Cabernet Sauvignon"],
    "preferred_producers": ["Tapiz", "Lewis Cellars"],
    "price_band": { "low": 60, "typical": 100, "high": 150 },
    "avoid_list": ["Miss Merlot"],
    "benchmark_wine_ids": ["uuid-of-benchmark-wine"],
    "refreshed_at": "2026-06-24T00:00:00.000Z"
  }
}
```

Profile refresh logic:

- `loved_descriptors`: descriptors from tastings scored `>= 90`, weighted by score.
- `preferred_regions`: wine regions from tastings scored `>= 90`, weighted by score.
- `preferred_varietals`: varietals from tastings scored `>= 90`, weighted by score.
- `preferred_producers`: producers from benchmark tastings scored `>= 94`, weighted by score.
- `price_band`: observed prices sorted into low / typical / high bands.
- `avoid_list`: patterns from low scores (`< 82`) or `buy_again='no'`.
- `benchmark_wine_ids`: all wines with tastings scored `>= 94`.
- Each refresh inserts a new profile row; history is retained.

### `advise-list`

Purpose: parse a restaurant wine-list image and return ranked picks for Brian.

Request:

```json
{
  "image_base64": "base64-image-data",
  "media_type": "image/jpeg",
  "restaurant": "optional restaurant name",
  "cuisine": "steakhouse",
  "context": "impressive but not silly"
}
```

Response:

```json
{
  "ok": true,
  "wine_list_id": "uuid-of-wine-list-row",
  "parsed": [
    {
      "producer": "Tapiz",
      "label": "Alta Collection Cabernet Sauvignon",
      "vintage": 2021,
      "varietal": "Cabernet Sauvignon",
      "region": "Mendoza",
      "price": 92,
      "descriptors": ["smooth", "rich"],
      "readiness": "drink_now",
      "value_flag": "great"
    }
  ],
  "recommendations": [
    {
      "line_item": {
        "producer": "Tapiz",
        "label": "Alta Collection Cabernet Sauvignon",
        "vintage": 2021,
        "varietal": "Cabernet Sauvignon",
        "region": "Mendoza",
        "price": 92
      },
      "brian_fit": 100,
      "tier": "pour",
      "reasons": [
        "Matches Brian's loved descriptors: smooth, rich.",
        "Region/varietal matches prior high-scoring bottles.",
        "Tapiz is a benchmark-linked producer."
      ],
      "readiness": "drink_now",
      "value_flag": "great",
      "cuisine_fit": 100
    }
  ]
}
```

Rules:

- Live OCR/list parse model: `claude-sonnet-4-6`.
- Recommendations are sorted by deterministic Brian-Fit score.
- Every recommendation must include at least one human-readable reason.
- Parsed list and recommendations are persisted to `wine_lists`.

## Brian-Fit formula

Brian-Fit is deterministic, 100 points total:

| Component | Weight | Logic |
|---|---:|---|
| Descriptor overlap | 40 | Matches between line-item descriptors and `taste_profile.loved_descriptors` |
| Region / varietal match | 25 | 12 points for preferred region, 13 for preferred varietal |
| Benchmark producer | 20 | Producer appears in `taste_profile.preferred_producers` |
| Value vs price band | 15 | Strong value inside/near proven `price_band.typical`; penalty above high band |

Tiering:

- `pour`: Brian-Fit `>= 72`
- `consider`: Brian-Fit `45..71`
- `skip`: Brian-Fit `< 45`

Hard rule:

- Any match against `taste_profile.avoid_list` is `tier='skip'`, Brian-Fit capped at `15`, and the reason must state the avoid-list match.

Readiness rule:

- `readiness='hold'` does not lower Brian-Fit. It adds a cellar/hold reason so Brian can buy for the cellar without being told to open it tonight.

## Secrets and fixture mode

### Live Anthropic secret

Set the Edge Function secret with:

```bash
supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
```

The key is read only by Edge Functions. It must not appear under `src/` or in client/browser code.

Verification:

```bash
grep -r "ANTHROPIC" src/ || true
```

Expected: no output.

### Fixture mode

Fixture mode avoids live LLM/web-search calls and returns deterministic test payloads:

```bash
export POURFOLIO_LLM_FIXTURE=1
```

When serving functions locally:

```bash
POURFOLIO_LLM_FIXTURE=1 supabase functions serve --env-file .env.local
```

For unauthenticated local fixture smokes, also set a valid owner id so service-role writes can create owner-scoped rows:

```bash
export POURFOLIO_FIXTURE_OWNER_ID=<auth.users.id>
```

## Run commands

App:

```bash
npm run dev
```

Quality gate:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Functions:

```bash
POURFOLIO_LLM_FIXTURE=1 supabase functions serve --env-file .env.local
```

Production function deploys, when desired:

```bash
supabase functions deploy capture-wine
supabase functions deploy find-more
supabase functions deploy refresh-profile
supabase functions deploy advise-list
```
