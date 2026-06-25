# F6 Field Capture Offline Queue — 2026-06-25

## Objective

Make reviewed `/capture` saves resilient when mobile connectivity drops or the save path returns uncertain retryable failures. A reviewed field capture should not vanish, and retries must preserve the same F5 idempotency key so sync cannot duplicate tastings, cellar ratings, rating signals, or evidence writes.

## Implementation

### Pure queue helpers

Added:

```text
src/lib/offline-field-capture-drafts.ts
src/lib/field-capture-sync.ts
```

`offline-field-capture-drafts.ts` stores localStorage-compatible drafts under:

```text
pourfolio:offline-field-capture-drafts:v1
```

Each draft preserves:

- `id`
- `idempotencyKey`
- full `/api/field-capture/save` payload
- `evidence_data_url` when available
- status: `queued`, `syncing`, or `failed`
- attempts / last error

The queue caps to 20 drafts and removes the localStorage key when empty.

### Retry classification

`field-capture-sync.ts` mirrors the proven voice-capture pattern:

- queue when offline;
- queue on unknown/network failure;
- queue on HTTP `0`;
- queue on `5xx`;
- do **not** queue `4xx` / `422` review, auth, or validation failures.

That keeps user-correctable failures out of blind retry loops.

### Capture UI

`FieldCaptureExperience` now:

- tracks online/offline state;
- shows an offline field-capture queue beneath the save button;
- queues the reviewed draft immediately if the user is offline;
- queues retryable save failures while preserving the idempotency key;
- supports retry one, sync all, and delete;
- sends the stored payload back to `/api/field-capture/save` on retry.

Because F5 already made `/api/field-capture/save` replay-safe, queued retries can safely recover from uncertain saves where the first request may have reached the server.

## Tests

Extended `tests/field-reliability.test.ts` to prove:

- offline field-capture drafts serialize and read back;
- the F5 idempotency key is preserved;
- evidence is preserved in the save payload but not leaked into extraction JSON;
- syncing/failed state transitions preserve retry identity;
- delete/drain behaviour works;
- retry classification queues only offline/unknown/5xx failures.

Focused and full checks passed:

```bash
npm run test:field-reliability
npm run test:field-capture
npm run typecheck
npm run lint
git diff --check
npm run check
```

Browser smoke passed on `/capture?demo=tapiz`:

- review form renders;
- offline field queue empty state renders below the save button;
- browser console errors: `0`.

## Acceptance notes

- This slice does not add an edit form for queued field captures. A field-capture draft has already passed review; the safe minimum is retry/delete. If a user-correctable 4xx/422 occurs, the draft stays on the active review screen rather than going into blind retry.
- The queue is local to the browser/device, as expected for field/mobile resilience.
- No credentials, auth tokens, or service keys are stored in the queue.
