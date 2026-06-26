import assert from "node:assert/strict";
import {
  buildBuyAgainCommandCenter,
  buyAgainItemToAcquisitionTarget,
  nextBuyAgainStatus,
  type BuyAgainQueueRow,
} from "../src/lib/buy-again-command-center";

const rows: BuyAgainQueueRow[] = [
  {
    id: "q-buy",
    wine_id: "wine-buy",
    status: "active",
    target_price: 30,
    updated_at: "2026-06-24T12:00:00Z",
    wine: {
      producer: "Tapiz",
      label: "Alta Collection Cabernet Sauvignon",
      vintage: 2021,
      region: "Mendoza",
      varietal: "Cabernet Sauvignon",
    },
    best_observation: {
      id: "obs-best",
      source_name: "ABC Fine Wine & Spirits",
      source_url: "https://example.com/tapiz",
      price: 18.99,
      currency: "USD",
      availability: "in_stock",
      confidence: 0.93,
      observed_at: "2026-06-24T12:00:00Z",
    },
    observations: [
      { id: "obs-best", source_name: "ABC Fine Wine & Spirits", source_url: "https://example.com/tapiz", price: 18.99, currency: "USD", availability: "in_stock", confidence: 0.93, observed_at: "2026-06-24T12:00:00Z" },
      { id: "obs-old", source_name: "Wine.com", source_url: "https://example.com/old", price: 29.99, currency: "USD", availability: "limited", confidence: 0.72, observed_at: "2026-06-20T12:00:00Z" },
    ],
  },
  {
    id: "q-watch",
    wine_id: "wine-watch",
    status: "watch",
    target_price: 75,
    updated_at: "2026-06-24T12:00:00Z",
    wine: { producer: "Lewis Cellars", label: "Reserve Cabernet", vintage: 2020, region: "Napa", varietal: "Cabernet Sauvignon" },
    best_observation: { id: "obs-watch", source_name: "Retailer", source_url: "https://example.com/lewis", price: 119, currency: "USD", availability: "unknown", confidence: 0.61, observed_at: "2026-06-23T12:00:00Z" },
    observations: [],
  },
  {
    id: "q-acquired",
    wine_id: "wine-acquired",
    status: "acquired",
    target_price: null,
    updated_at: "2026-06-24T12:00:00Z",
    wine: { producer: "Ridge", label: "Monte Bello", vintage: 2019, region: "Santa Cruz", varietal: "Cabernet Sauvignon" },
    best_observation: null,
    observations: [],
  },
  {
    id: "q-dismissed",
    wine_id: "wine-dismissed",
    status: "dismissed",
    target_price: null,
    updated_at: "2026-06-24T12:00:00Z",
    wine: { producer: "Miss", label: "Merlot", vintage: 2022, region: "Unknown", varietal: "Merlot" },
    best_observation: null,
    observations: [],
  },
];

function testBuildsOperationalLanes() {
  const center = buildBuyAgainCommandCenter(rows, { asOf: new Date("2026-06-24T12:00:00Z") });

  assert.equal(center.summary.totalActive, 2);
  assert.equal(center.summary.buyNowCount, 1);
  assert.equal(center.summary.watchCount, 1);
  assert.equal(center.summary.acquiredCount, 1);
  assert.equal(center.summary.dismissedCount, 1);
  assert.equal(center.lanes.buyNow[0].id, "q-buy");
  assert.equal(center.lanes.buyNow[0].cta.label, "Buy now");
  assert.equal(center.lanes.watch[0].id, "q-watch");
  assert.equal(center.lanes.acquired[0].id, "q-acquired");
  assert.equal(center.lanes.dismissed[0].id, "q-dismissed");
}

function testPriceHistoryAndConfidence() {
  const center = buildBuyAgainCommandCenter(rows, { asOf: new Date("2026-06-24T12:00:00Z") });
  const item = center.lanes.buyNow[0];

  assert.equal(item.title, "2021 Tapiz Alta Collection Cabernet Sauvignon");
  assert.equal(item.bestPriceLabel, "$18.99");
  assert.equal(item.confidenceLabel, "high confidence");
  assert.equal(item.priceHistory.length, 2);
  assert.equal(item.priceHistory[0].priceLabel, "$18.99");
  assert.ok(item.reasons.some((reason) => reason.includes("below target")));
}

function testStatusTransitions() {
  assert.deepEqual(nextBuyAgainStatus("buy-now"), { status: "active", acquired_at: null, dismissed_at: null });
  assert.deepEqual(nextBuyAgainStatus("watch"), { status: "watch", acquired_at: null, dismissed_at: null });
  assert.equal(nextBuyAgainStatus("acquired").status, "acquired");
  assert.ok(nextBuyAgainStatus("acquired").acquired_at);
  assert.equal(nextBuyAgainStatus("dismissed").status, "dismissed");
  assert.ok(nextBuyAgainStatus("dismissed").dismissed_at);
}

function testBuyAgainConvertsToAcquisitionTarget() {
  const payload = buyAgainItemToAcquisitionTarget(rows[0], { desiredQuantity: 3 });

  assert.equal(payload.sourceKind, "buy_again");
  assert.equal(payload.sourceId, "q-buy");
  assert.equal(payload.wineTitle, "2021 Tapiz Alta Collection Cabernet Sauvignon");
  assert.equal(payload.status, "buy_now");
  assert.equal(payload.priority, "must_have");
  assert.equal(payload.desiredQuantity, 3);
  assert.equal(payload.targetPriceCents, 3000);
  assert.equal(payload.maxPriceCents, 3600);
  assert.match(payload.notes ?? "", /Buy Again/);
}

testBuildsOperationalLanes();
testPriceHistoryAndConfidence();
testStatusTransitions();
testBuyAgainConvertsToAcquisitionTarget();

console.log("buy-again-command-center tests passed");
