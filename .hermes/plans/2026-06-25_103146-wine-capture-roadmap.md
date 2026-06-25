# Pourfolio Wine Capture Roadmap Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Pourfolio wine capture from a working D1 feature into a fully reliable, premium, field-ready capture loop: photo/voice/receipt/manual input → reviewed memory → cellar/inventory truth → benchmark/taste/acquisition/replenishment actions → verified live operation.

**Architecture:** Keep the capture path human-reviewed and source-backed. Client surfaces collect evidence and review inputs; Supabase Edge Functions do live AI extraction; Next.js API routes authenticate and persist normalized records; downstream intelligence services consume the same canonical `wines`, `tastings`, `cellar_inventory`, price, acquisition, and replenishment data. Do not create more isolated demo panels; collapse capture into one coherent field workflow.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase Auth/Postgres/Storage/Edge Functions, Anthropic via Supabase Edge Functions, `tsx` tests, Tailwind/Radix UI.

---

## 0. Current Verified State — 2026-06-25 10:31 EDT

### Repo / deployment state

- Project path: `/Users/brianlewis/.openclaw/workspace-c3po-chief-of-staff/projects/Lewis-Wine`
- Git state: clean, `main...origin/main`
- Latest commit: `bf5687d Add replenishment automation`
- Remote migrations: local and remote are synced through `00020`.
- Active remote Supabase Edge Functions:
  - `capture-wine` ACTIVE v4
  - `find-more` ACTIVE v10
  - `refresh-profile` ACTIVE v5
  - `advise-list` ACTIVE v7

### Existing capture surfaces

| Surface | Status | Files |
|---|---:|---|
| Mobile field capture | Built | `src/app/(dashboard)/capture/page.tsx`, `src/components/wine/field-capture-experience.tsx`, `src/lib/field-capture.ts`, `src/app/api/field-capture/save/route.ts`, `tests/field-capture.test.ts` |
| Great Wine Capture intelligence demo | Built, but still demo-like | `src/components/wine/great-wine-capture.tsx`, mounted in `/intelligence` |
| Voice tasting capture | Built from earlier sprint | `src/lib/voice-tasting-capture.ts`, `src/components/jarvis/voice-tasting-capture.tsx`, `tests/voice-tasting-capture.test.ts` |
| Receipt capture | Built | `src/components/wine/acquisition-receipt-panel.tsx`, `src/app/api/acquisition-receipts/route.ts`, `supabase/migrations/00019_acquisition_receipt_capture.sql` |
| Downstream actions | Built | Bottle dossier, Buy Again, Acquisition Engine, Shopping Mode, Replenishment |

### What the current `/capture` flow does

- Accepts mobile bottle photo input with `capture="environment"`.
- Converts the image to a data URL and calls Supabase Edge Function `capture-wine`.
- Builds a human-review draft.
- Captures score, buy-again intent, occasion, descriptors, and notes.
- Marks `score >= 94` as benchmark.
- Saves via authenticated `POST /api/field-capture/save`.
- Inserts into `wines` and `tastings`.
- Routes post-save to Find More, Buy Again, Bottle Intelligence, or Capture Another.

### Key gaps found

1. **No fresh post-E5 acceptance smoke has been run for `/capture`.** Later phases touched `/intelligence` heavily; `/capture` needs a current browser/API proof.
2. **Image evidence is not yet preserved in Storage from the field flow.** Schema/docs mention `evidence_path`; the current API does not persist the uploaded label image or `evidence_path`.
3. **Save path inserts a new `wines` row every time.** There is an index for dedupe, but no explicit match/upsert/reuse behaviour in `src/app/api/field-capture/save/route.ts`.
4. **Capture does not yet link saved tastings to `cellar_inventory` or `wine_reference`.** That limits cellar truth, replenishment, and inventory continuity.
5. **Follow-up questions from `capture-wine` are returned but not surfaced in the field UI.** The client only consumes `data.candidate`.
6. **`GreatWineCapture` on `/intelligence` is still a fixture/demo-oriented component.** It has a “Save tasting memory” button with no persistence handler and can confuse the canonical capture story.
7. **Offline/retry/idempotency for field capture is not wired into this specific photo flow.** Existing voice/offline idempotency patterns should be reused.
8. **Live authenticated save smoke with a real user is still the missing confidence gate.** We know schema/functions are deployed; we have not just now proven end-to-end photo/demo → save → downstream rows.

---

## `/goal` Command

Use this exact goal if starting a fresh Hermes session:

```text
/goal Create and execute a comprehensive Pourfolio wine capture hardening roadmap. Work in /Users/brianlewis/.openclaw/workspace-c3po-chief-of-staff/projects/Lewis-Wine. Start from the saved plan .hermes/plans/2026-06-25_103146-wine-capture-roadmap.md. Treat /capture as the canonical field capture route. Do not edit protected Obsidian/OpenClaw memory. Do not push or deploy unless I explicitly approve or the current task clearly includes it. First verify the existing /capture flow, then close gaps in order: evidence storage, dedupe/linking, follow-up UX, inventory/cellar integration, offline/idempotency, GreatWineCapture consolidation, downstream signal proof, docs, full gates, and final acceptance. Use TDD. Run quality gates before claiming completion. Pause before remote schema changes, production deploys, destructive deletes, or external communications.
```

---

## Roadmap Summary

| Phase | Name | Outcome | Risk |
|---|---|---|---:|
| F0 | Current acceptance audit | Know exactly what works today | Low |
| F1 | Evidence preservation | Label photo is stored and attached to tasting | Medium: Storage/RLS |
| F2 | Dedupe and identity linking | Capture reuses canonical wine identity | Medium: data correctness |
| F3 | Follow-up and review UX | Ambiguous labels get one useful question, not bad saves | Low |
| F4 | Cellar/inventory integration | Captured wines can become cellar truth | Medium: schema/use-flow |
| F5 | Offline/idempotent field capture | Repeated saves/retries do not duplicate tastings | Medium |
| F6 | Unify capture surfaces | `/capture` becomes canonical; demo panel stops confusing users | Low |
| F7 | Downstream signal proof | Capture drives Bottle Brain, Taste Genome, Buy Again, Replenishment | Medium |
| F8 | Live release gate | Prove it on real auth/user/function path | Medium |
| F9 | Polish and docs | A premium field capture product, not just a feature | Low |

---

## Phase F0 — Current Acceptance Audit

**Objective:** Establish a fresh, post-E5 truth snapshot before changing code.

**Files:**
- Read: `src/components/wine/field-capture-experience.tsx`
- Read: `src/app/api/field-capture/save/route.ts`
- Read: `supabase/functions/capture-wine/index.ts`
- Read: `tests/field-capture.test.ts`
- Create: `docs/capture-acceptance-2026-06-25.md`

### Task F0.1: Run current focused tests

Run:

```bash
npm run test:field-capture
npm run test:voice-capture
npm run test:field-reliability
npm run typecheck
npm run lint
git diff --check
```

Expected:
- All pass.
- If a test fails, stop and classify as regression vs stale expectation.

### Task F0.2: Browser smoke `/capture`

Run dev server:

```bash
npm run dev
```

Browser checks:
- Open `http://127.0.0.1:3000/capture`.
- Verify hero text: `Capture the wine while the moment is still alive.`
- Click `Load Tapiz demo`.
- Verify review fields appear: `Tapiz`, `Alta Collection Cabernet Sauvignon`, `Benchmark trigger`.
- Verify console has zero JS errors.

### Task F0.3: API smoke unauthenticated save

Run:

```bash
curl -s -o /tmp/field-capture-save.json -w '%{http_code}\n' \
  -X POST http://127.0.0.1:3000/api/field-capture/save \
  -H 'content-type: application/json' \
  --data '{}'
```

Expected:
- `400` for invalid body or `401` for valid unauthenticated body.
- No fake private data.

### Task F0.4: Write current acceptance note

Create `docs/capture-acceptance-2026-06-25.md` with:

- Date/time
- Commands run
- Browser proof
- Known failures/gaps
- Next recommended phase

Commit only if Brian asks for code/doc commit in this phase.

---

## Phase F1 — Store Label Evidence Properly

**Objective:** Preserve uploaded bottle/photo evidence in private Supabase Storage and attach it to the saved tasting.

**Files:**
- Modify: `src/lib/field-capture.ts`
- Modify: `src/components/wine/field-capture-experience.tsx`
- Modify: `src/app/api/field-capture/save/route.ts`
- Test: `tests/field-capture.test.ts`
- Maybe modify: `supabase/migrations/00013_pourfolio_intelligence_sprint_a.sql` only for docs/reference; prefer new migration if schema needs change.

### Task F1.1: Add evidence fields to review/save payload tests

Add tests proving:

- Review draft may include `evidence_data_url` or an `evidence_upload_token` equivalent.
- Save payload includes `evidence_path` only after server upload.
- Raw image data is not stored inside `tastings.extraction`.

Expected RED:

```bash
npm run test:field-capture
# FAIL: evidence field not present / not handled
```

### Task F1.2: Add client-side evidence handoff

In `FieldCaptureExperience`:

- Keep the selected data URL in state.
- Include evidence with the draft POST in a bounded form.
- Enforce client-side max size before send.

Acceptance:
- Oversized image shows a clear toast.
- Normal image/demo path still works.

### Task F1.3: Upload to private Storage server-side

In `src/app/api/field-capture/save/route.ts`:

- Authenticate user first.
- Upload evidence to bucket `wine-evidence` under:
  - `${user.id}/bottles/${wine.id}/${tasting_id or timestamp}.jpg`
- Insert `tastings.evidence_path`.
- Do not store base64 in database JSON.

Verification query:

```bash
supabase db query --linked "select evidence_path from public.tastings where owner_id = auth.uid() order by created_at desc limit 1;"
```

Use authenticated/client-safe proof for actual row inspection; do not print secrets.

### Task F1.4: Storage RLS proof

Verify private bucket and policies:

```bash
supabase db query --linked "select id, public from storage.buckets where id='wine-evidence';"
supabase db query --linked "select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname ilike '%wine%';"
```

Expected:
- `wine-evidence` exists.
- `public = false`.
- Policies restrict owner path.

---

## Phase F2 — Dedupe and Canonical Wine Identity

**Objective:** Avoid creating duplicate `wines` rows for repeated captures of the same bottle.

**Files:**
- Modify: `src/lib/field-capture.ts`
- Modify: `src/app/api/field-capture/save/route.ts`
- Test: create `tests/field-capture-dedupe.test.ts` or expand `tests/field-capture.test.ts`

### Task F2.1: Define identity key helper

Add pure helper:

```ts
export function buildWineIdentityKey(input: Pick<CaptureWineCandidate, "producer" | "label" | "vintage">) {
  return [input.producer, input.vintage, input.label]
    .map((value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}
```

Tests:
- Normalizes whitespace/case.
- Distinguishes vintages.
- Handles null producer safely.

### Task F2.2: Server-side lookup before insert

In `POST /api/field-capture/save`:

1. Query `wines` by owner, producer, label, vintage.
2. If found, reuse existing `wine.id`.
3. If not found, insert.
4. Return `{ reused_wine: true|false }`.

Acceptance:
- Repeated Tapiz demo save creates one wine row and multiple tastings.
- API response tells the UI whether it reused a wine.

### Task F2.3: Optional unique constraint hardening

If needed, add a new migration:

```sql
create unique index if not exists idx_wines_owner_identity_unique
on public.wines(owner_id, lower(coalesce(producer, '')), vintage, lower(coalesce(label, '')));
```

Pause before applying remote schema change.

---

## Phase F3 — Follow-Up UX for Ambiguous Labels

**Objective:** Surface the Edge Function’s one-question follow-up instead of silently moving ambiguous labels into review.

**Files:**
- Modify: `src/components/wine/field-capture-experience.tsx`
- Modify: `src/lib/field-capture.ts`
- Test: `tests/field-capture.test.ts`
- Maybe test Edge function with direct Deno smoke.

### Task F3.1: Add capture response type

Add:

```ts
export type CaptureWineResponse = {
  candidate: CaptureWineCandidate;
  matched_wine_id: string | null;
  needs_follow_up: boolean;
  follow_up_question: string | null;
};
```

Test that response with missing producer/vintage leads to follow-up state.

### Task F3.2: Add UI stage `follow_up`

Change:

```ts
type Stage = "photo" | "follow_up" | "review" | "saving" | "done";
```

UX:
- If `needs_follow_up`, display the question.
- Let Brian answer once.
- Reinvoke `capture-wine` with `hint` including the answer.
- Never ask a chain of multiple questions.

Acceptance:
- Ambiguous producer asks: “Who is the producer on this bottle?”
- Answer routes back to review.

### Task F3.3: Add confidence-first review copy

If confidence is medium/low:
- show “Review carefully” warning
- highlight ambiguous fields
- prevent save only when identity is too incomplete to be useful

---

## Phase F4 — Cellar / Inventory Integration

**Objective:** Let a capture become not just a tasting memory, but optionally a cellar/inventory record or a tasting on an existing inventory bottle.

**Files:**
- Modify: `src/lib/field-capture.ts`
- Modify: `src/components/wine/field-capture-experience.tsx`
- Modify: `src/app/api/field-capture/save/route.ts`
- Read/reuse: `src/lib/hooks/use-cellar.ts`
- Test: `tests/field-capture.test.ts`

### Task F4.1: Add save mode to draft

Add:

```ts
export type FieldCaptureSaveMode = "memory_only" | "add_to_cellar" | "link_existing_inventory";
```

UI choices:
- “Just remember this tasting”
- “Add bottle to cellar”
- “Link to existing cellar bottle”

Default:
- `memory_only` unless launched from `/cellar/[id]` or `inventory_id` query param.

### Task F4.2: Support `/capture?inventory_id=...`

When opened from Bottle Intelligence action:
- Preselect linked inventory record.
- Save tasting against that context.
- Do not create a duplicate wine identity if inventory is already known.

### Task F4.3: Add optional inventory insert

For `add_to_cellar`:
- Require cellar selection if multiple cellars exist.
- Insert into `cellar_inventory` with custom fields or linked `wine_reference_id` where possible.
- Set quantity default to 1.
- Preserve location/price if provided.

Pause before any schema change. This may be implementable with existing schema.

---

## Phase F5 — Offline and Idempotent Field Capture

**Objective:** Make field capture safe in restaurants, shops, and weak-network settings.

**Files:**
- Reuse: `references/voice-offline-idempotency.md`
- Modify: `src/lib/field-capture.ts`
- Modify: `src/components/wine/field-capture-experience.tsx`
- Modify: `src/app/api/field-capture/save/route.ts`
- Test: `tests/field-capture.test.ts`
- Maybe migration: new idempotency column/index for `tastings` or separate draft table.

### Task F5.1: Add client capture ID

Each capture gets a stable UUID:

```ts
client_capture_id: string
```

Rules:
- Generated before first save attempt.
- Stored with offline draft.
- Reused on retry.

### Task F5.2: Add idempotent save behaviour

Server should:
- If same `owner_id + client_capture_id` exists, return existing saved tasting.
- Not recompute dependent signals on replay.
- Not insert duplicate wine/tasting rows.

Likely migration:

```sql
alter table public.tastings add column if not exists client_capture_id text;
create unique index if not exists idx_tastings_owner_client_capture_id
on public.tastings(owner_id, client_capture_id)
where client_capture_id is not null;
```

Pause for remote migration approval.

### Task F5.3: Offline draft queue UI

Add localStorage-backed drafts:
- photo metadata / compressed evidence reference
- candidate
- review fields
- retry/delete/edit controls

Acceptance:
- If save fails with retryable network error, draft remains visible.
- 4xx validation error stays in review, not blind retry.

---

## Phase F6 — Unify Capture Surfaces

**Objective:** Remove confusion between real `/capture` and the demo-like `GreatWineCapture` panel.

**Files:**
- Modify: `src/app/(dashboard)/intelligence/page.tsx`
- Modify or delete: `src/components/wine/great-wine-capture.tsx`
- Modify: navigation components if needed
- Test: browser smoke `/intelligence` and `/capture`

### Task F6.1: Decide canonical surface rule

Rule:
- `/capture` is canonical for bottle/photo/tasting capture.
- `/intelligence` should show capture summary + CTA, not a separate fake save form.

### Task F6.2: Replace `GreatWineCapture` with real CTA/status card

Options:
1. Remove `GreatWineCapture` and add a `CaptureCommandCard` that links to `/capture`.
2. Or change `GreatWineCapture` to embed the real `FieldCaptureExperience` in compact mode.

Recommendation: **Option 1** — keep `/intelligence` as command center, not a second capture app.

Acceptance:
- No non-functional “Save tasting memory” button remains.
- `/intelligence` still explains the capture loop elegantly.

---

## Phase F7 — Prove Capture Drives Downstream Intelligence

**Objective:** Verify one saved benchmark actually updates the product loop: Bottle Brain, Taste Genome, Buy Again, Acquisition, Replenishment.

**Files:**
- Tests may be new integration-style scripts under `scripts/` or `tests/`
- Read/use:
  - `src/app/api/buy-again/route.ts`
  - `src/app/api/acquisition-engine/route.ts`
  - `src/app/api/replenishment/route.ts`
  - `supabase/functions/find-more/index.ts`
  - `supabase/functions/refresh-profile/index.ts`

### Task F7.1: Create capture-loop fixture smoke script

Create:

```text
scripts/smoke-capture-loop.ts
```

It should run against a real authenticated test user only when env is present:
- insert/save a Tapiz-style capture through the API or direct server helper
- call/verify `find-more`
- call/verify `refresh-profile`
- verify buy-again queue target
- verify replenishment sees relevant signal when applicable

### Task F7.2: Verify Bottle Brain link

From post-save action:
- open `/cellar/{wine_id}?tasting={tasting_id}` or the correct bottle detail route
- confirm bottle intelligence page renders the tasting memory

If route expects inventory ID, fix post-save link. This is a likely issue: current `createPostSaveActions` links `/cellar/${wine_id}`, but the existing cellar route may be inventory-focused rather than `wines`-table focused.

### Task F7.3: Verify Taste Genome refresh

After a 94+ capture:
- run `refresh-profile`
- verify preferred producer/varietal/benchmark IDs include the capture
- confirm `/intelligence#taste-genome` displays updated profile

---

## Phase F8 — Live Release Gate

**Objective:** Prove the full capture flow on live function/auth/schema without weakening production security.

### Required gates

Run:

```bash
npm run test:field-capture
npm run test:voice-capture
npm run test:field-reliability
npm run test:p0-security
npm run db:migrations:check
npm run typecheck
npm run lint
npm run check
git diff --check
```

Remote proof:

```bash
supabase migration list
supabase functions list
```

Browser proof:
- `/capture`
- `/intelligence`
- `/shopping`
- one Bottle detail page

Security proof:
- No `--no-verify-jwt` function deploy posture remains.
- No fixture owner secret left set unless intentionally used for local-only smoke.
- Unauthenticated API save returns 401/400, never writes data.
- Private Storage path cannot be publicly read.

### Stop conditions

Pause if:
- new remote migration is needed
- Edge Function deploy is needed
- real user auth/session is unavailable
- clearing `.next` or other destructive local cache is needed and approval prompt blocks it

---

## Phase F9 — Premium UX Polish

**Objective:** Make capture feel like a luxury tool in the moment, not a form.

### UX improvements

1. **Moment-first copy**
   - Replace generic form labels with wine-memory language.
   - Example: “What should future Brian remember?” is good; extend this tone.

2. **Fast score input**
   - Add chips: `Loved it`, `Benchmark`, `Good`, `Pass` mapping to score/buy-again defaults.

3. **Context presets**
   - Dinner, shop tasting, travel, gift, cellar pull, restaurant.

4. **Pairing memory**
   - Optional meal/food field.

5. **Companion memory**
   - Optional “who were you with?” field.

6. **Immediate next best action**
   - If benchmark + buy-again yes: primary CTA should be “Find more now”.
   - If cellar linked: primary CTA should be “Open bottle intelligence”.
   - If uncertain capture: primary CTA should be “Finish identity”.

7. **Evidence confidence display**
   - Show producer/vintage confidence visually.
   - Highlight fields below 0.6.

8. **Receipt crossover**
   - If capture is from a bottle just purchased, offer “Attach to receipt/acquisition”.

---

## Implementation Order Recommendation

Do not start with polish. Ship in this order:

1. **F0 Acceptance Audit** — prove current state.
2. **F6 Unify Capture Surfaces** — remove demo confusion early.
3. **F2 Dedupe** — protect data quality before more live saves.
4. **F3 Follow-Up UX** — improve capture correctness.
5. **F1 Evidence Storage** — preserve label proof.
6. **F4 Inventory Integration** — bridge memory and cellar truth.
7. **F5 Offline/Idempotency** — make it field-safe.
8. **F7 Downstream Proof** — prove product loop.
9. **F8 Live Gate** — certify release state.
10. **F9 Premium Polish** — make it feel world-class.

Rationale:
- Dedupe and canonical surface work prevent compounding bad data.
- Evidence storage and inventory integration become more valuable once identity is stable.
- Offline/idempotency matters most once live save is trusted.

---

## Risks and Decisions Needed

### Decision 1: Is `/capture` memory-only or inventory-first?

Recommendation:
- Default to memory-only for restaurant/shop tastings.
- Offer explicit “Add to cellar” when Brian owns or bought the bottle.

### Decision 2: Should `wines` remain separate from `wine_reference`?

Recommendation:
- Yes for now. Treat `wines` as Brian’s captured personal wine memory and `wine_reference` as canonical/library record. Add linking later, do not force it prematurely.

### Decision 3: What is the canonical Bottle Detail route?

Concern:
- Current post-save action links `/cellar/${wine_id}`.
- Existing route likely expects a cellar inventory ID, not a `wines.id` from intelligence schema.

Recommendation:
- Verify in F7.
- If mismatch exists, add a proper captured-wine detail route or link captured wine to inventory before routing.

### Decision 4: Store raw image or derived evidence only?

Recommendation:
- Store compressed/private label image in `wine-evidence` bucket.
- Store only path + extraction metadata in DB.
- Never store base64 image blobs in `tastings.extraction`.

---

## Definition of Done

Wine capture should not be called “complete” until:

- `/capture` passes browser smoke with no console errors.
- `capture-wine` live function is active and protected.
- Field save is authenticated, validated, idempotent, and deduped.
- Label evidence is stored privately and linked by `evidence_path`.
- Ambiguous labels produce a useful follow-up question.
- Saved capture can reuse or create canonical identity intentionally.
- Post-save links route to real pages with the right IDs.
- A 94+ capture updates or can trigger downstream Find More / Buy Again / Taste Genome surfaces.
- Full quality gate passes.
- Docs and this roadmap are updated with final truth.

---

## Recommended First Execution Slice

Start with this small, high-confidence slice:

```text
F0 + F6 + F2
```

Why:
- F0 proves reality.
- F6 removes user confusion.
- F2 prevents duplicate wine memory before live usage increases.

Expected first commit series:

```bash
git commit -m "docs: add wine capture roadmap"
git commit -m "test: cover field capture identity dedupe"
git commit -m "feat: reuse existing captured wine identity"
git commit -m "refactor: make capture route the canonical field surface"
```

Do not push until Brian asks or the execution request explicitly includes push.
