# Pourfolio Deep-Dive Review — 2026-07-01

**Scope:** full local repo including the two unpushed commits (`19d24f9`, `cb2a5f2`).
**Method:** 9 parallel review agents (product journeys, UX, roadmap gaps, architecture, security, data integrity, PWA/offline, dead code, production readiness), followed by adversarial verification of every serious claim (63 claims independently re-checked against the code; 60 confirmed, 3 refuted and corrected below), followed by a 3-lens strategy panel (product visionary / pragmatic engineer / daily user). Every finding cites a file and line that a verifier re-read. Static review only — no live Supabase or hosted app was exercised.

**Post-review update (2026-07-01, later same day):** the important-fix tier was executed (commits `2cc3894`..`5dee47a`) and the fix for §5's biggest confirmed gap — migrations `00024`–`00026` (consumption ledger, write-path idempotency, durable rate-limit counters) — was verified live against production via direct SQL queries. Two corrections to the findings below: (1) the claim that `00022` "was never applied to production" (§5, §10) was **live-verified false** — both `00022` and `00023` were already applied; the roadmap doc's status table was stale, not the code. (2) The wine-identity `UNIQUE` index risk flagged in migration `00025` was checked against production data before applying (zero duplicate wine identities found) and is now live with RLS confirmed enabled on both new tables. See `docs/security-checklist.md` for the current state of the remaining (dashboard-only) items.

---

## The thesis

Pourfolio is an excellent testable core wrapped in a prototype shell. The engines — Readiness Engine v2, Portfolio Radar, field capture with idempotent replay, the evidence/trust-tier model — are commercial-grade and better than most shipping wine apps. But the product's three identity claims are currently not true in production:

1. **"It works in the field"** — the service worker is never built (Turbopack silently no-ops next-pwa), offline label capture destroys the photo, and offline-dictated voice tastings can never queue.
2. **"It knows my palate"** — three taste systems exist and none learns: `brian_taste_profiles` is frozen at seed time, `taste_profile`'s only writer is an edge function nothing invokes, so Restaurant/Shopping Mode rank against a default palate.
3. **"Its numbers can be trusted"** — demo fixtures can write fake bottles and fabricated tasting notes into real tables, consume zeroes multi-bottle lots, retries can duplicate inventory, and /analytics values the cellar from a legacy manual field while Radar uses accepted evidence.

The leverage is not more features. It is finishing the loops around the strong engines so every sip, scan, and purchase makes the app measurably smarter — and hardening deploys/data so a solo owner can trust it for years.

---

## 1. What the app does today (plain English)

Pourfolio is a single-user wine operating system with four working pillars:

- **Command Center dashboard** (`/`) — computes bottle counts, portfolio value, readiness, and a taste genome server-side; routes to scan and Tonight Engine.
- **Intake** — manual add, AI label scan (Claude vision → prefilled add form), receipt OCR, a genuinely excellent field-capture flow (photo → Claude parse → follow-up question → editable review → three save modes, with offline queueing and idempotent replay), and voice tasting capture under JARVIS. Barcode scan exists but has no data source and always dead-ends.
- **Decision surfaces** — Tonight Engine (context-aware primary pick + 2 alternates with transparent 8-signal scoring; selection persists to the bottle page where consume+rate close the loop), Bottle Brain Q&A, cellar with Brian-Fit badges and portfolio value.
- **Intelligence page** — Portfolio Radar (prioritized action queue with outcome recording), Buy Again, Replenishment, Acquisition Engine, receipt closeout, Taste Genome, Restaurant Mode.

A separate JARVIS "Memory OS" (notes/commitments/briefings) coexists intentionally. ~48k LOC, 213 TS/TSX files, 29 migrations, 45 hermetic test files that pass on a clean clone with no env vars.

**Strongest journeys:** field capture → tasting memory → downstream queues; and decide-what-to-drink-tonight. Both flow end-to-end and feed real consumers.
**Weakest journeys:** buying (flagship "Add Purchase" CTA lands on a demo-prefilled panel; shopping-list purchases never reach the cellar) and importing (CellarTracker is script-only; the API route computes drink windows then drops them).

---

## 2. Confirmed showstoppers (fix-first list)

### P0-class — the PWA does not exist in production
- `next.config.ts:15` — `@ducanh2912/next-pwa` injects its service worker via the webpack hook; Next 16 builds with **Turbopack**, which ignores it. Worse, the `turbopack: { root }` key suppresses the fatal warning Next would otherwise raise. Verified by running `npm run build`: output says "Next.js 16.2.9 (Turbopack)" and `public/` contains no `sw.js` or workbox files. No precache, no registration, no offline launch. `npm run check` passes because tests only validate manifest JSON (`tests/field-reliability.test.ts:61`).
- Consequence chain (all confirmed):
  - `src/components/wine/field-capture-experience.tsx:264` — offline label scan failure **discards the photo** (`setImageDataUrl(null)` in the catch).
  - `src/components/jarvis/voice-tasting-capture.tsx:331` — Save is gated on an online-only preview, so the offline queue branch is **unreachable** for offline dictation.
  - `src/components/jarvis/voice-tasting-capture.tsx:155` — interim speech results are appended cumulatively, **garbling transcripts** ("ninety ninety six ninety six points").
  - `src/app/api/field-capture/save/route.ts:368` — catch-all returns **400 for every error** including Supabase outages, so the client's queue classifier (`src/lib/field-capture-sync.ts:10`, queues only on 0/5xx) treats server failures as user errors and never queues them.
  - `src/components/wine/field-capture-experience.tsx:296` — queued photo evidence (up to ~5.5M chars) will blow the ~5MB localStorage quota, especially iOS.
  - `src/lib/offline-field-capture-drafts.ts:113` — queue silently drops the oldest draft past 20 entries (a trade tasting is exactly 20+ wines).
  - When the SW is restored: `reloadOnOnline: true` (`next.config.ts:9`) will hard-reload the page on every connectivity flap, wiping in-progress forms — disable it first.

### Demo data can poison the real cellar (confirmed)
- `src/components/wine/acquisition-receipt-panel.tsx:50` — the flagship **Add Purchase** CTA opens a panel pre-filled with a hardcoded demo receipt (Benchmark Wine Shop, 3 bottles). One tap of "Save receipt" inserts **real `cellar_inventory` rows and "verified" price observations** (`src/app/api/acquisition-receipts/route.ts:165,169`).
- `src/components/wine/field-capture-experience.tsx:175` — descriptors/notes initialize to demo constants unconditionally, and after a live scan fall back to them (`|| initialDescriptors` at :238-239). A real capture can save **"One of the best wines ever."** as genuine tasting memory, poisoning the taste genome.
- `src/components/wine/wine-list-advisor.tsx:87` and `shopping-mode-panel.tsx:69` boot with "Fixture Steakhouse"/demo text — the flagship intelligence page reads as a perpetual demo.

### The taste-learning loop is not real (confirmed)
- `supabase/functions/refresh-profile/index.ts:79` is the **only writer** of `taste_profile`, and nothing anywhere invokes it. Readers on 4 live surfaces (`api/taste-genome/route.ts:83`, `shopping-mode/route.ts:66`, `restaurant-mode/route.ts:93`, `advise-list/index.ts:94`) silently null-degrade to a default palate.
- `scripts/seed-brian-fit.ts:25` is the only writer of `brian_taste_profiles` — Brian-Fit badges, recommendations, and Bottle Brain run on a **hand-seeded, frozen** profile. Ratings and captures never update it.
- Three taste systems total (`brian_taste_profiles`, `taste_profile`, live `buildTasteGenome`) — none closes the loop.

### Brand typography has never rendered (confirmed)
- `src/app/globals.css:9` — `@theme` maps `--font-sans` to the template's `--font-geist-sans`, but `layout.tsx` loads Inter/Playfair under `--font-inter`/`--font-playfair`, and no `--font-playfair` theme key exists. All 30+ `font-playfair` headings and the body font **silently fall back to the system font**; both Google fonts download for nothing.
- Related confirmed CSS bug: capture hero gradients use `hsl(var(--primary)/0.18)` around **oklch** tokens — invalid CSS, background never renders (`field-capture-experience.tsx:421`, `capture/saved/[id]/page.tsx:158`).

---

## 3. Security — auth, RLS, AI endpoint safety

**The good news (verified exhaustively):** all 29 Next API route files verify the session with `supabase.auth.getUser()` and scope by owner; the legacy unauthenticated scan endpoint is tombstoned 410; RLS is enabled on all ~49 tables with owner-scoped policies; the wine-evidence bucket has an owner-folder policy; the cron endpoint fails closed on a missing secret (`portfolio-radar/refresh/scheduled/route.ts:37-42`); secrets stay server-side.

**Confirmed gaps:**
- **[P1]** `supabase/functions/capture-wine/index.ts:41` — calls Claude Vision with **no auth check and no rate limit** in code. The public anon key satisfies the platform JWT gateway, so credit-burn is possible under default deployment.
- **[P1]** `supabase/functions/find-more/index.ts:23` (also `advise-list:32`, `refresh-profile:21`) — falls back to `POURFOLIO_FIXTURE_OWNER_ID` when the Authorization header is absent, then runs with the **service-role key** (RLS bypass). Repo history shows a `--no-verify-jwt` + fixture-secret deploy posture existed, so this is a real footgun, not theoretical.
- **[P2]** Public signup is enabled (`signup/page.tsx:33`, no allowlist; plus Google OAuth) while `bottle-intelligence/refresh/[id]` and `acquisition-engine` call Anthropic **web search with no rate limit at all** — unmetered spend for any self-registered account.
- **[P2]** `src/lib/api-security.ts:34` — the rate limiter is a module-scope Map; on serverless it resets per instance/cold-start. The only spend control on paid vision calls is illusory.
- **[P2]** `supabase/migrations/00007_photo_storage.sql:169` — wine-photos bucket policy is a comment ("handled via dashboard"); uploads use `getPublicUrl` (`photos/upload/route.ts:92-96`). No migration asserts the bucket is private; receipts can contain PII.
- **[P2]** `00001_initial_schema.sql:193-196` — `wine_reference` is world-readable and **any authenticated user can INSERT** into the shared catalog (catalog-poisoning vector; served to everyone via the anon-key search route).
- **[P2→confirmed]** `src/lib/supabase/middleware.ts:14` — middleware **fails open** when Supabase env vars are missing (returns `next()` with no auth; the `(dashboard)` layout has no auth check of its own). Combined with placeholder clients (`client.ts:11`, `server.ts:12` silently target `placeholder.supabase.co`), a misconfigured deploy renders "graceful empty states" instead of failing loudly.
- **[P2]** `src/lib/api-security.ts:12` — hand-maintained `PROTECTED_APP_PATHS` omits `/capture` and `/intelligence` (has already drifted twice). Invert to default-protected with a public allowlist.
- **[P3]** `wines/search/route.ts:45` — raw query interpolated into PostgREST `.or()` (filter-syntax injection; low reachability, public-read table).

---

## 4. Data integrity

**Strengths:** the idempotency that exists is genuinely race-safe (partial unique indexes + 23505 replay, migrations 00011/00021); the outcome ledger (00023) is a model write path with a CHECK constraint enforcing the no-truth-overwrite policy; enum CHECKs and window-ordering constraints throughout; the CellarTracker CLI defaults to dry-run with batch-stamped cleanup SQL.

**Confirmed corruption/drift vectors:**
- **[P1]** `src/lib/hooks/use-cellar.ts:170` — consume sets `quantity: 0` unconditionally. A 6-bottle lot loses 5 bottles of history; no consumption ledger exists (`purchases` table has **zero writers**); restore asks the user to guess.
- **[P1]** `field-capture/save/route.ts:229` — idempotency covers tastings/ratings but **not** the `cellar_inventory` insert that precedes them. A retry after partial failure duplicates bottles (and a replay after the tasting insert permanently skips buy-again/acquisition writes).
- **[P1]** `acquisition-receipts/route.ts:156-189` — receipt POST is sequential inserts with **no transaction and no idempotency key**; mid-loop failure + retry duplicates bottles and price evidence wholesale.
- **[P2]** `find-more/index.ts:106` and `field-capture/save/route.ts:308,331` — automated upserts hardcode `status:'active'`/`'watching'`, silently **clobbering acquired/dismissed/ordered** state Brian set.
- **[P2]** `00013_..._sprint_a.sql:18` — the wines dedupe index is **not UNIQUE**; concurrent captures can split one wine identity across two rows.
- **[P2]** `00014_..._sprint_b.sql` — the `price_observations` table that receives Claude web-search output has **no truth_label/review_status**; an entire AI-written table bypasses the app's own provenance policy and feeds `buy_again_queue.best_observation_id`.
- **[P2]** CellarTracker: the API route inserts with zero duplicate protection (`imports/cellartracker/route.ts:36`), and the CLI dedupe only sees `review_status='draft'` rows (`scripts/cellartracker-import.ts:156,172`) — re-running after accepting a batch doubles evidence.
- **[P2]** One field capture dual-writes the two parallel wine models (`ratings` + `tastings`) non-atomically, linked only by JSON (`save/route.ts:271-279`) — no FK, phantom links after deletes.
- **[P3]** Cellar-totals trigger leaves the source cellar stale when a bottle moves cellars (`00001:270`); `friendships` uniqueness misses the reversed pair (`00006:12`).
- **Refuted (for the record):** "two valuation sources never reconcile" as stated — a manual "Use as current market value" apply path exists (`price-evidence-panel.tsx:233-237` → `cellar/[id]/page.tsx:1269`) and the separation is deliberate trust policy. The *real* residual gap is that /analytics (`portfolio-truth.ts:88,198`) never consumes the accepted-evidence rollup — a confirmed P1 vision gap, documented as deferred.

---

## 5. Roadmap vs implementation ("complete" is ~two-thirds earned)

Every phase has real, tested code — this is not fake completion — but "Done" consistently means "the Portfolio Radar code path works," not "the app works this way."

| North Star stage | Reality |
|---|---|
| Evidence | Solid for manual/reviewed observations. Automated acquisition doesn't exist: the AI refresh returns findings without persisting them (`bottle-intelligence/refresh/[id]/route.ts:145` writes only telemetry); `wine_intelligence_evidence` (00012) has **zero readers or writers**. |
| Derived intelligence | Strongest stage. But Readiness Engine v2 is consumed **only by Radar** — cellar page (`cellar-command-center.ts:41`), Bottle Brain (`:279`), Bottle Intelligence (`:527`) still run the legacy 5-state model, so surfaces contradict each other. |
| Insight/Action | Derived-only (cellar_insights/cellar_actions deliberately deferred); snooze is per-mount React state (`portfolio-radar-panel.tsx:204`) despite a "24 hours" toast. |
| Outcome | Durable and well-engineered but narrow: only opened/dismissed from one panel. Maturity feedback (too_young/ideal/fading/dead) exists in schema+API (`outcomes/route.ts:42`, 00023:34) with **zero UI**; no bottle timeline. |
| Learning | Weakest claim: Radar-row suppression, full stop (`portfolio-radar-outcomes.ts:243`). Outcomes never touch Taste Genome, replenishment, or price thresholds. |

Biggest single overclaim: **Phase 5 "Automated Refresh Queue" never refreshes anything** — `record_only` is the sole mode (`portfolio-radar-refresh-runner.ts:10`, `provider_status` hardcodes `executed:false`); planned rows accumulate with no executor; daily summaries are returned to a Netlify cron log nobody reads (no GET endpoint, no UI).

Also confirmed: the roadmap's own status table (`docs/roadmaps/pourfolio-intelligence-os-roadmap.md:949`) admits the 00022 production migration was never applied while line 962 declares the roadmap complete — and the code's silent table-missing fallbacks (`portfolio-radar/route.ts:128-133`) mean Phases 3/5/6 could be no-ops in production right now without visible signal. Meanwhile `ROADMAP.md` still shows every checkbox unchecked including shipped features — three roadmap docs disagree on state.

Five surfaces emit `/intelligence?wine_id=…&action=find-more` deep links (the marquee post-capture CTA), and the intelligence page consumes **no** searchParams (`intelligence/page.tsx:16`) — every parameter is silently dropped.

---

## 6. Architecture & maintainability (honest grade: C+ shell around a B+ core)

**Strengths:** business logic in pure `src/lib` modules with matching tests (45 files, hermetic, all pass on clean clone); the `jarvis` module is exemplary (typed access-state union, queries/mutations/validators split, zod at boundaries); migrations disciplined; zod in 16 of 30 routes.

**Liabilities (confirmed):**
- **[P1]** `src/types/database.ts` is hand-written and covers **21 of 49 tables** → 133 `as any` casts; `portfolio-radar/route.ts:19` literally declares `type SupabaseAnyClient = any`. TypeScript is off exactly where bugs live. Fix: `supabase gen types typescript` + delete the casts.
- **[P1]** Two parallel wine domain models (wine_reference/cellar_inventory/ratings vs wines/tastings from 00013), bridged by `wine-reference-linking.ts` and dual-written non-atomically in field-capture save.
- **[P2]** Label extraction implemented twice with divergent schemas/models/parsers (`api/label/scan` vs `capture-wine` edge function — the latter's only caller is dead code).
- **[P2]** `requireUser()` copy-pasted in 10+ route files; row-mappers tripled; markdown-fence JSON stripping duplicated.
- **[P2]** Four coexisting client data-fetch patterns; the newest features bypass react-query with hand-rolled useEffect+fetch (32 raw `fetch('/api')` sites).
- **[P2]** No Anthropic gateway: three model IDs (receipt/scan pins stale `claude-sonnet-4-20250514`, ignoring `ANTHROPIC_MODEL`), four response parsers, telemetry on one route only.
- **[P2]** `cellar/[id]/page.tsx` is a 1,717-line client god file (20 useState hooks, 3 data patterns). Next: analytics (1,057), field-capture-experience (775), use-social (736).
- **[P3]** zustand is a declared dependency with zero imports.

---

## 7. UI/UX — does it feel premium?

The intelligence-era screens share a real, distinctive language (28px-radius glass cards, tracked kickers, burgundy/champagne tokens), and Tonight Engine's transparent scoring is premium information design. Three structural problems undermine it:

1. **The brand fonts never render** (§2 above) — the single cheapest perceived-quality fix in the codebase.
2. **Two design eras stitched together:** pastel `bg-orange-50` CRUD-era panels (`alerts-dashboard.tsx:61`), emoji tiles on /scan, native `<select>`s, amber banners, plus hardcoded rgba() and *invalid* hsl(oklch) gradients — three conventions coexist.
3. **Narration bloat:** a static "What matters now / Best next move / Risk if ignored" block is pasted on **17 screens**, mostly self-referential copy (Settings warns about itself). Combined with 28-30px card titles and a mandatory narration panel per wine card (`wine-card.tsx:104,146-162`), the cellar list is ~400px per card — unscannable at 100 bottles — while quantity controls are 28px (sub-44px touch minimum).

**Mobile/field specifics (confirmed):** header nav is `hidden lg:flex` (`header.tsx:71`) and MobileNav is `md:hidden` with 5 tabs → on phones, Tonight/Ratings/Analytics/Bottle Brain/Shopping/Wishlist/Visits/Social have no nav entry, and **768-1023px (iPad portrait) has no navigation at all**. No safe-area inset (and no `viewport-fit=cover`), emoji nav icons, pinch-zoom disabled app-wide (`layout.tsx:63`), dark mode fully defined but unreachable (no ThemeProvider) and off-brand stock shadcn if enabled — for a dinner-table app, a permanently white screen at night.

Also: fake 100-bottle capacity bar on the dashboard (`page.tsx:402`), four loading-state paradigms, empty AlertsDashboard wrapper artifact (`cellar/page.tsx:279`).

---

## 8. Dead code, duplication, partial features (~95% of the codebase is live)

- **Dead:** `GreatWineCapture` (unimported; fetches a nonexistent endpoint; save button wired to nothing); 3 of 4 Supabase edge functions never invoked (capture-wine, find-more, refresh-profile); blind-tasting page orphaned from all nav (334 lines, plus a scoring bug — reads `varietal`, column is `grape_varieties`, so varietal points are always 0); the unreachable no-cellar welcome branch with its `/onboarding` 404 link (verified unreachable: middleware redirects authed "/" to /cellar).
- **Zombie schema:** 5 tables with zero app references — `purchases`, `portfolio_snapshots`, `price_alerts`, `notification_log`, `wine_intelligence_evidence`. Two are exactly the ledgers the product needs (purchases, snapshots) — wire them or drop them.
- **Repo weight:** 173MB of winemag CSV/JSON tracked in git under `archive/`; 123MB referenced by nothing.
- **Hard 404s:** `/visits/[id]`, `/visits/[id]/edit` (`visits/page.tsx:188,261,264`), `/wishlist/[id]` (`wishlist/page.tsx:261`).
- **Stubs presented as live:** Settings Export button is a coming-soon toast (`data-tools.tsx:33`); barcode scan is the featured default intake with no data source behind it (`scan/page.tsx:162`; zero barcodes seeded, no UPC lookup).
- **Write-only data:** memory-mode field captures insert `tastings` rows that **no page ever lists** — restaurant memories vanish after the confirmation screen.
- **Triplication:** three CSV import paths (Settings DataTools, CLI script, UI-less API route) with different semantics; two label-scan UIs; two user-profile tables (`profiles` vs `user_profiles` — Settings writes one, social reads the other, so a name change never appears to friends).

---

## 9. Production readiness

**Verified good:** `npm ci && typecheck && lint && tests && next build` all pass on a clean clone with zero env files; no `ignoreBuildErrors` escape hatches; cron fails closed; secrets server-side only; migration-order checker exists.

**Confirmed gaps:**
- **[P1] No CI.** `.github/` has no workflows. The elaborate `check` pipeline runs only when someone remembers, while Netlify auto-deploys every push — including autonomous-agent commits (`scripts/pourfolio-autobuild-slot.mjs`). Netlify's build does typecheck, but lint and all 43 suites have no automated gate.
- **[P2] No backup/export story** for the one irreplaceable asset. Zero mentions of backup/pg_dump/restore anywhere; the Export button is fake; migrations are hand-applied with no rollback plan.
- **[P2] Fly-blind ops:** no `netlify.toml` (deploy unreproducible from the repo); the daily radar refresh has no alerting and Netlify doesn't retry — it can be dead for months unnoticed; 35 bare `console.*` calls, no Sentry/structured logging; `label/scan/route.ts:247` returns raw `error.message` to clients.
- **[P2] Fail-open env handling** (§3) — middleware skips auth and clients target `placeholder.supabase.co` when env vars are missing.
- **[P3]** Duplicated hardcoded model IDs; `wines/search` uses `!` assertions at module scope.

---

## 10. Ranked recommendations

All three strategy lenses converged on the same top moves. Ordered by leverage within each horizon.

### Quick wins (days, high visible payoff)
1. **Purge demo/fixture data from every real write path.** Empty defaults in acquisition-receipt-panel, wine-list-advisor, shopping-mode-panel; gate field-capture descriptors/notes on `initialDemo` and drop the `||` fallbacks; delete `GreatWineCapture`; add an explicit "Load sample" affordance; add a test that no fixture constant reaches a POST. Audit existing rows for fixture-sourced data.
2. **Ship the brand.** Map `--font-inter`/`--font-playfair` into `@theme`; fix the invalid hsl(oklch) gradients; delete the static narration blocks (keep only data-driven instances); compact wine cards (text-lg titles, status chip instead of narration panel, 44px quantity controls, compact list view); kill the fake capacity bar; fix the empty-alerts wrapper artifact.
3. **Install the deploy gate.** `.github/workflows/ci.yml` running `npm run check` on push/PR; commit `netlify.toml`; post-build assertion that `public/sw.js` exists; fail-loud env handling (no placeholder clients in production).
4. **Kill the dead ends.** Consume `wine_id`/`action` searchParams on /intelligence (5 surfaces already emit them); build or de-link visits/wishlist detail routes; demote barcode scan until a UPC source exists; nav-link blind tasting (fix `grape_varieties`) or delete it; delete the unreachable /onboarding branch; make Export real or hide it; sync ROADMAP.md with reality.

### Important fixes (must do soon — security, data, field reliability)
5. **Resurrect the PWA and make capture offline-first.** Replace next-pwa with Serwist (Turbopack-compatible) or build with webpack; set `reloadOnOnline: false`; never discard the photo on scan failure — queue it (IndexedDB, not localStorage) and parse at sync; let voice transcripts queue without online preview; fix the interim-results concatenation bug; return 5xx (not 400) from save-route failures; auto-sync on reconnect + global pending-drafts badge; don't silently drop the 21st draft.
6. **Harden the write paths.** Consume decrements quantity + writes a consumption event (start using the orphaned `purchases` ledger); extend idempotency to the `cellar_inventory` insert (or wrap the multi-table save in a Postgres RPC); idempotency key + transaction on acquisition-receipts; make `idx_wines_dedupe` UNIQUE; stop find-more/field-capture upserts resetting acquired/dismissed/ordered statuses.
7. **Lock down spend and access.** Delete the three uninvoked edge functions (or add in-function JWT verification and remove the `POURFOLIO_FIXTURE_OWNER_ID` fallbacks); disable public signup / allowlist one email; durable rate limiting (Supabase table or Upstash) + per-day spend caps on the unmetered web-search routes; private wine-photos bucket migration + signed URLs; default-protected middleware matcher.
8. **One readiness truth, one valuation truth.** Wire Readiness Engine v2 into cellar-command-center, Bottle Brain, and Bottle Intelligence; switch portfolio-truth/analytics to the accepted-evidence rollup with per-number provenance; verify/apply 00022+00023 in production and surface `tableReady=false` instead of silent degradation.
9. **Make the phone a first-class citizen.** Mobile "More" sheet; fix the 768-1024px nav dead zone; lucide icons + safe-area inset + `viewport-fit=cover`; re-enable pinch zoom; wine-toned dark mode with a toggle (the field/restaurant use case demands it).
10. **Backup + export.** Scheduled dump of core tables to external storage; implement the Settings export for real; document restore; track prod schema state with the Supabase CLI.

### Strategic (product leaps — "next level")
11. **One living palate.** Collapse the three taste systems into one canonical profile, recomputed after every rating/consume/capture (port refresh-profile's logic into a lib function + nightly cron); Brian-Fit, Tonight, Restaurant, and Shopping all read it; show "learned from your last N tastings" provenance so the learning is visible.
12. **Close the buying loop.** Mark-purchased → one-tap add-to-cellar (inventory + price observation + purchases ledger); a real Add Purchase route (not an anchor into the heavy intelligence page); CellarTracker import UI in Settings using the CLI's safe dedupe/batch semantics, persisting the drink-window drafts the API currently drops.
13. **Turn the refresh queue into a daily concierge.** Build the executor (budget-capped, transitions planned→completed); persist AI-discovered drink windows and prices as **draft evidence** into the existing review panels (today paid tokens produce nothing durable); render "this morning Pourfolio checked 6 bottles — 2 entered their window" on the dashboard.
14. **Give memories a home + close the outcome loop.** A tasting journal listing the write-only `tastings` rows with photos/place; action-history timeline on bottle detail; one-tap maturity chips (too young/ideal/fading/dead) in the consume+rate flow feeding `maturityFeedback` → readiness confidence; persist Tonight/restaurant choices as outcomes with a next-morning "how was it?" prompt.

### Tech debt (tracked, batched)
15. **Consolidation week:** generated DB types (kill 133 `as any` + `SupabaseAnyClient`); `src/lib/api/` for requireUser + row-mappers; one Anthropic gateway (single env-driven model ID, one JSON parser, cost telemetry everywhere); standardize intelligence panels on react-query.
16. **Deletions:** 5 zombie tables (or wire purchases/snapshots), 123MB unreferenced archive files (+ LFS for the seed CSV), zustand, merge profiles/user_profiles, decide the dual wine model before more features straddle it.
17. **Split the god files:** cellar/[id] (1,717 lines) into a server shell + client islands; same treatment for analytics.

### Refuted findings (for transparency)
- "/onboarding 404 is a P1 new-user dead end" — the branch is unreachable (middleware redirects authed "/" to /cellar). Downgraded to dead code.
- "Valuation sources never reconcile" — a deliberate manual apply path exists; residual gap is analytics-side only.
- "SW runtime caching is dangerous" — moot; the SW never builds (superseded by the P0).

---

*Generated by a 145-agent orchestrated review (9 reviewers, 128 adversarial verifications, 3 strategy lenses + synthesis). Raw material: workflow run `wf_7ee6797b-aae`.*
