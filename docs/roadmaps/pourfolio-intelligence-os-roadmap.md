# Pourfolio Intelligence OS Roadmap

Created by: Jarvis (Hermes Agent)
Date: 2026-06-26 09:47 EDT
Source: Brian Lewis conversation + bounded subagent audits of Pourfolio readiness, pricing, and intelligence UX
Related project: Pourfolio / Lewis-Wine
Repo: `/Users/brianlewis/.openclaw/workspace-c3po-chief-of-staff/projects/Lewis-Wine`
Current baseline commit when created: `0a53bab Wire acquisition handoffs from buying surfaces`
Status: Active roadmap / implementation guide

> **Purpose:** This is the canonical roadmap for turning Pourfolio from a set of useful wine-intelligence panels into an autonomous wine intelligence operating system. Future Jarvis/Hermes sessions — including Telegram sessions — should read this file when Brian asks, “Where are we at on the Pourfolio build?”

---

## Quick Resume Prompt

If starting a fresh session, Brian can say:

> Jarvis, open the Pourfolio Intelligence OS Roadmap and tell me where we are. The roadmap is at `docs/roadmaps/pourfolio-intelligence-os-roadmap.md` in the Lewis-Wine repo, mirrored in Obsidian at `80_Agent_Outputs/Hermes/Pourfolio Intelligence OS Roadmap.md`.

Jarvis should then:

1. Load the `pourfolio-development` skill.
2. Read this roadmap.
3. Check git status and latest commit in the Lewis-Wine repo.
4. Compare current code to the roadmap status table.
5. Report: completed, in progress, blocked, next recommended slice.

---

## Brian’s Product Standard

Brian’s standard is not “a nice wine tracker.”

The target system is:

> I add wine. Pourfolio watches it, understands it, and tells me what matters — what to drink, what to hold, what is peaking, what is past peak, what to replenish, what to buy, what to sell-watch, and what needs better evidence.

The app should work for Brian. Brian should not have to work for the app.

Practical implications:

- Manual research should be the exception, not the operating model.
- Every insight should have a next action.
- Every action should create an outcome.
- Every outcome should improve future recommendations.
- Evidence must be source-backed when it affects money or drinking-window truth.
- AI guesses may be shown as context, but must not become trusted valuation or readiness truth without source support.

---

## Current Diagnosis

Pourfolio has many strong intelligence primitives, but it is not yet one unified intelligence system.

Current app shape:

- Bottle Brain / Bottle Intelligence
- Current Intelligence / price evidence
- Cellar Command Center
- Taste Genome
- Buy Again
- Replenishment
- Acquisition Engine
- Shopping Mode
- Restaurant Mode
- Receipt Capture
- Field Capture

These are individually valuable. The weakness is orchestration.

The current system can answer many questions if Brian visits the right page and clicks the right control. The desired system should proactively produce a prioritized operating queue.

### Blunt assessment

The product is currently panel-rich but autopilot-thin.

The next phase should build the spine above the panels: **Portfolio Radar**.

---

## Current Verified Baseline

As of roadmap creation:

- Latest pushed commit: `0a53bab Wire acquisition handoffs from buying surfaces`
- Previous pricing commit: `1e39bec Enrich acquisition targets with price search`
- Acquisition Engine hosted smoke had previously passed for `1e39bec`.
- `0a53bab` wired:
  - Buy Again → Acquisition Engine
  - Shopping Mode deterministic `sourceId`
  - Replenishment create-or-update target behavior
  - Acquisition target create-or-update by source identity
- Full local `npm run check` passed before `0a53bab` commit, including production `next build`.

Known caution at creation:

- Git status showed unrelated untracked Phase G / real-cellar trial files:
  - `src/lib/real-cellar-acceptance-trial.ts`
  - `tests/real-cellar-acceptance-trial.test.ts`
- Do not accidentally mix those into Portfolio Radar commits unless intentionally continuing Phase G.

---

## Intelligence Audit Summary

### 1. Drink-window / readiness intelligence

Existing files and concepts:

- `src/lib/wine-readiness.ts`
  - `WineReadinessState = "hold" | "ready" | "drink_soon" | "past_peak" | "unknown"`
  - `getWineReadiness()` derives state from `drink_after` / `drink_before`.
  - `getWineWindowDisplay()` returns display status.
  - `isWineApproachingPeak()` exists, but production use is limited/unclear.

- `tests/wine-readiness.test.ts`
  - Covers current readiness state machine.
  - Does not cover true `entering_window` or `at_peak`, because those states do not exist.

- `src/lib/cellar-command-center.ts`
  - Uses readiness to build command lanes.
  - `drinkNow` currently means `ready | drink_soon`.
  - `atRisk` currently means `past_peak`.

- `src/lib/bottle-intelligence.ts`
  - Builds bottle readiness and next signals from `drinkAfter` / `drinkBefore`.

- `src/lib/bottle-brain.ts`
  - Collapses `drink_soon` into `ready`.
  - Recommends `update_window` for past-peak rather than a richer operational action.

- `src/lib/bottle-dominance.ts`
  - Can suggest applying `wine_reference.drink_window_start/end` to inventory.

- Schema:
  - `wine_reference.drink_window_start/end`
  - `cellar_inventory.drink_after/before`
  - `wine_intelligence_evidence.observation_kind` includes `drink_window`
  - `wine_intelligence_refreshes.scope` includes `readiness`

Key failures:

- No true `at_peak` phase.
- No true `entering_window` phase.
- Peak band is not separately modeled from drink-before.
- Readiness only works reliably if inventory-level `drink_after/before` are already populated.
- Reference drink windows exist but are not consistently used as automatic fallback truth.
- No verified scheduled refresh or alerting layer for readiness transitions.
- Brian still has to investigate missing windows.

### 2. Pricing / valuation intelligence

Existing files and concepts:

- `src/lib/current-intelligence/index.ts`
  - Builds refresh plans.
  - Classifies sources.
  - Blocks protected/licensed sites from unsupported extraction.
  - Normalizes AI evidence candidates.

- `src/lib/current-intelligence/price-observations.ts`
  - Classifies observations into:
    - `market_value`
    - `replacement_price`
    - `auction_comp`
    - `estimate`
  - Selects best market value only from `market_value` / `auction_comp`.
  - Selects replacement price only from `replacement_price`.
  - Ignores `estimate` for headline cards.

- `src/app/api/bottle-intelligence/refresh/[id]/route.ts`
  - Manual bottle refresh route.
  - Can synthesize candidates using Anthropic/web search.
  - Logs refresh telemetry.
  - Audit found the route returns normalized AI observations but did not verify persistence of those normalized rows into `wine_price_observations`.

- `src/lib/acquisition-engine.ts`
  - Normalizes acquisition price evidence.
  - Rejects unsupported AI/protected-source prices as valuation drivers.
  - Computes buy/watch lanes and stale refresh queue.

- `src/app/api/acquisition-engine/route.ts`
  - Persists `acquisition_price_observations` during refresh.
  - Updates `last_refreshed_at`, `next_refresh_at`, and best observation.

- `src/lib/portfolio-truth.ts`
  - Uses `cellar_inventory.current_market_value_cents` and purchase price.
  - Does not yet appear to roll up from accepted `wine_price_observations`.

- Schema:
  - `wine_intelligence_evidence`
  - `wine_price_observations`
  - `wine_intelligence_refreshes`
  - legacy `price_observations`
  - `acquisition_watchlist`
  - `acquisition_price_observations`
  - legacy `current_market_value_cents` on `cellar_inventory`

Why screenshot showed `$375 ai inferred estimate` while headline cards were Unknown:

- The rows were estimates / `ai_inferred` context.
- The valuation logic intentionally excludes `estimate` from Market Value and Replacement Price.
- Market Value requires accepted market-value or auction-comp evidence.
- Replacement Price requires accepted retailer/winery/auction replacement evidence.
- This conservative behavior is correct; the missing piece is automated source-backed evidence gathering and rollup.

Key failures:

- Bottle quick refresh is not yet a complete persistence + review + rollup pipeline.
- No verified cellar-wide scheduled valuation refresh.
- No verified automatic rollup from accepted observations into current valuation posture.
- No sell-watch alerting engine.
- No robust provider-backed valuation path yet.

### 3. UX / autopilot intelligence

Existing surfaces:

- `/intelligence`
  - Renders a vertical stack of panels.
  - Components include:
    - `CaptureCommandCard`
    - `BuyAgainLane`
    - `ReplenishmentAutomationPanel`
    - `AcquisitionEnginePanel`
    - `AcquisitionReceiptPanel`
    - `TasteGenomeDashboard`
    - `WineListAdvisor`

- `/cellar`
  - Cellar Command Center lanes.

- `/cellar/[id]`
  - Bottle detail, Bottle Brain, Price Evidence panel, bottle intelligence.

- `/capture`
  - Field capture and save flow.

- `/capture/saved/[id]`
  - Post-save confirmation with downstream actions.

- `/shopping`
  - Shopping Mode panel.

- `/recommendations`
  - Tonight/recommendation flow.

- Restaurant Mode via `WineListAdvisor`.

Key failures:

- `/intelligence` is a stack, not an executive operating layer.
- No unified prioritized action queue.
- Some actions are effectively dead-ended, e.g. query params that `/intelligence` does not consume.
- Restaurant Mode recommends but does not create durable outcomes.
- Tonight selection appears local-only, not a durable learning loop.
- Taste Genome describes preferences but does not create actions.
- Cellar Command Center routes to detail pages rather than resolving actions inline.
- Sell-watch is not a visible first-class UX journey.

---

## North Star Architecture

Portfolio Radar should implement:

```text
Evidence → Derived Intelligence → Insight → Action → Outcome → Learning
```

### Evidence

Raw facts from:

- purchase receipts
- manual entries
- CellarTracker imports
- provider data
- retailer/winery listings
- auction comps
- public web
- LLM/web-search candidates
- Brian’s ratings and tasting notes
- restaurant/shopping/capture outcomes

### Derived Intelligence

Computed truth:

- readiness phase
- peak status
- market value
- replacement price
- evidence health
- sell-watch posture
- buy-watch posture
- replenishment pressure
- confidence and freshness

### Insight

A claim the system believes matters:

- “This bottle is entering its window.”
- “This bottle is at peak.”
- “Replacement price jumped 38%.”
- “You loved this and have one left.”
- “This high-value bottle lacks market evidence.”

### Action

A recommended operation:

- drink
- hold
- replenish
- buy
- watch price
- sell-watch
- investigate evidence
- capture memory
- close receipt
- link reference
- snooze
- dismiss

### Outcome

What actually happened:

- opened bottle
- captured tasting note
- bought replacement
- dismissed recommendation
- marked too young / ideal / fading / dead
- passed on purchase
- sold bottle

### Learning

Update future decisions:

- Taste Genome changes.
- readiness confidence changes.
- replenishment pressure changes.
- recommendation suppression improves.
- price thresholds improve.

---

## Proposed Data Model

### `cellar_insights`

Purpose: durable, explainable claims generated by Pourfolio.

Suggested fields:

- `id`
- `owner_id`
- `subject_type` — inventory, wine_reference, acquisition_target, receipt, restaurant_choice, shopping_pick
- `subject_id`
- `source_surface` — cellar, bottle_brain, current_intelligence, acquisition, shopping, restaurant, capture, taste_genome
- `claim`
- `confidence`
- `severity`
- `evidence_ids`
- `created_at`
- `expires_at`
- `dedupe_key`
- `raw_payload`

### `cellar_actions`

Purpose: one queue of what Brian should do.

Suggested fields:

- `id`
- `owner_id`
- `insight_id`
- `verb`
- `label`
- `priority`
- `due_at`
- `state` — new, accepted, snoozed, in_progress, done, dismissed
- `primary_cta_href`
- `source_component`
- `rationale`
- `expected_learning`
- `snooze_until`
- `completed_at`
- `resolution_payload`

### `cellar_action_outcomes`

Purpose: learning loop after actions.

Suggested fields:

- `id`
- `owner_id`
- `action_id`
- `result_type`
- `payload`
- `user_feedback`
- `inventory_delta`
- `taste_signal_delta`
- `price_signal_delta`
- `notes`
- `created_at`

### `wine_drink_window_observations`

Purpose: source-backed drinking-window evidence.

Suggested fields:

- `id`
- `owner_id`
- `inventory_id`
- `wine_reference_id`
- `source_type`
- `source_name`
- `source_url`
- `truth_label`
- `review_status`
- `drink_after`
- `drink_before`
- `peak_start`
- `peak_end`
- `serving_guidance`
- `confidence`
- `observed_at`
- `expires_at`
- `raw_payload`

### `cellar_readiness_snapshots`

Purpose: current computed maturity posture.

Suggested fields:

- `id`
- `owner_id`
- `inventory_id`
- `phase` — missing_window, hold, entering_window, ready, at_peak, drink_soon, past_peak, needs_review
- `normalized_drink_after`
- `normalized_drink_before`
- `peak_start`
- `peak_end`
- `confidence`
- `source_observation_id`
- `days_to_start`
- `days_to_peak`
- `days_to_end`
- `priority`
- `next_action`
- `action_due_at`
- `computed_at`
- `next_refresh_at`

### `wine_current_valuations`

Purpose: current value posture, separate from raw observations.

Suggested fields:

- `id`
- `owner_id`
- `inventory_id`
- `wine_reference_id`
- `market_value_cents`
- `market_value_confidence`
- `market_value_source_id`
- `replacement_price_cents`
- `replacement_price_confidence`
- `replacement_price_source_id`
- `purchase_price_cents`
- `gain_loss_cents`
- `gain_loss_percent`
- `valuation_phase` — unknown, estimate_only, replacement_known, market_known, sell_watch, buy_watch
- `computed_at`
- `next_refresh_at`

---

## Source Strategy

### Tier 0 — unknown / no source

Displayed only as missing data.

### Tier 1 — AI inferred

Good for context and search direction.

Rules:

- Do not drive Market Value.
- Do not drive Replacement Price.
- Do not drive sell-watch.
- May create `investigate` action.

### Tier 2 — public source-backed replacement evidence

Examples:

- retailer listing
- winery listing
- public shop listing
- current auction availability

Good for:

- Replacement Price
- buy-watch
- acquisition decisions

Weak for:

- true secondary Market Value

### Tier 3 — auction comps / imports / CellarTracker exports

Good for:

- market estimates
- trend signals
- sell-watch candidates

Need caution around:

- condition
- bottle size
- lot size
- fees
- recency

### Tier 4 — paid/provider-backed market data

Examples:

- Wine Market Journal
- Wine-Searcher provider/pro access if available
- Liv-ex where relevant
- other commercial datasets

Good for:

- reliable Market Value
- sell-watch
- high-confidence portfolio valuation

Implementation principle:

Build the evidence spine first. Providers should feed the system, not define it.

---

## Refresh Cadence

### Daily targeted refresh

Run for:

- active acquisition targets
- high-value bottles
- sell-watch candidates
- bottles near peak
- bottles entering drink window
- bottles past drink-before
- stale replacement evidence
- unresolved high-priority actions

### Weekly cellar operating review

Run for:

- all in-cellar bottles
- readiness recalculation
- valuation rollup
- stale evidence detection
- missing market value detection
- replenishment pressure
- buy-again state
- unresolved actions

### Monthly / quarterly deeper refresh

Run for:

- market comps
- auction comps
- provider-backed valuation
- slow-moving bottles
- expensive bottles
- portfolio concentration review

### Cost controls

- Refresh by wine identity, not by every bottle quantity.
- Use accepted evidence first.
- Use linked reference data before LLM search.
- Use imports/provider data before web search.
- LLM search only for gaps, stale high-priority items, active acquisition targets, or high-value bottles.
- Cap daily/monthly Anthropic spend.
- Persist every refresh skip reason.
- Fix refresh-skip logic so a fresh replacement price does not skip missing market value.

---

# Roadmap

## Phase 1 — Portfolio Radar v1: Pourfolio Today

**Status:** Recommended next build.

### Goal

Make `/intelligence` begin with an executive operating panel instead of a stack of panels.

### Product promise

Brian opens Pourfolio and sees what matters now.

### Scope

Build a unified action queue shell using existing data only.

Initial action types:

- drink now
- at risk / past peak
- missing drink window
- review price evidence
- refresh valuation
- replenish
- buy/watch acquisition
- close receipt
- capture tasting memory
- investigate missing evidence
- snooze / dismiss

### Likely files

Create/modify:

- `src/lib/portfolio-radar.ts`
- `tests/portfolio-radar.test.ts`
- `src/app/api/portfolio-radar/route.ts`
- `src/components/wine/portfolio-radar-panel.tsx`
- `src/app/(dashboard)/intelligence/page.tsx`
- possibly migration for `cellar_insights` / `cellar_actions`, or start with derived API-only v1 if keeping schema light

### Acceptance criteria

- `/intelligence` shows a top-level “Pourfolio Today” panel.
- Panel has prioritized action rows.
- Each row includes:
  - verb
  - label
  - reason
  - confidence
  - source surface
  - CTA
  - snooze/dismiss affordance, even if v1 state is local/API-only
- Existing panel counts roll up into the brief.
- Broken/dead links such as `?action=find-more` are either handled or removed.
- Tests cover action generation from sample cellar/readiness/pricing/acquisition inputs.

### Definition of done

- Targeted tests pass.
- `npm run check` passes if code changes are broad enough.
- Browser smoke `/intelligence` shows Portfolio Radar at the top.
- No unrelated Phase G files committed accidentally.

---

## Phase 2 — Readiness Engine v2

**Status:** Next after Portfolio Radar shell.

### Goal

Model real cellar maturity, not just hold/ready/past.

### New canonical phases

- `missing_window`
- `hold`
- `entering_window`
- `ready`
- `at_peak`
- `drink_soon`
- `past_peak`
- `needs_review`

### Scope

Enhance readiness logic to return:

- phase
- drink window
- peak band
- confidence
- days to window start
- days to peak
- days to drink-by
- next recommended action
- source/basis

### Likely files

Modify:

- `src/lib/wine-readiness.ts`
- `tests/wine-readiness.test.ts`
- `src/lib/cellar-command-center.ts`
- `src/lib/bottle-intelligence.ts`
- `src/lib/bottle-brain.ts`
- bottle detail readiness UI

### Acceptance criteria

- Tests cover all phases.
- Exact boundary dates are tested.
- `wine_reference.drink_window_start/end` can feed readiness without manually copying to inventory.
- Bottle detail shows source/confidence.
- Cellar Command Center / Portfolio Radar can show:
  - Entering Window
  - Ready
  - At Peak
  - Drink Soon
  - Past Peak
  - Missing Window

---

## Phase 3 — Source-backed Drink-window Evidence

**Status:** In progress; foundation shipped, review/apply API + UI is next.

### Goal

Treat drinking-window knowledge like price evidence: sourced, reviewable, refreshable, explainable.

### Scope

Add source-backed drink-window observations and review/apply flow.

### Likely files

Create/modify:

- `supabase/migrations/00022_drink_window_observations.sql` — local structured observation table; not yet applied to production.
- `src/lib/drink-window-evidence.ts` — pure normalization/validation/selection/readiness bridge.
- `tests/drink-window-evidence.test.ts` — proof that accepted source-backed observations can feed Readiness Engine v2 and AI/draft rows cannot.
- `src/lib/current-intelligence/*`
- `src/app/api/bottle-intelligence/refresh/[id]/route.ts`
- `src/components/cellar/price-evidence-panel.tsx` or a new readiness evidence panel
- bottle detail UI
- `tests/current-intelligence.test.ts`
- `tests/wine-readiness.test.ts`

### Acceptance criteria

- A refresh can discover a drink window as draft evidence.
- Source, confidence, and observed date are visible.
- AI/public-web findings do not silently overwrite inventory.
- High-confidence linked/reference evidence can feed readiness posture.
- Brian can accept/edit/reject evidence.

---

## Phase 4 — Valuation Rollup + Sell-watch

**Status:** Done for derived v1 in `e09d6ca`; future work can persist valuation snapshots if needed.

### Goal

Turn accepted observations into current Market Value, Replacement Price, and sell/buy-watch signals.

### Scope

Build valuation rollup from accepted evidence.

### Likely files

Create/modify:

- `src/lib/current-intelligence/price-observations.ts`
- new `src/lib/wine-valuations.ts` or `src/lib/portfolio-valuations.ts`
- `src/lib/portfolio-truth.ts`
- `src/app/api/bottle-intelligence/refresh/[id]/route.ts`
- `src/components/cellar/price-evidence-panel.tsx`
- `src/lib/portfolio-radar.ts`
- tests for valuation rollup

### Acceptance criteria

- Accepted `market_value` / `auction_comp` updates Market Value posture.
- Accepted retailer/winery listing updates Replacement Price posture only.
- `ai_inferred estimate` never updates Market Value or Replacement Price.
- Portfolio Radar uses the derived valuation posture before stale/manual-only inventory fields; durable Portfolio Truth snapshot persistence remains a later optional hardening step.
- Price spike creates sell-watch action.
- Price drop below acquisition target creates buy-watch action.
- UI explains why a row was not trusted as Market/Replacement.

---

## Phase 5 — Automated Refresh Queue

**Status:** In progress; due-selection foundation shipped in `4e6bb44`, record-only execution ledger/API shipped in `6123c96`, with hosted schedule trigger and daily/weekly summary still next.

### Goal

Run cellar-wide intelligence on a schedule with budget controls.

### Scope

Add due-selection and scheduled refresh logic.

### Likely files

Create/modify:

- Supabase migration for refresh queue if needed
- `src/lib/portfolio-radar-refresh.ts`
- `src/lib/portfolio-radar-refresh-runner.ts`
- `src/app/api/portfolio-radar/refresh/route.ts`
- `src/app/api/portfolio-radar/refresh/route.ts` or cron-safe route/script
- Hermes cron job / Netlify scheduled function decision pending
- `wine_intelligence_refreshes` use/extension
- tests for due selection and skip reasons

### Acceptance criteria

- Missing/stale/high-value bottles queue automatically.
- Fresh replacement price alone does not skip missing market value.
- High-value bottles refresh more frequently.
- LLM budget is capped.
- Skipped refreshes record reason.
- Daily/weekly summary says what changed.

Completed v1:

- `6123c96` adds a record-only refresh runner and authenticated POST API that consumes a Portfolio Radar refresh plan, writes due rows as `planned`, writes planner skips as `skipped`, preserves source-trust/budget reasons, and makes zero paid provider calls.

Still next:

- Generate the plan server-side on a hosted schedule, invoke/own the runner without trusting client-supplied plans, and summarize due/skipped/changed outcomes for Brian.

### Deployment decision needed

Choose one:

1. Hermes cron job on Brian’s local machine.
2. Netlify scheduled function.
3. Supabase scheduled job/Edge function.
4. Hybrid: local Hermes for personal assistant workflows, hosted scheduled job for app truth.

Recommendation: hosted scheduled truth for app-critical refreshes; Hermes can summarize and notify.

---

## Phase 6 — Outcome and Learning Loop

**Status:** Needed to make the system compound.

### Goal

Every action teaches Pourfolio.

### Scope

Implement durable outcomes for drink/buy/sell/skip/dismiss actions.

### Examples

- Drink action → tasting prompt → maturity feedback.
- Buy action → acquisition target/receipt/cellar intake.
- Dismiss action → suppress similar recommendations.
- Restaurant choice → post-meal feedback.
- Sell-watch action → decision history.

### Likely files

Create/modify:

- `cellar_action_outcomes` migration
- field capture save flow
- recommendations / Tonight Engine
- restaurant mode
- shopping mode
- acquisition engine
- taste genome signal updates

### Acceptance criteria

- Opening a bottle can close readiness alerts.
- Tasting feedback records maturity state:
  - too young
  - ideal
  - fading
  - dead
- Dismissal affects future recommendations.
- Restaurant/shopping choices become durable signals.
- Action history appears in bottle timeline.

---

## Phase 7 — Provider and Data-source Expansion

**Status:** After evidence/action spine is working.

### Goal

Improve valuation accuracy with better data sources.

### Candidate sources

- CellarTracker export/import enhancement
- Wine Market Journal
- Wine-Searcher provider/pro path if available/legal
- auction comp providers
- winery/retailer public listings
- manual broker/appraisal notes

### Acceptance criteria

- Provider rows have clear `source_type` and confidence.
- Market Value and Replacement Price remain separate.
- No protected-source scraping.
- Provider failures create actionable gaps, not silent bad data.

---

# Current “Where Are We?” Status Table

| Area | Status | Notes |
|---|---:|---|
| Acquisition Engine price search | Done | Commit `1e39bec`; hosted smoke passed for source-backed acquisition refresh. |
| Buy Again / Shopping / Replenishment handoff to Acquisition | Done | Commit `0a53bab`; local full check passed before push. Hosted smoke for `0a53bab` still recommended. |
| Portfolio Radar / Pourfolio Today | Done | Commit `44c6223`; authenticated local + hosted smokes generated 9 actions; Netlify deploy ready. |
| Readiness Engine v2 | Done | Commit `4dee98a`; core richer phase model shipped and Portfolio Radar consumes phase/source metadata. |
| Drink-window evidence foundation | Done | Commit `3e41d99`; local `wine_drink_window_observations` migration, helper/tests, and readiness bridge shipped; production migration not applied. |
| Drink-window evidence review/apply API + UI | Done | Commit `0b1ea59`; authenticated persist/list/accept/edit/reject API, Bottle Detail review panel, and Portfolio Radar accepted-evidence consumption shipped. |
| Valuation rollup | Done | Commit `e09d6ca`; derived `portfolio-valuations` posture feeds Portfolio Radar sell-watch from accepted trusted evidence while ignoring AI/draft estimates. |
| Automated refresh queue foundation | Done | Commit `4e6bb44`; Portfolio Radar now derives cellar-wide refresh due items from readiness, accepted valuation evidence, stale evidence, high-value gaps, cooldowns, explicit skip reasons, and budget controls. |
| Refresh execution ledger + API | Done | Commit `6123c96`; authenticated record-only runner persists due planned rows and planner skip summaries to `wine_intelligence_refreshes` without paid provider calls. |
| Hosted schedule trigger + daily/weekly summary | Next | Generate the current refresh plan server-side on schedule, invoke/own the runner safely, and summarize due/skipped/changed outcomes. |
| Outcome/learning loop | Planned | Some flows capture data, but no unified Insight → Action → Outcome model yet. |
| Provider-backed valuation | Later | Build after evidence/action spine. |

---

## Recommended Next Build Slice

Build **Hosted schedule trigger + daily/weekly summary**.

Why this next:

- Portfolio Radar now decides what needs refresh and why.
- The record-only runner/API can persist due and skipped refresh ledger rows without paid provider calls.
- The remaining manual gap is generating that plan server-side on schedule and turning refresh ledger rows into a Brian-facing daily or weekly summary of what was due, skipped/deferred, and actually changed.

Do not weaken auth/RLS, spend money, or change secrets. Routine non-destructive schema/deploy/smoke work is approved when needed to finish the slice safely; paid provider/LLM execution needs explicit budget controls and approval.

---

## Implementation Rules for Future Sessions

1. Load `pourfolio-development` before acting.
2. Read this roadmap before choosing the next slice.
3. Check git status before editing.
4. Do not mix unrelated Phase G / real-cellar trial files into Portfolio Radar commits.
5. Use TDD for core logic.
6. Run targeted tests and `npm run check` before commit when practical.
7. For schema changes, use idempotent migrations and apply/verify routine non-destructive production parity when safe; pause for destructive data changes, auth/RLS weakening, secrets, or unclear production risk.
8. Keep source-backed evidence separate from AI-inferred context.
9. Every intelligence feature must produce one of:
   - insight
   - action
   - outcome
   - learning
10. If a new panel does not feed the action spine, challenge it.

---

## Open Decisions

### 1. Where should scheduled refresh live?

Options:

- Hermes cron
- Netlify scheduled function
- Supabase scheduled job / Edge Function
- hybrid

Recommendation: hosted scheduled function for app truth; Hermes for briefing/notification.

### 2. How aggressive should auto-accept be?

Recommendation:

- Auto-accept only trusted first-party/manual/import/provider/reference data.
- Keep AI/public-web claims as draft unless source-backed and confidence policy passes.

### 3. What is the sell-watch threshold?

Potential defaults:

- Market value up 30%+ versus purchase price.
- Absolute gain above $100/bottle.
- Brian owns quantity > 1.
- Brian-Fit below beloved/benchmark threshold.
- Not in immediate drink/peak priority.

Derived v1 default adopted in `e09d6ca`: 30%+ gain or $100+/bottle gain, quantity/taste/readiness trade-off, and no immediate drink/peak priority. Brian can tune later after real use.

### 4. Should Portfolio Radar be schema-first or derived-only v1?

Recommendation:

- Start with pure derived `src/lib/portfolio-radar.ts` and tests.
- Add persisted `cellar_actions` once the action shape is proven.

---

## Future Session Closeout Format

When Brian asks “Where are we?” answer with:

1. Current branch / latest commit.
2. Roadmap phase status.
3. Last completed slice.
4. Current recommended slice.
5. Any blockers.
6. What to do next.

Example:

```text
Done so far:
- Acquisition Engine price search shipped.
- Buy Again / Shopping / Replenishment handoff shipped.

Current roadmap position:
- Next slice: Portfolio Radar v1 / Pourfolio Today.

Blocked:
- No blocker unless schema migration approval is needed.

Recommended next action:
- Build `src/lib/portfolio-radar.ts`, tests, `/api/portfolio-radar`, and top-of-/intelligence panel.
```

---

## Summary

Pourfolio’s next evolution is not “another feature.”

It is an intelligence spine.

Build Portfolio Radar first, then plug readiness, valuation, refresh automation, and learning loops into it.
