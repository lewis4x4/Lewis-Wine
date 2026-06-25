# F7 Field Capture Downstream Proof — 2026-06-25

## Objective

Prove `/capture` is not merely reliable at save time. A linked, reviewed field capture should become useful everywhere downstream:

1. cellar rating memory;
2. `rating_signals` taste/decision evidence;
3. Bottle Intelligence memory/benchmark context;
4. Buy Again Command Center queue;
5. Acquisition Engine target / refresh lane.

## Implementation

### Pure downstream payloads

Extended `src/lib/field-capture.ts` with deterministic helpers:

- `buildFieldCaptureBuyAgainQueuePayload(...)`
- `buildFieldCaptureAcquisitionTargetPayload(...)`

Rules:

- only `buy_again: "yes"` captures create buying downstream work;
- benchmark / 94+ captures become `must_have` acquisition targets;
- must-have targets default to desired quantity `6`;
- downstream notes preserve field-capture provenance and score;
- non-buy-again captures do not create blind acquisition noise.

### API downstream writes

Extended `POST /api/field-capture/save`:

- existing linked cellar capture still writes `ratings` and `rating_signals`;
- buy-again captures now upsert `buy_again_queue` by `(owner_id, wine_id)`;
- then create/update `acquisition_watchlist` with `source_kind = 'buy_again'` and `source_id = buy_again_queue.id`;
- API response now includes:
  - `buy_again_queue: { id } | null`
  - `acquisition_target: { id } | null`
- replay responses also surface existing downstream handles.

Important implementation detail: the remote `acquisition_watchlist` uniqueness is a partial unique index, not a plain unique constraint, so Supabase `.upsert(... onConflict)` cannot target it. The route performs select-then-update/insert instead.

## Tests

Extended:

- `tests/field-capture.test.ts`
  - buy-again queue payload
  - acquisition target payload
  - non-buy-again skip behavior
- `tests/bottle-intelligence.test.ts`
  - field-capture rating payload feeds Bottle Intelligence memory density and self-benchmark dossier state

Focused checks passed:

```bash
npm run test:field-capture
npm run test:bottle-intelligence
npm run test:buy-again-command-center
npm run test:acquisition-engine
npm run typecheck
```

## Live proof

A temporary Supabase Auth user/cellar/inventory was created, then a normal authenticated request posted to:

```text
POST /api/field-capture/save
```

The proof verified:

```json
{
  "httpStatus": 200,
  "success": true,
  "ratingCreated": true,
  "signalCreated": true,
  "tastingLinked": true,
  "buyAgainQueued": true,
  "acquisitionTargeted": true,
  "buyAgainApiSeesQueue": true,
  "acquisitionApiSeesTarget": true,
  "bottlePageStatus": 200
}
```

Cleanup verified all temporary proof data removed:

```json
{
  "acquisition": 0,
  "queue": 0,
  "signal": 0,
  "rating": 0,
  "tasting": 0,
  "inventory": 0,
  "wine": 0,
  "cellar": 0,
  "profile": 0,
  "authUser": 0
}
```

## Acceptance notes

- F7 creates acquisition targets without price observations. That is intentional: Acquisition Engine places them into refresh/watch lanes until price evidence exists.
- This slice does not auto-buy, order, send messages, or create external actions.
- Temporary proof scripts/files must not be committed.
