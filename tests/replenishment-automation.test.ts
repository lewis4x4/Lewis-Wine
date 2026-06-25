import assert from "node:assert/strict";
import {
  buildReplenishmentAutomation,
  replenishmentPromptToAcquisitionTarget,
  type ReplenishmentAutomationInput,
} from "../src/lib/replenishment-automation";

const input: ReplenishmentAutomationInput = {
  asOf: "2026-06-24T12:00:00.000Z",
  inventory: [
    {
      id: "tapiz-cellar",
      wineReferenceId: "11111111-1111-4111-8111-111111111111",
      wineTitle: "2021 Tapiz Alta Collection Cabernet Sauvignon",
      producer: "Tapiz",
      vintage: 2021,
      region: "Mendoza",
      varietal: "Cabernet Sauvignon",
      quantity: 1,
      lowStockThreshold: 2,
      lowStockAlertEnabled: true,
      status: "in_cellar",
      purchasePriceCents: 9200,
      purchaseLocation: "Benchmark Wine Shop",
    },
    {
      id: "lewis-consumed",
      wineReferenceId: "22222222-2222-4222-8222-222222222222",
      wineTitle: "2020 Lewis Cellars Reserve Cabernet",
      producer: "Lewis Cellars",
      vintage: 2020,
      region: "Napa Valley",
      varietal: "Cabernet Sauvignon",
      quantity: 0,
      lowStockThreshold: null,
      lowStockAlertEnabled: false,
      status: "consumed",
      consumedDate: "2026-06-20",
      purchasePriceCents: 21000,
      purchaseLocation: "Benchmark Wine Shop",
    },
    {
      id: "avoid-cellar",
      wineReferenceId: "33333333-3333-4333-8333-333333333333",
      wineTitle: "2021 Thin Merlot",
      producer: "Avoid Producer",
      vintage: 2021,
      region: "California",
      varietal: "Merlot",
      quantity: 1,
      lowStockThreshold: 3,
      lowStockAlertEnabled: true,
      status: "in_cellar",
      purchasePriceCents: 3500,
      purchaseLocation: "Local Shop",
    },
  ],
  ratings: [
    {
      id: "rating-tapiz",
      inventoryId: "tapiz-cellar",
      wineReferenceId: "11111111-1111-4111-8111-111111111111",
      score: 95,
      tastingDate: "2026-06-01",
      notes: "Loved the dark fruit and plush finish.",
    },
    {
      id: "rating-avoid",
      inventoryId: "avoid-cellar",
      wineReferenceId: "33333333-3333-4333-8333-333333333333",
      score: 78,
      tastingDate: "2026-06-02",
      notes: "Too thin.",
    },
  ],
  tastings: [
    {
      id: "tasting-lewis",
      wineReferenceId: "22222222-2222-4222-8222-222222222222",
      wineTitle: "2020 Lewis Cellars Reserve Cabernet",
      producer: "Lewis Cellars",
      vintage: 2020,
      region: "Napa Valley",
      varietal: "Cabernet Sauvignon",
      score: 96,
      buyAgain: "yes",
      tastedAt: "2026-06-20T22:00:00.000Z",
      notes: "Benchmark birthday dinner bottle.",
    },
  ],
  acquiredTargets: [
    {
      id: "acquired-tapiz",
      wineReferenceId: "11111111-1111-4111-8111-111111111111",
      wineTitle: "2021 Tapiz Alta Collection Cabernet Sauvignon",
      producer: "Tapiz",
      vintage: 2021,
      region: "Mendoza",
      varietal: "Cabernet Sauvignon",
      acquiredQuantity: 2,
      acquiredPriceCents: 18400,
      acquiredAt: "2026-06-10T12:00:00.000Z",
    },
  ],
  existingTargets: [
    {
      id: "existing-avoid",
      wineReferenceId: "33333333-3333-4333-8333-333333333333",
      inventoryId: "avoid-cellar",
      status: "watching",
    },
  ],
};

const automation = buildReplenishmentAutomation(input);

assert.equal(automation.summary.totalSignals, 4);
assert.equal(automation.summary.buyAgainNowCount, 2);
assert.equal(automation.summary.refillPromptCount, 1);
assert.equal(automation.summary.suppressedCount, 1);
assert.equal(automation.lanes.buyAgainNow[0].inventoryId, "lewis-consumed");
assert.equal(automation.lanes.buyAgainNow[0].urgency, "now");
assert.equal(automation.lanes.buyAgainNow[0].reasonCodes.includes("liked_consumed"), true);
assert.equal(automation.lanes.buyAgainNow[1].inventoryId, "tapiz-cellar");
assert.equal(automation.lanes.buyAgainNow[1].reasonCodes.includes("low_stock_liked"), true);
assert.equal(automation.lanes.refillPrompts[0].inventoryId, "tapiz-cellar");
assert.equal(automation.lanes.suppressed[0].inventoryId, "avoid-cellar");
assert.equal(automation.lanes.suppressed[0].suppressedReason, "already_on_acquisition_board");

const payload = replenishmentPromptToAcquisitionTarget(automation.lanes.buyAgainNow[0]);
assert.equal(payload.sourceKind, "replenishment");
assert.equal(payload.sourceId, "lewis-consumed");
assert.equal(payload.status, "buy_now");
assert.equal(payload.priority, "must_have");
assert.equal(payload.desiredQuantity, 2);
assert.equal(payload.targetPriceCents, 21000);
assert.ok(payload.notes.includes("liked consumed bottle"));

console.log("replenishment-automation tests passed");
