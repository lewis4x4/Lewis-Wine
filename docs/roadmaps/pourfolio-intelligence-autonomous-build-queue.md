# Pourfolio Intelligence Autonomous Build Queue

Created by: Jarvis (Hermes Agent)
Date: 2026-06-26
Related roadmap: `docs/roadmaps/pourfolio-intelligence-os-roadmap.md`
Runtime log: `docs/roadmaps/pourfolio-intelligence-autonomous-build-run-log.md` *(git-ignored)*
Lock file: `.pourfolio-autobuild/lock.json` *(git-ignored)*

## Purpose

This file gives the every-two-hours Pourfolio builder a shared queue and coordination protocol so autonomous agents do not pick up the same roadmap slice at the same time.

The runtime claim/complete markers are written by:

```bash
node scripts/pourfolio-autobuild-slot.mjs acquire --ttl-minutes 115
node scripts/pourfolio-autobuild-slot.mjs complete --summary "..." --commit "..."
node scripts/pourfolio-autobuild-slot.mjs fail --summary "..."
node scripts/pourfolio-autobuild-slot.mjs status
```

## Coordination Protocol

1. **Acquire before reading/building.** The first command in each automated run must be:
   ```bash
   node scripts/pourfolio-autobuild-slot.mjs acquire --ttl-minutes 115
   ```
2. If acquisition returns `acquired: false`, stop. Another agent owns the slot.
3. Read:
   - this queue file,
   - the main roadmap,
   - the runtime run log,
   - `git status --short --branch`.
4. Pick exactly one bounded vertical slice that can be built and verified in the slot.
5. Update this queue file only for durable roadmap status changes. Use the runtime log for transient picked-up/complete markers.
6. Before changing code, make sure the working tree is not dirty from another unfinished slice. Do not overwrite another agent’s work.
7. Use TDD for core logic.
8. Run targeted tests and `npm run check` before any commit/push when practical.
9. Routine non-destructive Pourfolio production migrations, deploys, and hosted smokes needed to finish a slice are approved when credentials and a safe path are already available; still do not change secrets, spend money, send external communications, weaken auth/RLS, or make destructive/high-risk production changes.
10. If schema work is needed, make migrations idempotent, apply/verify remote parity when safe, and pause only for destructive data changes, secrets, auth weakening, or unclear production risk.
11. On success, call `complete`. On blocker/failure/tool limit, call `fail` with the next exact command.

## Current Roadmap Position

Autonomous build status: `active`

When all actionable slices are `Done` and no row is `Next`, `Planned`, or `Blocked`, change this to:

```text
Autonomous build status: complete
```

| Order | Slice | Status | Notes |
|---:|---|---|---|
| 1 | Portfolio Radar v1 / Pourfolio Today | Done | Shipped in `44c6223 Add Portfolio Radar intelligence queue`. |
| 2 | Readiness Engine v2 | Done | Shipped in `4dee98a Add Readiness Engine v2 phase model`; Portfolio Radar consumes phase/source metadata. |
| 3 | Source-backed drink-window evidence foundation | Done | Shipped in `3e41d99 Add drink-window evidence foundation`; local migration + pure review/apply bridge, not applied to production. |
| 4 | Drink-window evidence review/apply API + Bottle Detail UI | Done | Shipped in `0b1ea59 Add drink-window evidence review UI`; authenticated API, Bottle Detail review panel, and Portfolio Radar accepted-evidence consumption. |
| 5 | Valuation Rollup + Sell-watch | Done | Shipped in `e09d6ca Add portfolio valuation sell-watch posture`; derived valuation posture rolls accepted market/replacement evidence into Portfolio Radar sell-watch without trusting AI/draft evidence. |
| 6 | Automated Refresh Queue foundation | Done | Shipped in `4e6bb44 Add automated Portfolio Radar refresh queue`; due-selection, budget controls, skip reasons, and refresh-due Portfolio Radar actions. |
| 7 | Refresh execution ledger + API | Done | Shipped in `6123c96 Add Portfolio Radar refresh runner`; authenticated record-only POST runner persists due planned rows and planner skip summaries without paid provider calls. |
| 8 | Hosted schedule trigger + daily/weekly summary | Done | Shipped in `a2ce830 Add scheduled Portfolio Radar refresh trigger`; Netlify daily scheduled function invokes a protected server-side route that generates Brian's current refresh plan, records due/skipped rows idempotently, and returns daily/weekly summaries. |
| 9 | Outcome and Learning Loop | Next | Durable Insight → Action → Outcome learning. |
| 10 | Provider and Data-source Expansion | Later | Provider integrations after the evidence/action spine is working. |

## Completion / Self-Pause Protocol

If a run sees `Autonomous build status: complete`, or it independently verifies that every actionable roadmap slice is complete:

1. Do not start a new feature slice.
2. Acquire the lock and append a `complete` run-log entry with summary `Roadmap complete; pausing autonomous builder`.
3. Pause Hermes cron job `b2e7c7c6f5ef` named `Pourfolio autonomous intelligence roadmap builder`.
4. Final response should say the roadmap is complete and the two-hour builder paused itself.

The only permitted cron-management action for the autonomous builder is pausing its own job when the roadmap is complete. It must not create, remove, or reschedule cron jobs.

## Next Default Slice

If no newer human instruction exists, the next run should start with **Outcome and Learning Loop v1**.

Minimum useful next slice:

- Define the smallest durable outcome model that can close a Portfolio Radar action without overbuilding the full action system.
- Start with drink/opening and dismiss/skip outcomes because they directly affect readiness alerts and future recommendations.
- Keep source-backed evidence separate from user feedback; an outcome may tune recommendations, but it should not silently rewrite trusted drink-window or valuation evidence.
- Surface the result where Brian can see that an action was closed and what Pourfolio learned.

## Acceptance Standard Per Slot

A slot is complete only if it leaves the repo in one of these states:

1. **Shipped:** code committed/pushed, tests passed, no cleanup pending.
2. **Committed locally:** tests passed but push/deploy is intentionally held for a clearly stated reason.
3. **Paused cleanly:** no risky/unverified changes committed; queue/log says what blocked and exactly where to resume.

Never mark a slot complete if temporary smoke users/data/files remain, the repo has accidental debug output, or the quality gate result is unknown.
