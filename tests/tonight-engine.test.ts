import assert from "node:assert/strict";
import { buildTonightRecommendations, type TonightEngineBottle, type TonightContext } from "../src/lib/tonight-engine";

const context: TonightContext = {
  meal: "steak",
  occasion: "celebration",
  mood: "cozy",
  adventurous: "balanced",
};

const bottles: TonightEngineBottle[] = [
  {
    id: "cab-ready",
    name: "Estate Cabernet",
    producer: "Lewis Reserve",
    region: "Napa Valley",
    country: "United States",
    wine_type: "red",
    vintage: 2021,
    quantity: 2,
    drink_after: "2024",
    drink_before: "2029",
    purchase_price_cents: 9500,
    current_market_value_cents: 12500,
    ratings: [{ id: "rating-cab", score: 95, tasting_notes: "Black cherry, cedar, structured tannin." }],
    brian_fit_score: 94,
    brian_fit_reason: "Dark fruit and firm tannin match Brian's Cabernet lane.",
  },
  {
    id: "pinot-light",
    name: "Market Pinot Noir",
    producer: "Example Vineyard",
    region: "Willamette Valley",
    country: "United States",
    wine_type: "red",
    vintage: 2020,
    quantity: 1,
    drink_after: "2023",
    drink_before: "2027",
    purchase_price_cents: 6500,
    current_market_value_cents: 8500,
    ratings: [{ id: "rating-pinot", score: 93, tasting_notes: "Silky, bright cherry, savoury spice." }],
    brian_fit_score: 92,
    brian_fit_reason: "High fit, but lighter than the requested steak celebration lane.",
  },
  {
    id: "unknown-white",
    name: "Mystery White",
    producer: null,
    region: null,
    country: null,
    wine_type: "white",
    vintage: null,
    quantity: 4,
    drink_after: null,
    drink_before: null,
    purchase_price_cents: null,
    current_market_value_cents: null,
    ratings: [],
    brian_fit_score: null,
    brian_fit_reason: null,
  },
];

function testBuildsPrimaryAndTwoAlternatesFromActualCellar() {
  const response = buildTonightRecommendations(bottles, context, { asOf: new Date("2026-06-13T12:00:00Z") });

  assert.equal(response.success, true);
  assert.equal(response.primary?.inventory_id, "cab-ready");
  assert.equal(response.primary?.recommendation_type, "best-now");
  assert.equal(response.alternates.length, 2);
  assert.deepEqual(response.alternates.map((item) => item.inventory_id), ["pinot-light", "unknown-white"]);
  assert.match(response.headline, /Estate Cabernet/);
  assert.match(response.summary, /real cellar/i);
}

function testScoringExposesTransparentCategoriesAndCautions() {
  const response = buildTonightRecommendations(bottles, context, { asOf: new Date("2026-06-13T12:00:00Z") });
  const primary = response.primary;

  assert.ok(primary);
  assert.ok(primary.score_breakdown.readiness > 0);
  assert.ok(primary.score_breakdown.meal_fit > 0);
  assert.ok(primary.score_breakdown.occasion_fit > 0);
  assert.ok(primary.score_breakdown.taste_fit > 0);
  assert.ok(primary.reason.includes("steak"));
  assert.ok(primary.best_for.includes("celebration"));
  assert.equal(primary.caution, "Low structural risk based on the current context.");
}

function testAdventurousModeElevatesLearningBottleWithoutInventingConfidence() {
  const response = buildTonightRecommendations(
    bottles,
    { meal: "anything", occasion: "weeknight", mood: "bright", adventurous: "adventurous" },
    { asOf: new Date("2026-06-13T12:00:00Z") }
  );

  assert.ok(response.alternates.some((item) => item.inventory_id === "unknown-white"));
  const learning = [response.primary, ...response.alternates].find((item) => item?.inventory_id === "unknown-white");
  assert.ok(learning);
  assert.ok(learning.confidence < 80);
  assert.match(learning.caution, /taste memory|Value is unknown/i);
  assert.match(response.confidence_note, /sparse/i);
}

function testEmptyCellarReturnsActionableFallback() {
  const response = buildTonightRecommendations([], context, { asOf: new Date("2026-06-13T12:00:00Z") });

  assert.equal(response.primary, null);
  assert.deepEqual(response.alternates, []);
  assert.match(response.fallback_prompt ?? "", /Add your first bottle|restore/i);
}

function testEmptyActiveCellarReturnsActionableFallback() {
  const response = buildTonightRecommendations([
    { ...bottles[0], id: "consumed", quantity: 0 },
  ], context, { asOf: new Date("2026-06-13T12:00:00Z") });

  assert.equal(response.primary, null);
  assert.deepEqual(response.alternates, []);
  assert.match(response.fallback_prompt ?? "", /Add your first bottle|restore/i);
  assert.match(response.confidence_note, /No inventory/i);
}

function testTonightEngineWillNotPrimaryHoldOrPastPeakBottle() {
  const response = buildTonightRecommendations([
    { ...bottles[0], id: "hold-cab", drink_after: "2030", drink_before: "2035", brian_fit_score: 99 },
    { ...bottles[1], id: "past-pinot", drink_after: "2018", drink_before: "2024", brian_fit_score: 99 },
    { ...bottles[2], id: "ready-modest", drink_after: "2024", drink_before: "2028", brian_fit_score: 75 },
  ], context, { asOf: new Date("2026-06-13T12:00:00Z") });

  assert.equal(response.primary?.inventory_id, "ready-modest");
  assert.doesNotMatch(response.headline, /hold-cab|past-pinot/i);
}

testBuildsPrimaryAndTwoAlternatesFromActualCellar();
testScoringExposesTransparentCategoriesAndCautions();
testAdventurousModeElevatesLearningBottleWithoutInventingConfidence();
testEmptyCellarReturnsActionableFallback();
testEmptyActiveCellarReturnsActionableFallback();
testTonightEngineWillNotPrimaryHoldOrPastPeakBottle();

console.log("tonight-engine tests passed");
