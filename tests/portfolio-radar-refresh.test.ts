import assert from "node:assert/strict";
import {
  buildPortfolioRefreshQueue,
  type PortfolioRefreshCellarItem,
  type PortfolioRefreshRecord,
} from "../src/lib/portfolio-radar-refresh";
import type { PriceObservation } from "../src/lib/current-intelligence/price-observations";

const asOf = "2026-06-24T12:00:00.000Z";

function cellar(overrides: Partial<PortfolioRefreshCellarItem>): PortfolioRefreshCellarItem {
  return {
    id: overrides.id ?? "cellar-1",
    displayName: "Fixture Cabernet",
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

function refresh(overrides: Partial<PortfolioRefreshRecord> & { inventoryId: string }): PortfolioRefreshRecord {
  return {
    id: overrides.id ?? `refresh-${overrides.inventoryId}`,
    inventoryId: overrides.inventoryId,
    scope: overrides.scope ?? "pricing",
    status: overrides.status ?? "completed",
    startedAt: overrides.startedAt ?? "2026-06-23T12:00:00.000Z",
    completedAt: overrides.completedAt ?? overrides.startedAt ?? "2026-06-23T12:00:00.000Z",
  };
}

function testPlannerRanksDailyRefreshWorkAndEnforcesBudget() {
  const plan = buildPortfolioRefreshQueue({
    asOf,
    budget: { maxItems: 3, maxCostUnits: 7 },
    cellar: [
      cellar({ id: "past-peak", displayName: "Past Peak Bordeaux", readinessPhase: "past_peak", drinkBefore: "2024", purchasePriceCents: 9_000 }),
      cellar({ id: "high-value", displayName: "High Value Cabernet", quantity: 2, purchasePriceCents: 30_000, brianFitScore: 78 }),
      cellar({ id: "stale-market", displayName: "Stale Market Brunello", purchasePriceCents: 14_000 }),
      cellar({ id: "replacement-only", displayName: "Replacement Only Pinot", purchasePriceCents: null }),
    ],
    priceObservations: [
      price({ id: "past-peak-market", inventoryId: "past-peak", observedPriceCents: 11_000 }),
      price({ id: "stale-market-price", inventoryId: "stale-market", observedAt: "2025-10-01T12:00:00.000Z" }),
      price({
        id: "replacement-price",
        inventoryId: "replacement-only",
        sourceType: "retailer",
        observationKind: "replacement_price",
        truthLabel: "estimated",
        observedPriceCents: 7_000,
        observedAt: "2026-06-23T12:00:00.000Z",
      }),
    ],
  });

  assert.deepEqual(plan.items.map((item) => item.inventoryId), ["past-peak", "stale-market", "high-value"]);
  assert.equal(plan.summary.dueCount, 3);
  assert.equal(plan.summary.deferredCount, 1);
  assert.equal(plan.summary.estimatedCostUnits, 7);
  assert.equal(plan.items[0].scope, "readiness");
  assert.ok(plan.items[0].reasons.includes("readiness_transition"));
  assert.ok(plan.items[1].reasons.includes("stale_market_value"));
  assert.ok(plan.items[2].reasons.includes("high_value_watch"));

  const deferred = plan.skipped.find((item) => item.inventoryId === "replacement-only");
  assert.ok(deferred, "replacement-only should be deferred by budget, not lost");
  assert.ok(deferred.skipReasons.includes("budget_deferred"));
}

function testFreshReplacementPriceDoesNotMaskMissingMarketValue() {
  const plan = buildPortfolioRefreshQueue({
    asOf,
    budget: { maxItems: 5, maxCostUnits: 20 },
    cellar: [cellar({ id: "replacement-only", displayName: "Replacement Only Pinot", purchasePriceCents: null })],
    priceObservations: [
      price({
        id: "fresh-replacement",
        inventoryId: "replacement-only",
        sourceType: "retailer",
        observationKind: "replacement_price",
        truthLabel: "estimated",
        observedPriceCents: 7_000,
        observedAt: "2026-06-23T12:00:00.000Z",
      }),
    ],
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].inventoryId, "replacement-only");
  assert.equal(plan.items[0].scope, "pricing");
  assert.ok(plan.items[0].reasons.includes("missing_market_value"));
  assert.equal(plan.skipped.some((item) => item.inventoryId === "replacement-only"), false);
}

function testCooldownAndReviewQueueReturnExplicitSkipReasons() {
  const plan = buildPortfolioRefreshQueue({
    asOf,
    cellar: [
      cellar({ id: "cooldown", displayName: "Recently Refreshed Merlot", purchasePriceCents: 6_000 }),
      cellar({ id: "review-first", displayName: "Draft Evidence Barolo", evidenceAwaitingReviewCount: 2, purchasePriceCents: 11_000 }),
    ],
    priceObservations: [
      price({ id: "draft-review", inventoryId: "review-first", reviewStatus: "draft", sourceType: "retailer", observationKind: "replacement_price", truthLabel: "estimated" }),
    ],
    refreshes: [refresh({ inventoryId: "cooldown", scope: "pricing", startedAt: "2026-06-23T12:00:00.000Z" })],
  });

  assert.equal(plan.items.some((item) => item.inventoryId === "cooldown"), false);
  assert.equal(plan.items.some((item) => item.inventoryId === "review-first"), false);

  const cooldown = plan.skipped.find((item) => item.inventoryId === "cooldown");
  assert.ok(cooldown, "recently refreshed item should have a skip record");
  assert.ok(cooldown.skipReasons.includes("cooldown_active"));

  const reviewFirst = plan.skipped.find((item) => item.inventoryId === "review-first");
  assert.ok(reviewFirst, "draft evidence should have a skip record");
  assert.ok(reviewFirst.skipReasons.includes("review_pending"));
}

testPlannerRanksDailyRefreshWorkAndEnforcesBudget();
testFreshReplacementPriceDoesNotMaskMissingMarketValue();
testCooldownAndReviewQueueReturnExplicitSkipReasons();

console.log("portfolio-radar refresh planner tests passed");
