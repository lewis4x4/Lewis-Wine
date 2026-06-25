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

Remaining known issue from initial F0 audit:

- Resolved in follow-up slice: the Tapiz demo now has a shareable, server-renderable URL (`/capture?demo=tapiz`) and the `Load Tapiz demo` control is an actual link to that route. Direct browser navigation to `/capture?demo=tapiz` renders the review state with `Tapiz`, `Alta Collection Cabernet Sauvignon`, and `Benchmark trigger` visible with zero console errors.

## Evidence Storage Local Slice — 2026-06-25

Completed locally after the demo-entry fix:

- Added `evidence_data_url` to the field-capture review/save payload as an optional, transient client-to-server field.
- Added `buildEvidenceUpload(...)` helper that:
  - accepts only JPEG, PNG, WebP, or GIF data URLs,
  - validates base64 data,
  - caps evidence at 8 MB,
  - builds private owner-scoped Storage paths under `wine-evidence/{owner_id}/bottles/{wine_id}/{token}.{ext}`.
- Updated `/api/field-capture/save` to upload photo evidence to the private `wine-evidence` bucket after wine identity resolution and before tasting insert.
- Updated tasting insert/select to include `evidence_path`.
- Confirmed raw base64 evidence is kept out of `tastings.extraction`.
- Updated the `/capture` client to send the selected image data URL only at save time.

Existing migration support already present:

- `supabase/migrations/00013_pourfolio_intelligence_sprint_a.sql` creates private bucket `wine-evidence`.
- The same migration defines Storage policy requiring first path segment to match `auth.uid()`.
- No new migration was required for local code because `public.tastings.evidence_path` already exists.

Local verification:

```bash
npm run test:field-capture
npm run typecheck
```

Unauthenticated API smoke with a valid evidence-bearing draft:

```bash
POST /api/field-capture/save -> 401 Unauthorized
```

This proves validation accepts the evidence-bearing shape and auth still blocks writes before any Storage or database side effect.

Browser proof:

- `/capture?demo=tapiz` still renders review state with `Tapiz`, `Alta Collection Cabernet Sauvignon`, and `Benchmark trigger`.
- Console: zero JavaScript errors.

## Live Authenticated Evidence Proof — 2026-06-25

Completed after the local evidence-storage commit:

- Created a temporary confirmed Supabase Auth proof user.
- Signed in with the public anon auth flow to obtain a normal user session.
- Called the local Next.js `POST /api/field-capture/save` endpoint with the same Supabase SSR auth-cookie shape used by the app.
- Submitted a valid evidence-bearing field-capture draft.
- Verified API success: `200` with `success: true`.
- Verified the returned `evidence_path` was owner/wine scoped under:
  - `wine-evidence/{auth_user_id}/bottles/{wine_id}/{uuid}.jpg`
- Verified the object existed in the remote private `wine-evidence` bucket.
- Verified the remote `tastings` row stored the same `evidence_path`.
- Verified raw base64 evidence was not present in `tastings.extraction`.
- Cleaned up the temporary proof user, proof wine, proof tasting, and proof Storage object.

Cleanup verification:

```json
{
  "wineRowsRemaining": 0,
  "tastingRowsRemaining": 0,
  "evidenceObjectRemaining": false,
  "proofUserRemaining": false,
  "errors": []
}
```

No new migration or deploy was required; existing `00013` schema/bucket/RLS supported the proof.

## Next Actions

- Push the three local commits if Brian wants this checkpoint published.
- Continue to the next roadmap slice: follow-up UX for ambiguous labels, or inventory/cellar integration.
