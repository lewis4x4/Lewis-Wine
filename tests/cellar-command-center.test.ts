import assert from "node:assert/strict";
import {
  buildCellarCommandCenter,
  getCellarCommandWineName,
  type CellarCommandWine,
} from "../src/lib/cellar-command-center";

const asOf = new Date("2026-06-12T12:00:00Z");

function wine(overrides: Partial<CellarCommandWine>): CellarCommandWine {
  return {
    id: "wine-1",
    name: "Estate Cabernet",
    producer: "Lewis Cellars",
    region: "Napa Valley",
    vintage: 2021,
    quantity: 1,
    drink_after: null,
    drink_before: null,
    purchase_price_cents: null,
    current_market_value_cents: null,
    low_stock_threshold: null,
    low_stock_alert_enabled: false,
    ratings_count: 0,
    brian_fit_score: null,
    brian_fit_confidence: null,
    brian_fit_reason: null,
    tags: [],
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function testWineNameUsesVintageProducerAndFallbacks() {
  assert.equal(
    getCellarCommandWineName(wine({ vintage: 2019, name: "Reserve Syrah", producer: "Ridge" })),
    "2019 Reserve Syrah"
  );
  assert.equal(getCellarCommandWineName(wine({ name: null, custom_name: "House Red", vintage: null })), "House Red");
}

function testCommandCenterBuildsActionLanes() {
  const center = buildCellarCommandCenter([
    wine({ id: "ready-fit", brian_fit_score: 95, brian_fit_confidence: 88, ratings_count: 2, drink_after: "2024", drink_before: "2028", quantity: 2 }),
    wine({ id: "past-peak", name: "Old Bordeaux", ratings_count: 1, drink_after: "2012", drink_before: "2024" }),
    wine({ id: "restock", name: "Favorite Barolo", brian_fit_score: 96, ratings_count: 1, quantity: 1, low_stock_threshold: 2, low_stock_alert_enabled: true }),
    wine({ id: "learn", name: "Mystery Burgundy", ratings_count: 0, drink_after: "2026", drink_before: "2030" }),
    wine({ id: "hold", name: "Young Brunello", ratings_count: 1, drink_after: "2030", drink_before: "2040" }),
  ], { asOf });

  assert.equal(center.metrics.totalBottles, 6);
  assert.equal(center.metrics.readyNow, 2);
  assert.equal(center.metrics.pastPeak, 1);
  assert.equal(center.metrics.replace, 1);
  assert.equal(center.metrics.needsSignal, 1);
  assert.equal(center.metrics.highBrianFit, 2);

  assert.equal(center.lanes.drinkNow[0].id, "ready-fit");
  assert.match(center.lanes.drinkNow[0].action, /Open|Prioritize/);
  assert.equal(center.lanes.atRisk[0].id, "past-peak");
  assert.equal(center.lanes.replace[0].id, "restock");
  assert.equal(center.lanes.learn[0].id, "learn");
  assert.equal(center.lanes.hold[0].id, "hold");
}

function testExecutiveBriefNamesTheSharpestMove() {
  const center = buildCellarCommandCenter([
    wine({ id: "past-peak", name: "Old Bordeaux", drink_before: "2025", ratings_count: 1 }),
    wine({ id: "ready", name: "Dinner Cab", drink_after: "2024", drink_before: "2028", brian_fit_score: 92, ratings_count: 2 }),
  ], { asOf });

  assert.match(center.executiveBrief, /1 bottle needs a decision before it drifts further/);
  assert.match(center.bestNextMove, /Old Bordeaux/);
}

testWineNameUsesVintageProducerAndFallbacks();
testCommandCenterBuildsActionLanes();
testExecutiveBriefNamesTheSharpestMove();

console.log("cellar-command-center tests passed");
