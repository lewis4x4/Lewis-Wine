import assert from "node:assert/strict";
import {
  buildPortfolioValuationPosture,
  type PortfolioValuationInput,
} from "../src/lib/portfolio-valuations";
import type { PriceObservation } from "../src/lib/current-intelligence/price-observations";

const asOf = "2026-06-24T12:00:00.000Z";

function observation(overrides: Partial<PriceObservation>): PriceObservation {
  return {
    id: overrides.id ?? "obs-1",
    inventoryId: overrides.inventoryId ?? "inv-1",
    wineReferenceId: overrides.wineReferenceId ?? "ref-1",
    sourceType: overrides.sourceType ?? "provider",
    sourceName: overrides.sourceName ?? "Provider",
    sourceUrl: overrides.sourceUrl ?? "https://example.com/wine",
    observationKind: overrides.observationKind ?? "market_value",
    truthLabel: overrides.truthLabel ?? "verified",
    reviewStatus: overrides.reviewStatus ?? "accepted",
    observedPriceCents: overrides.observedPriceCents ?? 18000,
    currency: overrides.currency ?? "USD",
    bottleSizeMl: overrides.bottleSizeMl ?? 750,
    vintage: overrides.vintage ?? 2019,
    confidence: overrides.confidence ?? 88,
    observedAt: overrides.observedAt ?? "2026-06-20T12:00:00.000Z",
    notes: overrides.notes ?? null,
    rawPayload: overrides.rawPayload ?? null,
  };
}

function input(overrides: Partial<PortfolioValuationInput>): PortfolioValuationInput {
  return {
    inventoryId: overrides.inventoryId ?? "inv-1",
    displayName: overrides.displayName ?? "2019 Test Cabernet",
    quantity: overrides.quantity ?? 1,
    purchasePriceCents: overrides.purchasePriceCents ?? 10000,
    storedMarketValueCents: overrides.storedMarketValueCents ?? null,
    storedMarketValueSource: overrides.storedMarketValueSource ?? null,
    storedMarketValueUpdatedAt: overrides.storedMarketValueUpdatedAt ?? null,
    brianFitScore: overrides.brianFitScore ?? 82,
    readinessPhase: overrides.readinessPhase ?? "hold",
    observations: overrides.observations ?? [],
    asOf,
  };
}

function testTrustedAcceptedEvidenceRollsUpIntoSellWatch() {
  const posture = buildPortfolioValuationPosture(input({
    quantity: 3,
    purchasePriceCents: 10000,
    brianFitScore: 78,
    readinessPhase: "hold",
    observations: [
      observation({ id: "trusted-market", observedPriceCents: 16500, confidence: 91 }),
      observation({
        id: "ai-noise",
        sourceType: "ai_inferred",
        truthLabel: "ai_inferred",
        observationKind: "estimate",
        observedPriceCents: 999999,
        confidence: 99,
      }),
    ],
  }));

  assert.equal(posture.market.valueCents, 16500);
  assert.equal(posture.market.observationId, "trusted-market");
  assert.equal(posture.market.sourceType, "provider");
  assert.equal(posture.ignoredAiEstimateCents, 999999);
  assert.equal(posture.gainLossCents, 6500);
  assert.equal(posture.gainLossPercent, 0.65);
  assert.equal(posture.valuationPhase, "sell_watch");
  assert.equal(posture.sellWatch.shouldWatch, true);
  assert.match(posture.sellWatch.reason, /65% gain/i);
  assert.match(posture.sellWatch.reason, /3 bottles/i);
}

function testDraftAndAiEvidenceCannotDriveTrustedValue() {
  const posture = buildPortfolioValuationPosture(input({
    purchasePriceCents: 10000,
    observations: [
      observation({
        id: "draft-market",
        reviewStatus: "draft",
        observedPriceCents: 21000,
      }),
      observation({
        id: "ai-estimate",
        sourceType: "ai_search",
        truthLabel: "ai_inferred",
        observationKind: "estimate",
        observedPriceCents: 23000,
      }),
    ],
  }));

  assert.equal(posture.market.valueCents, null);
  assert.equal(posture.replacement.valueCents, null);
  assert.equal(posture.valuationPhase, "estimate_only");
  assert.equal(posture.sellWatch.shouldWatch, false);
  assert.equal(posture.ignoredAiEstimateCents, 23000);
}

function testReplacementPriceDoesNotMasqueradeAsMarketValue() {
  const posture = buildPortfolioValuationPosture(input({
    purchasePriceCents: null,
    observations: [
      observation({
        id: "retailer-replacement",
        sourceType: "retailer",
        truthLabel: "estimated",
        observationKind: "replacement_price",
        observedPriceCents: 7800,
        confidence: 74,
      }),
    ],
  }));

  assert.equal(posture.market.valueCents, null);
  assert.equal(posture.replacement.valueCents, 7800);
  assert.equal(posture.replacement.observationId, "retailer-replacement");
  assert.equal(posture.valuationPhase, "replacement_known");
  assert.equal(posture.sellWatch.shouldWatch, false);
}

function testReadinessTruthSuppressesSellWatchWhenBottleShouldBeOpened() {
  const posture = buildPortfolioValuationPosture(input({
    quantity: 2,
    purchasePriceCents: 10000,
    brianFitScore: 96,
    readinessPhase: "at_peak",
    observations: [observation({ id: "market", observedPriceCents: 16000 })],
  }));

  assert.equal(posture.valuationPhase, "market_known");
  assert.equal(posture.sellWatch.shouldWatch, false);
  assert.match(posture.sellWatch.reason, /readiness is a stronger signal/i);
}

testTrustedAcceptedEvidenceRollsUpIntoSellWatch();
testDraftAndAiEvidenceCannotDriveTrustedValue();
testReplacementPriceDoesNotMasqueradeAsMarketValue();
testReadinessTruthSuppressesSellWatchWhenBottleShouldBeOpened();

console.log("portfolio-valuations tests passed");
