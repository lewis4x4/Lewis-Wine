# F8 Capture Release Acceptance Gate — 2026-06-25

## Objective

Close the `/capture` hardening roadmap with one release-style acceptance pass across the actual user journey:

1. `/capture` canonical entrypoint;
2. authenticated `POST /api/field-capture/save`;
3. F5 replay/idempotency path;
4. linked cellar `ratings` + `rating_signals`;
5. `/cellar/[id]` route availability for the linked inventory;
6. `/intelligence` command center surface;
7. Buy Again API / lane;
8. Acquisition Engine API / refresh lane;
9. cleanup of all temporary proof data.

## Roadmap status

| Slice | Status | Evidence |
|---|---:|---|
| F4 cellar/inventory integration | Complete | `docs/capture-f4-cellar-inventory-discovery-2026-06-25.md`, commit `18476c2` |
| F5 idempotency / retry hardening | Complete | `docs/capture-f5-idempotency-2026-06-25.md`, commit `30adc71` |
| F6 offline queue UX | Complete | `docs/capture-f6-offline-queue-2026-06-25.md`, commit `b883f1d` |
| F7 downstream proof | Complete | `docs/capture-f7-downstream-proof-2026-06-25.md`, commit `76e8591` |
| F8 release acceptance | Complete | this document |

## Acceptance proof

A temporary confirmed Supabase Auth user, cellar, and linked inventory were created. The proof then called the local authenticated Next.js API and exercised the full downstream chain.

Command run:

```bash
node .tmp-f8-acceptance-proof.mjs
```

Result:

```json
{
  "capturePage": true,
  "saveStatus": true,
  "replaySafe": true,
  "cellarRatingSignal": true,
  "tastingExtractionLinked": true,
  "cellarPage": true,
  "intelligencePage": true,
  "buyAgainQueue": true,
  "buyAgainApi": true,
  "acquisitionTarget": true,
  "acquisitionApi": true
}
```

Cleanup verification:

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

Notes:

- The `/cellar/[id]` acceptance was route/status plus DB/API linkage proof. The Bottle Detail page is a client-side React Query surface, so raw server HTML can include generic app-shell/not-found strings before hydration. The meaningful acceptance is that the linked inventory route returns `200` and the rating/signal/tasting rows are correctly attached to that exact inventory.
- The F8 proof script was temporary and must not be committed.

## Additional gates

Focused field-capture chain:

```bash
npm run test:field-capture
npm run test:field-reliability
npm run test:bottle-intelligence
npm run test:buy-again-command-center
npm run test:acquisition-engine
npm run typecheck
```

Full project gate:

```bash
npm run check
```

Browser smoke:

```text
/capture?demo=tapiz
```

Expected: canonical capture review surface renders; browser console has zero JavaScript errors.

## True remaining gaps

No release-blocking F4-F8 hardening gaps remain for the canonical `/capture` loop.

Non-blocking future polish:

1. **Hydrated Bottle Detail browser proof** — add a Playwright/authenticated browser smoke that waits for React Query data on `/cellar/[id]` instead of relying on raw server HTML.
2. **Offline queue automated browser test** — F6 has helper tests and browser smoke, but a headless localStorage retry workflow script would make the UX regression-proof.
3. **Evidence image UX polish** — evidence storage is safe and linked, but future UI can expose evidence thumbnails/review affordances on Bottle Detail.
4. **Acquisition price enrichment** — F7/F8 create watch targets; price evidence refresh remains intentionally downstream, not part of capture save.

## Release conclusion

The canonical `/capture` path is ready for continued product use: it can review a field capture, link it to cellar inventory, save tasting memory, survive replay/offline uncertainty, and feed downstream Buy Again / Acquisition Engine intelligence without leaking temporary proof data.
