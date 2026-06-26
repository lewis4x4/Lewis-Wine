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
9. Do not apply production Supabase migrations, change secrets, spend money, or send external communications.
10. If schema work is needed, create the local migration and tests, but pause before production migration/deploy unless the code remains backward-compatible.
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
| 3 | Source-backed drink-window evidence | Next | Structured drink-window observations/review/apply flow. |
| 4 | Valuation Rollup + Sell-watch | Planned | Accepted evidence rolls up into value posture and sell/buy-watch actions. |
| 5 | Automated Refresh Queue | Planned | Due-selection, budget controls, skip reasons, schedule. |
| 6 | Outcome and Learning Loop | Planned | Durable Insight → Action → Outcome learning. |
| 7 | Provider and Data-source Expansion | Later | Provider integrations after the evidence/action spine is working. |

## Completion / Self-Pause Protocol

If a run sees `Autonomous build status: complete`, or it independently verifies that every actionable roadmap slice is complete:

1. Do not start a new feature slice.
2. Acquire the lock and append a `complete` run-log entry with summary `Roadmap complete; pausing autonomous builder`.
3. Pause Hermes cron job `b2e7c7c6f5ef` named `Pourfolio autonomous intelligence roadmap builder`.
4. Final response should say the roadmap is complete and the two-hour builder paused itself.

The only permitted cron-management action for the autonomous builder is pausing its own job when the roadmap is complete. It must not create, remove, or reschedule cron jobs.

## Next Default Slice

If no newer human instruction exists, the next run should start with **Source-backed Drink-window Evidence**.

Minimum useful first slice:

- Add a local, idempotent migration or pure model scaffolding for structured drink-window observations, without applying production migrations automatically.
- Add helper/tests for reviewable drink-window evidence:
  - source type/name/url
  - proposed drink-after/drink-before
  - optional peak-start/peak-end
  - confidence
  - review status
  - applicability to inventory/reference readiness
- Wire the evidence shape toward Readiness Engine v2 without letting AI/public-web findings silently overwrite cellar truth.

## Acceptance Standard Per Slot

A slot is complete only if it leaves the repo in one of these states:

1. **Shipped:** code committed/pushed, tests passed, no cleanup pending.
2. **Committed locally:** tests passed but push/deploy is intentionally held for a clearly stated reason.
3. **Paused cleanly:** no risky/unverified changes committed; queue/log says what blocked and exactly where to resume.

Never mark a slot complete if temporary smoke users/data/files remain, the repo has accidental debug output, or the quality gate result is unknown.
