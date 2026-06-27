import assert from "node:assert/strict";
import {
  buildPortfolioRefreshScheduleSummary,
  type PortfolioRefreshScheduleHistoryRow,
} from "../src/lib/portfolio-radar-refresh-schedule";
import type { PortfolioRefreshRun } from "../src/lib/portfolio-radar-refresh-runner";

const asOf = "2026-06-27T12:00:00.000Z";

const run: PortfolioRefreshRun = {
  summary: {
    runId: "scheduled-2026-06-27",
    mode: "record_only",
    asOf,
    planDueCount: 3,
    planSkippedCount: 2,
    plannedCount: 2,
    skippedCount: 2,
    totalRows: 4,
    estimatedCostUnits: 6,
    paidProviderCalls: 0,
  },
  rows: [
    {
      inventory_id: "inv-ready",
      scope: "readiness",
      status: "planned",
      plan: {
        runner: "portfolio_radar_refresh_runner",
        runId: "scheduled-2026-06-27",
        mode: "record_only",
        source: "portfolio_radar_refresh_plan",
        planAsOf: asOf,
        queueItem: {
          id: "refresh:readiness:inv-ready",
          inventoryId: "inv-ready",
          label: "Ready Ridge Cabernet",
          priority: 940,
          severity: "critical",
          scope: "readiness",
          costTier: "free",
          costUnits: 1,
          reasons: ["readiness_transition"],
          expectedAction: "refresh_readiness",
          nextRefreshAt: asOf,
          cooldownUntil: null,
          targetHref: "/cellar/inv-ready?focus=valuation-refresh",
          metadata: {
            quantity: 1,
            purchasePriceCents: 12000,
            marketValueCents: null,
            replacementPriceCents: null,
            ignoredAiEstimateCents: null,
            readinessPhase: "drink_soon",
            brianFitScore: 92,
          },
        },
        skippedItem: null,
      },
      provider_status: {
        runner: "portfolio_radar_refresh_runner",
        mode: "record_only",
        executed: false,
        paidProviderCalled: false,
        reason: "refresh_due_recorded_without_paid_provider_call",
        runId: "scheduled-2026-06-27",
      },
      gaps: ["Readiness is changing and should be rechecked."],
      started_at: asOf,
      completed_at: null,
      error: null,
    },
    {
      inventory_id: "inv-market",
      scope: "pricing",
      status: "planned",
      plan: {
        runner: "portfolio_radar_refresh_runner",
        runId: "scheduled-2026-06-27",
        mode: "record_only",
        source: "portfolio_radar_refresh_plan",
        planAsOf: asOf,
        queueItem: {
          id: "refresh:pricing:inv-market",
          inventoryId: "inv-market",
          label: "Market Gap Brunello",
          priority: 880,
          severity: "high",
          scope: "pricing",
          costTier: "low",
          costUnits: 2,
          reasons: ["missing_market_value"],
          expectedAction: "refresh_pricing",
          nextRefreshAt: asOf,
          cooldownUntil: null,
          targetHref: "/cellar/inv-market?focus=valuation-refresh",
          metadata: {
            quantity: 2,
            purchasePriceCents: 18000,
            marketValueCents: null,
            replacementPriceCents: 22000,
            ignoredAiEstimateCents: null,
            readinessPhase: "ready",
            brianFitScore: 87,
          },
        },
        skippedItem: null,
      },
      provider_status: {
        runner: "portfolio_radar_refresh_runner",
        mode: "record_only",
        executed: false,
        paidProviderCalled: false,
        reason: "refresh_due_recorded_without_paid_provider_call",
        runId: "scheduled-2026-06-27",
      },
      gaps: ["No trusted market value is available."],
      started_at: asOf,
      completed_at: null,
      error: null,
    },
    {
      inventory_id: "inv-deferred",
      scope: "quick",
      status: "skipped",
      plan: {
        runner: "portfolio_radar_refresh_runner",
        runId: "scheduled-2026-06-27",
        mode: "record_only",
        source: "portfolio_radar_refresh_plan",
        planAsOf: asOf,
        queueItem: null,
        skippedItem: {
          inventoryId: "inv-deferred",
          label: "Budget Deferred Barolo",
          skipReasons: ["budget_deferred"],
          candidateReasons: ["missing_market_value"],
          priority: 760,
          cooldownUntil: null,
        },
      },
      provider_status: {
        runner: "portfolio_radar_refresh_runner",
        mode: "record_only",
        executed: false,
        paidProviderCalled: false,
        reason: "refresh_skipped_by_planner",
        runId: "scheduled-2026-06-27",
      },
      gaps: ["Skipped: budget deferred this refresh."],
      started_at: asOf,
      completed_at: asOf,
      error: null,
    },
    {
      inventory_id: "inv-review",
      scope: "quick",
      status: "skipped",
      plan: {
        runner: "portfolio_radar_refresh_runner",
        runId: "scheduled-2026-06-27",
        mode: "record_only",
        source: "portfolio_radar_refresh_plan",
        planAsOf: asOf,
        queueItem: null,
        skippedItem: {
          inventoryId: "inv-review",
          label: "Review First Rioja",
          skipReasons: ["review_pending"],
          candidateReasons: ["stale_replacement_price"],
          priority: 720,
          cooldownUntil: null,
        },
      },
      provider_status: {
        runner: "portfolio_radar_refresh_runner",
        mode: "record_only",
        executed: false,
        paidProviderCalled: false,
        reason: "refresh_skipped_by_planner",
        runId: "scheduled-2026-06-27",
      },
      gaps: ["Skipped: review pending evidence should be resolved before another refresh."],
      started_at: asOf,
      completed_at: asOf,
      error: null,
    },
  ],
};

const history: PortfolioRefreshScheduleHistoryRow[] = [
  {
    inventoryId: "inv-completed",
    label: "Completed Châteauneuf",
    scope: "pricing",
    status: "completed",
    startedAt: "2026-06-27T09:00:00.000Z",
    completedAt: "2026-06-27T09:02:00.000Z",
    gaps: [],
  },
  {
    inventoryId: "inv-failed",
    label: "Failed Napa Cab",
    scope: "deep",
    status: "failed",
    startedAt: "2026-06-27T08:00:00.000Z",
    completedAt: "2026-06-27T08:01:00.000Z",
    gaps: ["provider timeout"],
  },
  {
    inventoryId: "inv-old",
    label: "Old Success",
    scope: "pricing",
    status: "completed",
    startedAt: "2026-06-21T13:00:00.000Z",
    completedAt: "2026-06-21T13:01:00.000Z",
    gaps: [],
  },
];

function testDailySummarySeparatesDueRecordedSkippedAndChangedWork() {
  const summary = buildPortfolioRefreshScheduleSummary({
    asOf,
    window: "daily",
    run,
    recentHistory: history,
  });

  assert.equal(summary.window, "daily");
  assert.equal(summary.due.planned, 2);
  assert.equal(summary.due.deferred, 1);
  assert.equal(summary.recorded.totalRows, 4);
  assert.equal(summary.skipped.total, 2);
  assert.equal(summary.skipped.byReason.budget_deferred, 1);
  assert.equal(summary.skipped.byReason.review_pending, 1);
  assert.equal(summary.changed.completed, 1);
  assert.equal(summary.changed.failed, 1);
  assert.equal(summary.cost.paidProviderCalls, 0);
  assert.deepEqual(summary.topDueLabels, ["Ready Ridge Cabernet", "Market Gap Brunello"]);
  assert.deepEqual(summary.topSkippedLabels, ["Budget Deferred Barolo", "Review First Rioja"]);
  assert.ok(summary.narrative.some((line) => line.includes("Due: 2 recorded refresh actions")));
  assert.ok(summary.narrative.some((line) => line.includes("Skipped/deferred: 2")));
  assert.ok(summary.narrative.some((line) => line.includes("Changed in the last 24 hours: 1 completed, 1 failed")));
  assert.ok(summary.narrative.every((line) => !line.includes("/Users/")), "Brian-facing summary should not leak local paths");
}

function testWeeklySummaryUsesSevenDayLookback() {
  const summary = buildPortfolioRefreshScheduleSummary({
    asOf,
    window: "weekly",
    run,
    recentHistory: history,
  });

  assert.equal(summary.lookbackHours, 168);
  assert.equal(summary.changed.completed, 2);
  assert.equal(summary.changed.failed, 1);
  assert.ok(summary.narrative.some((line) => line.includes("last 7 days")));
}

testDailySummarySeparatesDueRecordedSkippedAndChangedWork();
testWeeklySummaryUsesSevenDayLookback();

console.log("portfolio-radar refresh schedule summary tests passed");
