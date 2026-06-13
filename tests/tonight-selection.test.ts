import assert from "node:assert/strict";
import {
  buildTonightSelection,
  getTonightSelectionStatus,
  parseTonightSelection,
  serializeTonightSelection,
} from "../src/lib/tonight-selection";
import type { TonightContext, TonightRecommendation } from "../src/lib/tonight-engine";

const context: TonightContext = {
  meal: "steak",
  occasion: "date-night",
  mood: "cozy",
  adventurous: "balanced",
};

const recommendation: TonightRecommendation = {
  id: "rec-1",
  inventory_id: "wine-1",
  name: "Estate Cabernet",
  producer: "Lewis Reserve",
  region: "Napa Valley",
  country: "United States",
  wine_type: "red",
  vintage_label: "2021",
  quantity: 2,
  price_context: "$95 purchase / $125 market",
  confidence: 88,
  brian_fit_score: 94,
  brian_fit_reason: "Dark fruit and structure match Brian's lane.",
  reason: "Best fit for steak and date-night.",
  best_for: "date-night",
  caution: "Low structural risk based on the current context.",
  readiness_status: "ready",
  recommendation_type: "best-now",
  score_breakdown: {
    readiness: 30,
    meal_fit: 22,
    occasion_fit: 10,
    taste_fit: 24,
    confidence: 18,
    adventure_fit: 0,
    cellar_practicality: 6,
    value_fit: 8,
  },
};

function testBuildsDurableTonightSelectionWithoutPretendingToBePermanent() {
  const selection = buildTonightSelection(recommendation, context, {
    selectedAt: "2026-06-13T20:00:00.000Z",
    expiresAt: "2026-06-14T08:00:00.000Z",
  });

  assert.equal(selection.inventoryId, "wine-1");
  assert.equal(selection.name, "Estate Cabernet");
  assert.equal(selection.confidence, 88);
  assert.deepEqual(selection.context, context);
  assert.equal(selection.source, "tonight-engine");
  assert.equal(selection.expiresAt, "2026-06-14T08:00:00.000Z");
}

function testSelectionRoundTripsThroughStorageSafely() {
  const selection = buildTonightSelection(recommendation, context, {
    selectedAt: "2026-06-13T20:00:00.000Z",
  });
  const serialized = serializeTonightSelection(selection);
  const parsed = parseTonightSelection(serialized);

  assert.deepEqual(parsed, selection);
  assert.equal(parseTonightSelection("not json"), null);
  assert.equal(parseTonightSelection(JSON.stringify({ inventoryId: "wine-1" })), null);
}

function testDetailPageStatusRequiresActiveMatchingSelection() {
  const selection = buildTonightSelection(recommendation, context, {
    selectedAt: "2026-06-13T20:00:00.000Z",
    expiresAt: "2026-06-14T08:00:00.000Z",
  });

  assert.equal(getTonightSelectionStatus(selection, "wine-1", new Date("2026-06-13T21:00:00.000Z")).isActiveForBottle, true);
  assert.equal(getTonightSelectionStatus(selection, "wine-2", new Date("2026-06-13T21:00:00.000Z")).isActiveForBottle, false);
  assert.equal(getTonightSelectionStatus(selection, "wine-1", new Date("2026-06-14T09:00:00.000Z")).isActiveForBottle, false);
}

testBuildsDurableTonightSelectionWithoutPretendingToBePermanent();
testSelectionRoundTripsThroughStorageSafely();
testDetailPageStatusRequiresActiveMatchingSelection();

console.log("tonight-selection tests passed");
