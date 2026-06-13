# Current Intelligence Layer Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a low-cost, source-backed current wine intelligence system for Pourfolio: select a bottle, refresh current information with AI/search/manual/import evidence, review the findings, and apply only trusted updates without paid API dependency.

**Architecture:** Add an evidence-first data layer under Bottle Dominance. Store raw/normalized observations separately from cellar truth, derive valuation/readiness suggestions deterministically, and keep AI/public-search output review-only until Brian applies it. Paid providers remain optional adapters that feed the same evidence model later.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase/Postgres/RLS, Anthropic SDK, existing Bottle Dominance engine, existing `npm run check` quality gate.

---

## Product Principles

1. **Evidence before truth:** found facts become evidence records; applied cellar fields change only after user approval.
2. **Unknown ≠ zero:** missing pricing remains Unknown, never `$0`.
3. **Retail ≠ market:** retailer listings default to replacement price, not market value.
4. **AI can infer, not certify:** AI-derived fields are visibly labelled `ai_inferred` unless backed by a specific source.
5. **Personal-app economics:** no required $1k+/year APIs. CellarTracker/WMJ/import/manual/public evidence first; Wine-Searcher only as optional trial/provider later.
6. **Brian-Fit action layer:** evidence should support decisions — open, hold, replace, gift, insure, sell — not just populate fields.

---

## End State UX

On Bottle Detail:

- **Dominate this bottle** remains the high-level dossier button.
- Add **Refresh intelligence** button with scopes:
  - Quick refresh: identity + pricing gaps
  - Pricing only
  - Readiness only
  - Deep research
  - Replacement search
- Add **Price evidence** panel:
  - Market value
  - Replacement price
  - Auction comps
  - Manual values
  - Staleness
  - Source receipts
- Add **Evidence drawer**:
  - source title/url
  - observed date
  - extracted facts
  - confidence
  - why accepted/rejected
- Add **Evidence inbox** for batch review later.

---

## Data Model

### New migration

Create: `supabase/migrations/00012_current_intelligence_layer.sql`

Tables:

1. `wine_intelligence_evidence`
   - generic source receipts and extracted facts.
2. `wine_price_observations`
   - structured price observations derived from manual entry, import, retailer/public search, CellarTracker, WMJ, etc.
3. `wine_intelligence_refreshes`
   - audit/cost-control log for each refresh request.
4. Optional later: `wine_evidence_review_queue`
   - can be deferred if the first UI reviews inline.

Enums/check fields should include:

- `source_type`: `manual`, `cellartracker`, `wine_market_journal`, `retailer`, `winery`, `auction`, `public_web`, `ai_search`, `wine_searcher_trial`, `provider`, `unknown`
- `truth_label`: `verified`, `estimated`, `ai_inferred`, `unknown`, `stale`, `rejected`
- `observation_kind`: `purchase_price`, `market_value`, `replacement_price`, `auction_comp`, `producer_fact`, `drink_window`, `serving_guidance`, `identity`, `estimate`
- `review_status`: `draft`, `accepted`, `rejected`, `superseded`

RLS:

- User can access evidence only through owned cellar inventory/cellars.
- No global leakage of personal cellar data.

Indexes:

- `inventory_id`
- `wine_reference_id`
- `source_type`
- `observation_kind`
- `observed_at desc`
- `review_status`

---

## Core Library Files

Create:

- `src/lib/current-intelligence/types.ts`
- `src/lib/current-intelligence/price-observations.ts`
- `src/lib/current-intelligence/evidence.ts`
- `src/lib/current-intelligence/valuation-selector.ts`
- `src/lib/current-intelligence/refresh-planner.ts`
- `src/lib/current-intelligence/ai-search.ts`
- `src/lib/current-intelligence/source-policy.ts`
- `src/lib/current-intelligence/cellartracker-import.ts`

Modify:

- `src/lib/bottle-dominance.ts`
- `src/app/api/bottle-dominance/[id]/route.ts`
- `src/app/(dashboard)/cellar/[id]/page.tsx`
- `src/lib/hooks/use-cellar.ts`
- `src/types/database.ts`
- `package.json`

Tests:

- `tests/current-intelligence.test.ts`
- `tests/price-observations.test.ts`
- `tests/cellartracker-import.test.ts`
- update `tests/bottle-dominance.test.ts`
- optional security route coverage in `tests/p0-security.test.ts`

---

# Milestone 1 — Evidence and Price Observation Foundation

## Task 1: Add RED tests for price observation selection

**Objective:** Prove the valuation rules before schema/UI work.

**Files:**
- Create: `tests/price-observations.test.ts`
- Later create: `src/lib/current-intelligence/price-observations.ts`

**Test cases:**

- Missing observations returns Unknown, not zero.
- Retailer listing becomes `replacement_price`, not `market_value`.
- Accepted manual market value outranks stale AI estimate.
- Recent exact-vintage CellarTracker import outranks old retailer replacement listing for market display.
- Auction comp is market evidence but should be labelled auction-based.
- Stale observations remain visible but do not silently update current value.

**Run:**

```bash
npm exec tsx -- tests/price-observations.test.ts
```

**Expected:** FAIL because implementation does not exist.

---

## Task 2: Implement deterministic price observation selector

**Objective:** Add pure functions for selecting best market/replacement values.

**Files:**
- Create: `src/lib/current-intelligence/types.ts`
- Create: `src/lib/current-intelligence/price-observations.ts`

**Functions:**

- `normalizePriceObservation(input)`
- `classifyObservationKind(sourceType, rawKind)`
- `isPriceObservationStale(observation, asOf)`
- `selectBestMarketValue(observations, asOf)`
- `selectBestReplacementPrice(observations, asOf)`
- `summarizePricePosture(observations, asOf)`

**Run:**

```bash
npm exec tsx -- tests/price-observations.test.ts
npm run typecheck
```

**Expected:** PASS.

---

## Task 3: Add Supabase migration for evidence tables

**Objective:** Persist source receipts and price observations safely.

**Files:**
- Create: `supabase/migrations/00012_current_intelligence_layer.sql`
- Modify: `src/types/database.ts`
- Test: `scripts/check-migrations.ts` if needed

**Implementation notes:**

- Use `gen_random_uuid()`.
- Use `created_at timestamptz default now()`.
- Add RLS policies based on cellar ownership.
- Use nullable `source_url`; evidence can be manual.
- Store `raw_payload jsonb` for import/search metadata.
- Store `extracted_facts jsonb` for AI/search facts.
- Do not require price for non-price evidence.

**Run:**

```bash
npm run db:migrations:check
npm run typecheck
```

**Expected:** migration order valid and types compile.

---

# Milestone 2 — Manual Evidence UI

## Task 4: Add manual price evidence API

**Objective:** Let Bottle Detail save reviewed/manual price evidence without touching cellar truth directly.

**Files:**
- Create: `src/app/api/price-observations/route.ts`
- Create: `src/app/api/price-observations/[id]/route.ts`
- Modify: `tests/p0-security.test.ts` or create route auth tests if current pattern supports it

**Endpoints:**

- `GET /api/price-observations?inventoryId=...`
- `POST /api/price-observations`
- `PATCH /api/price-observations/[id]` for review status / notes

**Security:**

- Require authenticated user.
- Verify ownership through `cellar_inventory -> cellars.owner_id`.
- Validate with zod.
- Reject invalid source/kind combinations where possible.

**Run:**

```bash
npm run typecheck
npm run lint
```

---

## Task 5: Add Bottle Detail price evidence panel

**Objective:** Show current pricing posture and let Brian add evidence manually.

**Files:**
- Modify: `src/app/(dashboard)/cellar/[id]/page.tsx`
- Create: `src/components/cellar/price-evidence-panel.tsx` if component extraction is cleaner
- Create: `src/components/cellar/add-price-evidence-dialog.tsx`

**UI:**

- Current market value: value/source/date/confidence or Unknown.
- Replacement price: value/source/date/confidence or Unknown.
- Evidence list grouped by kind.
- Button: **Add price evidence**.
- Manual form:
  - value
  - currency
  - kind
  - source type
  - source name/url
  - observed date
  - confidence
  - notes

**Run:**

```bash
npm run typecheck
npm run lint
```

---

# Milestone 3 — Current Intelligence Refresh Button

## Task 6: Add RED tests for refresh planner and source policy

**Objective:** Ensure search scopes and source rules are deterministic and cost-controlled.

**Files:**
- Create: `tests/current-intelligence.test.ts`
- Later create: `src/lib/current-intelligence/refresh-planner.ts`
- Later create: `src/lib/current-intelligence/source-policy.ts`

**Test cases:**

- Quick refresh generates identity/pricing query, not deep research.
- Pricing-only scope excludes serving/food pairing suggestions.
- Existing fresh accepted evidence avoids unnecessary refresh.
- Retailer results are classified as replacement price.
- Login-gated/prohibited sources become citation/gap only, not extracted pricing.
- Deep refresh includes winery facts/readiness/serving but still review-only.

**Run:**

```bash
npm exec tsx -- tests/current-intelligence.test.ts
```

**Expected:** FAIL.

---

## Task 7: Implement refresh planner and source policy

**Objective:** Build the deterministic brain that decides what to search and what to trust.

**Files:**
- Create: `src/lib/current-intelligence/refresh-planner.ts`
- Create: `src/lib/current-intelligence/source-policy.ts`

**Functions:**

- `buildBottleSearchIdentity(record)`
- `buildRefreshPlan(record, scope, existingEvidence, asOf)`
- `classifySourcePolicy(urlOrDomain)`
- `classifyEvidenceKind(source, extractedFact)`
- `shouldSkipRefresh(existingEvidence, scope, asOf)`

**Policy examples:**

- winery official page: producer facts/readiness OK
- retailer page: replacement price OK
- auction result: auction comp OK
- search snippet: low-confidence evidence only
- login-gated source: cite/gap only unless user-provided export/manual
- known scraping-risk domains: do not scrape; require manual/user-provided export or licensed API

**Run:**

```bash
npm exec tsx -- tests/current-intelligence.test.ts
npm run typecheck
```

---

## Task 8: Add refresh-intelligence API skeleton

**Objective:** Add authenticated route that creates a refresh record and returns a deterministic draft even before live web search is enabled.

**Files:**
- Create: `src/app/api/bottle-intelligence/refresh/[id]/route.ts`

**Endpoint:**

`POST /api/bottle-intelligence/refresh/[id]`

Body:

```json
{
  "scope": "quick" | "pricing" | "readiness" | "deep" | "replacement",
  "force": false
}
```

Response:

- refresh id
- plan
- draft evidence candidates
- gaps
- provider/search status

**Security:**

- Auth required.
- Ownership checked.
- Basic cooldown per bottle/scope.

**Run:**

```bash
npm run typecheck
npm run lint
```

---

# Milestone 4 — AI Search / Evidence Extraction

## Task 9: Add AI extraction contract tests

**Objective:** Prove AI output is normalized and safe before wiring to network/search.

**Files:**
- Create/update: `tests/current-intelligence.test.ts`
- Create: `src/lib/current-intelligence/ai-search.ts`

**Test cases:**

- AI result with price + retailer URL becomes draft replacement observation.
- AI result without URL is `ai_inferred`, not verified.
- Case price is not mistaken for bottle price.
- Wrong vintage is marked lower confidence.
- Ambiguous producer match becomes rejected/gap candidate.
- No reliable result returns gaps, not fake facts.

---

## Task 10: Implement AI extraction normalizer

**Objective:** Convert AI/search candidate data into evidence/observation drafts.

**Files:**
- Create: `src/lib/current-intelligence/ai-search.ts`

**Functions:**

- `normalizeAiEvidenceCandidates(raw, plan)`
- `extractPriceCandidates(rawCandidates)`
- `extractProducerFacts(rawCandidates)`
- `scoreIdentityMatch(recordIdentity, candidate)`
- `buildEvidenceDraftsFromCandidates(candidates)`

**Important:** The function should accept already-fetched/source-candidate content. Keep network calls separate for testing.

**Run:**

```bash
npm exec tsx -- tests/current-intelligence.test.ts
npm run typecheck
```

---

## Task 11: Wire Anthropic synthesis into refresh route

**Objective:** Use AI to synthesize reviewed evidence candidates, not apply truth.

**Files:**
- Modify: `src/app/api/bottle-intelligence/refresh/[id]/route.ts`
- Use existing `@anthropic-ai/sdk` pattern from current AI routes

**Behavior:**

- If `ANTHROPIC_API_KEY` absent, return deterministic gaps and manual/import guidance.
- If present, call model with strict JSON schema/prompt.
- Include source-policy instructions.
- Persist refresh audit row.
- Persist draft evidence rows only if schema supports `review_status='draft'`; otherwise return draft for UI review first.
- Never apply cellar updates in this route.

**Run:**

```bash
npm run typecheck
npm run lint
```

**Note:** If no web-search provider is available inside the app runtime, AI should synthesize from supplied/manual URLs and existing record data only. Do not pretend it performed live search.

---

# Milestone 5 — Review and Apply Flow

## Task 12: Add evidence review/apply helpers

**Objective:** Convert accepted evidence into safe Bottle Dominance suggestions.

**Files:**
- Create: `src/lib/current-intelligence/evidence.ts`
- Modify: `src/lib/bottle-dominance.ts`
- Update: `tests/bottle-dominance.test.ts`

**Functions:**

- `buildEvidenceSummary(evidence, observations)`
- `buildSuggestionsFromAcceptedEvidence(record, evidence, observations)`
- `buildSafeEvidencePatch(acceptedSuggestions)`

**Rules:**

- market value suggestion requires market evidence, not retailer-only replacement evidence.
- if applying market value, set source + updated timestamp together.
- AI inferred drink window can suggest but should lower confidence.
- notes updates should append with source label, not overwrite Brian notes.

---

## Task 13: Add Refresh Intelligence UI

**Objective:** Let Brian refresh and review evidence from Bottle Detail.

**Files:**
- Modify: `src/app/(dashboard)/cellar/[id]/page.tsx`
- Create: `src/components/cellar/refresh-intelligence-dialog.tsx`
- Create: `src/components/cellar/evidence-drawer.tsx`

**UI flow:**

1. Click **Refresh intelligence**.
2. Choose scope or default Quick Refresh.
3. Show progress/loading.
4. Show results:
   - summary
   - price observations
   - source receipts
   - gaps
   - suggested safe updates
5. Select evidence/suggestions.
6. Click **Save evidence** or **Apply selected updates**.

**Copy:**

- “Retail listings are replacement price, not market value.”
- “No verified market value found.”
- “AI inferred — review before applying.”

---

## Task 14: Persist reviewed evidence and observations

**Objective:** Save accepted/rejected evidence decisions.

**Files:**
- Create/modify API routes under `src/app/api/intelligence-evidence/`
- Modify UI from Task 13

**Endpoints:**

- `POST /api/intelligence-evidence/review`
- Body includes accepted/rejected draft ids/candidates.
- Creates accepted `wine_intelligence_evidence` and `wine_price_observations` rows.
- Returns updated pricing posture.

**Run:**

```bash
npm run typecheck
npm run lint
```

---

# Milestone 6 — CellarTracker / CSV Import Path

## Task 15: Add RED tests for CellarTracker import normalization

**Objective:** Support low-cost personal valuation via exported data.

**Files:**
- Create: `tests/cellartracker-import.test.ts`
- Later create: `src/lib/current-intelligence/cellartracker-import.ts`

**Test cases:**

- Parse common CellarTracker columns.
- Match by producer/name/vintage/bottle size.
- Create market value observation when value column exists.
- Purchase price remains purchase price, not market value.
- Ambiguous rows are returned for manual review.

---

## Task 16: Implement CellarTracker CSV normalizer

**Objective:** Convert imported rows into reviewable evidence/observations.

**Files:**
- Create: `src/lib/current-intelligence/cellartracker-import.ts`

**Functions:**

- `parseCellarTrackerCsv(text)`
- `normalizeCellarTrackerRow(row)`
- `matchCellarTrackerRowToInventory(row, inventory)`
- `buildCellarTrackerObservationDraft(row, match)`

**Run:**

```bash
npm exec tsx -- tests/cellartracker-import.test.ts
npm run typecheck
```

---

## Task 17: Add import UI/API

**Objective:** Allow file upload/import preview without silently changing cellar truth.

**Files:**
- Create: `src/app/(dashboard)/settings/imports/page.tsx` or add to existing settings/import surface
- Create: `src/app/api/imports/cellartracker/route.ts`

**Flow:**

1. Upload CSV.
2. Preview matched/unmatched rows.
3. Accept selected observations.
4. Create evidence + price observations.
5. Show updated value posture.

**Run:**

```bash
npm run typecheck
npm run lint
```

---

# Milestone 7 — Portfolio and Command Center Integration

## Task 18: Feed observations into portfolio truth

**Objective:** Make analytics use evidence-backed values.

**Files:**
- Modify: `src/lib/portfolio-truth.ts`
- Modify: `src/lib/hooks/use-portfolio-value.ts`
- Test: `tests/portfolio-truth.test.ts`

**Rules:**

- known market values are evidence-backed.
- replacement prices may be shown separately.
- unknown values stay out of valuation totals or are counted as unknown coverage.
- display confidence coverage.

---

## Task 19: Add cellar-wide current intelligence lanes

**Objective:** Surface where Brian should refresh/review evidence.

**Files:**
- Modify: `src/lib/cellar-command-center.ts`
- Modify relevant dashboard page/cards
- Test: `tests/cellar-command-center.test.ts`

**New lanes:**

- Unknown value
- Stale price evidence
- High-value missing provenance
- Ready-to-drink but under-documented
- Replacement candidate
- Evidence awaiting review

---

# Milestone 8 — Optional Provider Adapter Slot

## Task 20: Add provider interface without paid implementation

**Objective:** Keep future Wine-Searcher/WMJ/provider clean without committing to cost.

**Files:**
- Create: `src/lib/current-intelligence/providers/types.ts`
- Create: `src/lib/current-intelligence/providers/manual.ts`
- Create: `src/lib/current-intelligence/providers/wine-searcher.ts` as disabled stub only

**Interface:**

```ts
export type PricingProvider = {
  id: string;
  label: string;
  configured: boolean;
  lookup(input: PricingLookupInput): Promise<PricingLookupResult>;
};
```

**Rule:** Stub returns `configured: false` unless real credentials/docs are supplied. No guessed endpoint.

---

# Milestone 9 — Hardening and Documentation

## Task 21: Security and cost-control audit

**Objective:** Ensure refresh routes cannot be abused or leak data.

**Checklist:**

- Auth on every route.
- Ownership check on every inventory id.
- Body size limits for import/AI routes.
- Refresh cooldown/daily cap.
- No secrets in logs.
- No source scraping of prohibited/login-gated services.
- No model output directly applied.

**Run:**

```bash
npm run test:p0-security
npm run typecheck
npm run lint
```

---

## Task 22: Add docs and skill reference

**Objective:** Capture the pattern for future Pourfolio work.

**Files:**
- Create: `docs/current-intelligence-layer.md`
- Update skill reference: `pourfolio-development` after implementation

**Docs should explain:**

- source types
- truth labels
- price kinds
- evidence review flow
- provider policy
- import workflow
- unknown-not-zero rule

---

## Task 23: Full verification and commit

**Objective:** Prove the entire system works.

**Run:**

```bash
git status --short --branch
npm run check
git diff --check
git diff --stat
git diff -- src package.json tests supabase docs | grep -E '([A-Za-z0-9_]{24,}|service_role|secret|password|api[_-]?key|SUPABASE_[A-Z_]+)' || true
git add .
git commit -m "feat: add current wine intelligence layer"
git push origin main
```

**Expected:**

- all checks pass
- no secret values committed
- commit pushed

---

## Suggested Sprint Sequencing

### Sprint 1 — Evidence Foundation

Tasks 1–5.

Outcome: manual/current pricing evidence exists and Bottle Detail can show truthful market/replacement posture.

### Sprint 2 — Refresh Intelligence

Tasks 6–14.

Outcome: select bottle → Refresh intelligence → AI/current evidence draft → review/apply.

### Sprint 3 — Low-Cost Imports

Tasks 15–17.

Outcome: CellarTracker/CSV import gives cheap personal valuation coverage.

### Sprint 4 — Portfolio OS Integration

Tasks 18–23.

Outcome: portfolio/command center use evidence-backed values and surface cellar-wide gaps/actions.

---

## Acceptance Criteria

- Brian can select a bottle and click **Refresh intelligence**.
- The app returns source-backed evidence, gaps, and suggestions.
- Brian can save accepted evidence without applying cellar changes.
- Brian can apply selected safe updates from evidence.
- Retail prices are displayed as replacement price unless explicitly classified otherwise.
- Unknown values remain Unknown.
- Manual evidence and CellarTracker-style imports work without paid APIs.
- Bottle Dominance uses accepted observations in its dossier.
- Portfolio truth reports coverage and confidence, not fake totals.
- `npm run check` passes.
