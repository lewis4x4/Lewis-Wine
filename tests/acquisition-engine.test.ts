import assert from "node:assert/strict";
import {
  buildAcquisitionEngine,
  buildAcquisitionSearchRecord,
  nextAcquisitionStatus,
  normalizeAcquisitionPriceCandidate,
  normalizeAcquisitionPriceCandidates,
  type AcquisitionEngineInput,
} from "../src/lib/acquisition-engine";

const input: AcquisitionEngineInput = {
  asOf: "2026-06-24T12:00:00.000Z",
  targets: [
    {
      id: "tapiz-target",
      wineTitle: "2021 Tapiz Alta Collection Cabernet Sauvignon",
      producer: "Tapiz",
      sourceKind: "buy_again",
      status: "watching",
      targetPriceCents: 9500,
      maxPriceCents: 11000,
      desiredQuantity: 6,
      priority: "must_have",
      nextRefreshAt: "2026-06-20T12:00:00.000Z",
    },
    {
      id: "lewis-target",
      wineTitle: "2020 Lewis Cellars Reserve Cabernet",
      producer: "Lewis Cellars",
      sourceKind: "wishlist",
      status: "watching",
      targetPriceCents: 18000,
      maxPriceCents: 22000,
      desiredQuantity: 2,
      priority: "high",
      nextRefreshAt: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "ordered-target",
      wineTitle: "2021 Benchmark Malbec",
      producer: "Fixture Producer",
      sourceKind: "restaurant_discovery",
      status: "ordered",
      targetPriceCents: 7000,
      desiredQuantity: 3,
      priority: "medium",
      nextRefreshAt: null,
    },
    {
      id: "passed-target",
      wineTitle: "2021 Miss Merlot",
      producer: "Avoid Producer",
      sourceKind: "manual",
      status: "passed",
      targetPriceCents: 4500,
      desiredQuantity: 1,
      priority: "low",
      nextRefreshAt: "2026-06-01T12:00:00.000Z",
    },
  ],
  priceObservations: [
    {
      id: "tapiz-retailer",
      targetId: "tapiz-target",
      observedPriceCents: 9200,
      sourceName: "Benchmark Retailer",
      sourceUrl: "https://example.com/tapiz",
      availability: "available",
      confidence: 88,
      observedAt: "2026-06-23T12:00:00.000Z",
    },
    {
      id: "lewis-old",
      targetId: "lewis-target",
      observedPriceCents: 25000,
      sourceName: "Old Retailer",
      sourceUrl: null,
      availability: "available",
      confidence: 62,
      observedAt: "2026-04-01T12:00:00.000Z",
    },
  ],
};

const engine = buildAcquisitionEngine(input);

assert.equal(engine.summary.totalTargets, 4);
assert.equal(engine.summary.buyNowCount, 1);
assert.equal(engine.summary.refreshDueCount, 2);
assert.equal(engine.summary.estimatedBuyNowSpendCents, 55200);
assert.equal(engine.lanes.buyNow[0].id, "tapiz-target");
assert.equal(engine.lanes.buyNow[0].decision, "buy_now");
assert.equal(engine.lanes.buyNow[0].bestPriceLabel, "$92");
assert.equal(engine.lanes.buyNow[0].valueLabel, "below target");
assert.equal(engine.lanes.watch[0].id, "lewis-target");
assert.equal(engine.lanes.ordered[0].id, "ordered-target");
assert.equal(engine.lanes.passed[0].id, "passed-target");
assert.deepEqual(engine.refreshQueue.map((item) => item.id), ["tapiz-target", "lewis-target"]);
assert.equal(engine.refreshQueue[0].refreshReason, "refresh scheduled");
assert.equal(engine.refreshQueue[1].refreshReason, "price evidence stale");
assert.equal(nextAcquisitionStatus("watching", "mark_ordered"), "ordered");
assert.equal(nextAcquisitionStatus("ordered", "mark_acquired"), "acquired");
assert.equal(nextAcquisitionStatus("watching", "pass"), "passed");
assert.equal(nextAcquisitionStatus("passed", "reopen"), "watching");

const searchRecord = buildAcquisitionSearchRecord(input.targets[0]);
assert.deepEqual(searchRecord, {
  id: "tapiz-target",
  title: "2021 Tapiz Alta Collection Cabernet Sauvignon",
  producer: "Tapiz",
  vintage: null,
  region: null,
  varietal: null,
  desiredQuantity: 6,
  targetPriceCents: 9500,
  maxPriceCents: 11000,
  priority: "must_have",
  sourceKind: "buy_again",
});

const retailerCandidate = normalizeAcquisitionPriceCandidate({
  title: "Tapiz Alta Collection Cabernet Sauvignon",
  url: "https://www.wine.com/product/tapiz-alta-collection-cabernet-sauvignon/123",
  sourceType: "ai_search",
  extractedText: "Retailer listing shows available at $92.",
  priceCents: 9200,
  currency: "usd",
  confidence: 86,
});
assert.equal(retailerCandidate.sourceType, "retailer");
assert.equal(retailerCandidate.sourceName, "wine.com");
assert.equal(retailerCandidate.observedPriceCents, 9200);
assert.equal(retailerCandidate.currency, "USD");
assert.equal(retailerCandidate.availability, "available");

const unsupportedAiPrice = normalizeAcquisitionPriceCandidate({
  title: "AI estimate without citation",
  sourceType: "ai_inferred",
  extractedText: "Model estimate, no source.",
  priceCents: 12000,
  confidence: 70,
});
assert.equal(unsupportedAiPrice.observedPriceCents, null);
assert.equal(unsupportedAiPrice.sourceType, "ai_inferred");

const protectedSourcePrice = normalizeAcquisitionPriceCandidate({
  title: "Vivino listing should not become trusted evidence",
  url: "https://www.vivino.com/US/en/example/w/12345",
  sourceType: "ai_search",
  priceCents: 9900,
  confidence: 80,
});
assert.equal(protectedSourcePrice.sourceType, "public_web");
assert.equal(protectedSourcePrice.observedPriceCents, null);

const normalizedBatch = normalizeAcquisitionPriceCandidates([unsupportedAiPrice.rawPayload]);
assert.equal(normalizedBatch.observations.length, 1);
assert.match(normalizedBatch.gaps.join(" "), /No usable current price/);

console.log("acquisition-engine tests passed");
