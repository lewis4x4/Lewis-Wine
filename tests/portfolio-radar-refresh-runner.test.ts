import assert from "node:assert/strict";
import type { PriceObservation } from "../src/lib/current-intelligence/price-observations";
import {
  buildPortfolioRefreshQueue,
  type PortfolioRefreshCellarItem,
} from "../src/lib/portfolio-radar-refresh";
import { buildPortfolioRefreshRun } from "../src/lib/portfolio-radar-refresh-runner";

const asOf = "2026-06-24T12:00:00.000Z";

function cellar(overrides: Partial<PortfolioRefreshCellarItem>): PortfolioRefreshCellarItem {
  return {
    id: overrides.id ?? "cellar-1",
    displayName: overrides.displayName ?? "Fixture Cabernet",
    quantity: 1,
    purchasePriceCents: 10_000,
    currentMarketValueCents: null,
    marketValueSource: null,
    marketValueUpdatedAt: null,
    drinkAfter: "2024",
    drinkBefore: "2032",
    readinessPhase: "ready",
    readinessConfidence: 80,
    acceptedPriceEvidenceCount: 0,
    stalePriceEvidenceCount: 0,
    evidenceAwaitingReviewCount: 0,
    brianFitScore: 86,
    ...overrides,
  };
}

function price(overrides: Partial<PriceObservation> & { id: string; inventoryId: string }): PriceObservation {
  return {
    id: overrides.id,
    inventoryId: overrides.inventoryId,
    wineReferenceId: overrides.wineReferenceId ?? null,
    sourceType: overrides.sourceType ?? "provider",
    sourceName: overrides.sourceName ?? "Fixture provider",
    sourceUrl: overrides.sourceUrl ?? "https://example.com/price",
    observationKind: overrides.observationKind ?? "market_value",
    truthLabel: overrides.truthLabel ?? "verified",
    reviewStatus: overrides.reviewStatus ?? "accepted",
    observedPriceCents: overrides.observedPriceCents ?? 12_000,
    currency: overrides.currency ?? "USD",
    bottleSizeMl: overrides.bottleSizeMl ?? 750,
    vintage: overrides.vintage ?? null,
    confidence: overrides.confidence ?? 86,
    observedAt: overrides.observedAt ?? "2026-06-23T12:00:00.000Z",
    notes: overrides.notes ?? null,
    rawPayload: overrides.rawPayload ?? null,
  };
}

function testRecordOnlyRunPersistsPlannedDueRowsAndSkippedSummaries() {
  const plan = buildPortfolioRefreshQueue({
    asOf,
    budget: { maxItems: 2, maxCostUnits: 5 },
    cellar: [
      cellar({ id: "stale-market", displayName: "Stale Market Brunello", purchasePriceCents: 14_000 }),
      cellar({ id: "high-value", displayName: "High Value Cabernet", quantity: 2, purchasePriceCents: 30_000 }),
      cellar({ id: "review-first", displayName: "Draft Evidence Barolo", evidenceAwaitingReviewCount: 1, purchasePriceCents: 11_000 }),
    ],
    priceObservations: [
      price({ id: "stale-market-price", inventoryId: "stale-market", observedAt: "2025-10-01T12:00:00.000Z" }),
      price({ id: "draft-review", inventoryId: "review-first", reviewStatus: "draft", sourceType: "retailer", observationKind: "replacement_price", truthLabel: "estimated" }),
    ],
  });

  const run = buildPortfolioRefreshRun({
    plan,
    asOf,
    maxItems: 1,
    includeSkipped: true,
    maxSkipped: 2,
    runId: "run-fixture",
  });

  assert.equal(run.summary.runId, "run-fixture");
  assert.equal(run.summary.mode, "record_only");
  assert.equal(run.summary.plannedCount, 1);
  assert.equal(run.summary.skippedCount, 2);
  assert.equal(run.summary.paidProviderCalls, 0);
  assert.equal(run.rows.length, 3);

  const planned = run.rows.find((row) => row.status === "planned");
  assert.ok(planned, "runner should write a planned row for the bounded due item");
  assert.equal(planned.inventory_id, "stale-market");
  assert.equal(planned.scope, "pricing");
  assert.equal(planned.completed_at, null);
  assert.deepEqual(planned.provider_status, {
    runner: "portfolio_radar_refresh_runner",
    mode: "record_only",
    executed: false,
    paidProviderCalled: false,
    reason: "refresh_due_recorded_without_paid_provider_call",
    runId: "run-fixture",
  });
  assert.ok(Array.isArray(planned.gaps));
  assert.ok(planned.gaps.some((gap) => gap.includes("No trusted market value") || gap.includes("market evidence is stale")));

  const reviewSkip = run.rows.find((row) => row.inventory_id === "review-first");
  assert.ok(reviewSkip, "review-pending skip should be persisted for summaries");
  assert.equal(reviewSkip.status, "skipped");
  assert.equal(reviewSkip.completed_at, asOf);
  assert.ok(reviewSkip.gaps.some((gap) => gap.includes("review pending")));
}

function testRunnerCanSummarizeWithoutPersistingSkippedRows() {
  const plan = buildPortfolioRefreshQueue({
    asOf,
    cellar: [cellar({ id: "replacement-only", purchasePriceCents: null })],
    priceObservations: [
      price({
        id: "fresh-replacement",
        inventoryId: "replacement-only",
        sourceType: "retailer",
        observationKind: "replacement_price",
        truthLabel: "estimated",
        observedPriceCents: 7_000,
      }),
    ],
  });

  const run = buildPortfolioRefreshRun({ plan, asOf, includeSkipped: false, runId: "no-skips" });

  assert.equal(run.summary.plannedCount, 1);
  assert.equal(run.summary.skippedCount, 0);
  assert.equal(run.rows.length, 1);
  assert.equal(run.rows[0].inventory_id, "replacement-only");
  assert.equal(run.rows[0].plan.queueItem?.reasons.includes("missing_market_value"), true);
}

testRecordOnlyRunPersistsPlannedDueRowsAndSkippedSummaries();
testRunnerCanSummarizeWithoutPersistingSkippedRows();

console.log("portfolio-radar refresh runner tests passed");
