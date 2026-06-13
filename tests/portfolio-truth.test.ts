import assert from "node:assert/strict";
import { buildPortfolioTruth, type PortfolioTruthWine } from "../src/lib/portfolio-truth";

function wine(overrides: Partial<PortfolioTruthWine>): PortfolioTruthWine {
  return {
    id: overrides.id ?? "wine-1",
    name: "Reserve Cabernet",
    producer: "Lewis Cellars",
    region: "Napa Valley",
    wine_type: "cabernet sauvignon",
    quantity: 1,
    purchase_price_cents: null,
    current_market_value_cents: null,
    ...overrides,
  };
}

function testPortfolioSeparatesKnownEstimatedAndUnknownValue() {
  const truth = buildPortfolioTruth([
    wine({ id: "known-gain", quantity: 2, purchase_price_cents: 10000, current_market_value_cents: 15000 }),
    wine({ id: "estimated", quantity: 3, purchase_price_cents: 4000, current_market_value_cents: null }),
    wine({ id: "unknown", quantity: 4, purchase_price_cents: null, current_market_value_cents: null }),
  ]);

  assert.equal(truth.totals.totalBottles, 9);
  assert.equal(truth.totals.knownValueCents, 30000);
  assert.equal(truth.totals.estimatedValueCents, 12000);
  assert.equal(truth.totals.unknownBottles, 4);
  assert.equal(truth.totals.displayValueCents, 42000);
  assert.equal(truth.coverage.marketBottleCoverage, 2 / 9);
  assert.equal(truth.coverage.valueCoverage, 30000 / 42000);
  assert.equal(truth.confidence.level, "thin");
  assert.match(truth.confidence.reason, /market value/i);
}

function testPortfolioCalculatesGainLossOnlyWhereMarketAndPurchaseExist() {
  const truth = buildPortfolioTruth([
    wine({ id: "gain", quantity: 2, purchase_price_cents: 10000, current_market_value_cents: 15000 }),
    wine({ id: "loss", quantity: 1, purchase_price_cents: 20000, current_market_value_cents: 12000 }),
    wine({ id: "no-basis", quantity: 1, purchase_price_cents: null, current_market_value_cents: 50000 }),
  ]);

  assert.equal(truth.performance.costBasisCents, 40000);
  assert.equal(truth.performance.marketValueWithBasisCents, 42000);
  assert.equal(truth.performance.unrealizedGainLossCents, 2000);
  assert.equal(Math.round(truth.performance.gainLossPercent * 1000) / 1000, 0.05);
}

function testPortfolioFindsConcentrationAndUpdateNextActions() {
  const truth = buildPortfolioTruth([
    wine({ id: "napa-a", quantity: 2, region: "Napa Valley", producer: "Lewis Cellars", wine_type: "cabernet sauvignon", purchase_price_cents: 10000, current_market_value_cents: 16000 }),
    wine({ id: "napa-b", quantity: 1, region: "Napa Valley", producer: "Lewis Cellars", wine_type: "cabernet sauvignon", purchase_price_cents: 12000, current_market_value_cents: 18000 }),
    wine({ id: "market-gap", quantity: 2, region: "Bordeaux", producer: "Chateau Test", wine_type: "red blend", purchase_price_cents: 26000, current_market_value_cents: null }),
    wine({ id: "unknown-gap", quantity: 1, region: "Burgundy", producer: "Domaine Test", wine_type: "pinot noir", purchase_price_cents: null, current_market_value_cents: null }),
  ]);

  assert.equal(truth.concentration.regions[0].name, "Bordeaux");
  assert.equal(truth.concentration.regions[0].valueCents, 52000);
  assert.equal(truth.updateNext[0].id, "market-gap");
  assert.equal(truth.updateNext[0].reason, "Missing market value on meaningful estimated value.");
  assert.match(truth.executiveBrief, /market-known/i);
  assert.match(truth.bestNextMove, /market-gap|Bordeaux|market value/i);
}

function testPortfolioEmptyStateIsHonest() {
  const truth = buildPortfolioTruth([]);

  assert.equal(truth.confidence.level, "empty");
  assert.equal(truth.totals.displayValueCents, 0);
  assert.equal(truth.executiveBrief, "No active bottles are available for portfolio truth yet.");
}

testPortfolioSeparatesKnownEstimatedAndUnknownValue();
testPortfolioCalculatesGainLossOnlyWhereMarketAndPurchaseExist();
testPortfolioFindsConcentrationAndUpdateNextActions();
testPortfolioEmptyStateIsHonest();

console.log("portfolio-truth tests passed");
