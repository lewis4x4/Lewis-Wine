# Pourfolio Capture Acceptance Audit — 2026-06-25

Created by: Jarvis (Hermes Agent)
Date: 2026-06-25 10:31 EDT
Related project: Pourfolio / Lewis-Wine
Status: Draft execution record

## Summary

F0 acceptance audit was run before hardening the first roadmap slice. The existing `/capture` route is present, returns HTTP 200, and focused tests pass. The browser-rendered route shows the expected mobile field-capture page, but the browser automation click on `Load Tapiz demo` did not advance the React state during this audit, so this remains a targeted live-UX item to recheck after the slice changes and full gate.

## Commands Run

```bash
npm run test:field-capture
npm run test:voice-capture
npm run test:field-reliability
npm run typecheck
npm run lint
git diff --check
```

Result: all passed.

```bash
curl -s -I http://127.0.0.1:3000/capture
```

Result: HTTP 200.

```bash
curl -s -o /tmp/field-capture-save.json -w '%{http_code}\n' \
  -X POST http://127.0.0.1:3000/api/field-capture/save \
  -H 'content-type: application/json' \
  --data '{}'
```

Result: HTTP 400 with validation errors; no fake private data or write path was exposed.

## Browser Proof

Route: `http://127.0.0.1:3000/capture`

Visible text confirmed:

- `Capture the wine while the moment is still alive.`
- `Bottle photo → structured identity → editable tasting memory`
- `Load Tapiz demo`
- `Capture or load a bottle to begin.`

Console after initial load/click attempts: zero JavaScript errors.

## Gaps Confirmed

1. `/capture` needs a successful interactive state-advance proof after the hardening slice.
2. `POST /api/field-capture/save` previously inserted a new `wines` row every save; F2 addresses this with identity matching/reuse.
3. `/intelligence` included a separate demo-like `GreatWineCapture` surface; F6 replaces it with a canonical `/capture` command card.

## F0/F6/F2 Execution Results

Completed in this slice:

- Added canonical capture roadmap: `.hermes/plans/2026-06-25_103146-wine-capture-roadmap.md`.
- Replaced the old demo-like `/intelligence` `GreatWineCapture` panel with `CaptureCommandCard`, which routes users to canonical `/capture`.
- Added `buildWineIdentityKey` and test coverage for normalized producer/vintage/label identity.
- Updated `POST /api/field-capture/save` to look up existing `wines` rows for the authenticated owner and reuse matching identity before inserting.
- Added `reused_wine` to the save API response.

Post-change verification:

```bash
npm run check
```

Result: passed, including full production `next build`.

Browser proof after F6:

- `/intelligence` renders `Canonical capture path` and `Open Capture`.
- Old demo text/buttons are no longer present:
  - `Great Wine Capture`
  - `Save tasting memory`
- Console: zero JavaScript errors.

Remaining known issue:

- In browser automation, `/capture` still rendered correctly but the `Load Tapiz demo` click did not advance the page state. This may be an automation/hydration-specific issue, but it should be treated as an explicit next-slice acceptance item before declaring the full capture loop field-ready.

## Next Actions

- Investigate and fix/prove `/capture` interactive state advancement.
- Continue to evidence storage and live authenticated save proof after the interaction gate is green.
