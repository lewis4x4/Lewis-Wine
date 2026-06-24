import assert from "node:assert/strict";
import {
  buildShoppingMode,
  parseRetailerWineText,
  shoppingPickToAcquisitionTarget,
  type ShoppingModeInput,
} from "../src/lib/shopping-mode";

const retailerText = `
Benchmark Wine Shop - Cabernet Sale
2021 Tapiz Alta Collection Cabernet Sauvignon Mendoza $92 available
2020 Lewis Cellars Reserve Cabernet Napa Valley $210 limited
2021 Miss Merlot Bordeaux $45 in stock
2022 Willamette Fixture Pinot Noir $68 sold out
`;

const input: ShoppingModeInput = {
  retailer: "Benchmark Wine Shop",
  context: "stocking the house before a steak dinner",
  desiredQuantity: 6,
  maxBudgetCents: 65000,
  profile: {
    lovedDescriptors: ["smooth", "rich", "black fruit", "long finish"],
    preferredRegions: ["Mendoza", "Napa Valley"],
    preferredVarietals: ["Cabernet Sauvignon", "Malbec"],
    preferredProducers: ["Tapiz", "Lewis Cellars"],
    priceBand: { low: 60, typical: 100, high: 180 },
    avoidList: ["Miss Merlot"],
    benchmarkWineIds: ["tapiz-95"],
    refreshedAt: "2026-06-24T00:00:00.000Z",
  },
  items: parseRetailerWineText(retailerText),
};

assert.equal(input.items.length, 4);
assert.equal(input.items[0].producer, "Tapiz");
assert.equal(input.items[0].price, 92);
assert.equal(input.items[0].availability, "available");
assert.equal(input.items[3].availability, "sold_out");

const mode = buildShoppingMode(input);
assert.equal(mode.summary.total, 4);
assert.equal(mode.summary.buyNow, 1);
assert.equal(mode.summary.skip, 2);
assert.equal(mode.summary.estimatedSpendCents, 55200);
assert.equal(mode.picks.bestBuy?.item.producer, "Tapiz");
assert.equal(mode.picks.bestBuy?.decision, "Buy Now");
assert.equal(mode.picks.bestValue?.item.producer, "Tapiz");
assert.equal(mode.picks.splurge?.item.producer, "Lewis Cellars");
assert.equal(mode.picks.skip?.item.producer, "Miss");
assert.equal(mode.recommendations[0].acquisitionPriority, "must_have");
assert.equal(mode.recommendations[0].quantityToBuy, 6);
assert.ok(mode.shoppingBrief.includes("Buy 6 × 2021 Tapiz"));
assert.ok(mode.budgetWarning === null);

const payload = shoppingPickToAcquisitionTarget(mode.recommendations[0], "Benchmark Wine Shop");
assert.equal(payload.sourceKind, "shopping");
assert.equal(payload.status, "buy_now");
assert.equal(payload.targetPriceCents, 9200);
assert.equal(payload.maxPriceCents, 11040);
assert.equal(payload.desiredQuantity, 6);
assert.match(payload.notes ?? "", /Shopping Mode/);

const tightBudget = buildShoppingMode({ ...input, maxBudgetCents: 20000 });
assert.ok(tightBudget.budgetWarning?.includes("budget"));
assert.equal(tightBudget.summary.estimatedSpendCents, 9200);
assert.equal(tightBudget.recommendations[0].quantityToBuy, 1);

console.log("shopping-mode tests passed");
