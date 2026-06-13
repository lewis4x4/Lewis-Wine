import assert from "node:assert/strict";
import { buildTasteGenome, type TasteGenomeRating } from "../src/lib/taste-genome";
import { buildTasteBottleActions, type TasteActionBottle } from "../src/lib/taste-action-planner";

function rating(overrides: Partial<TasteGenomeRating>): TasteGenomeRating {
  return {
    id: overrides.id ?? "rating-1",
    score: 90,
    wine_type: "cabernet sauvignon",
    region: "Napa Valley",
    producer: "Lewis Cellars",
    vintage: 2021,
    purchase_price_cents: 7500,
    rating_signal: null,
    ...overrides,
  };
}

function bottle(overrides: Partial<TasteActionBottle>): TasteActionBottle {
  return {
    id: overrides.id ?? "bottle-1",
    name: "Reserve Cabernet",
    producer: "Lewis Cellars",
    region: "Napa Valley",
    wine_type: "cabernet sauvignon",
    vintage: 2021,
    quantity: 1,
    ratings_count: 0,
    rating_signal_count: 0,
    purchase_price_cents: 7500,
    current_market_value_cents: 9000,
    brian_fit_score: 92,
    ...overrides,
  };
}

function testPlannerNamesOwnedBottleForThinPromisingLane() {
  const genome = buildTasteGenome([
    rating({ id: "burgundy-loved", score: 97, region: "Burgundy", wine_type: "pinot noir", producer: "DRC" }),
    rating({ id: "napa-1", score: 94, region: "Napa Valley", wine_type: "cabernet sauvignon" }),
    rating({ id: "napa-2", score: 93, region: "Napa Valley", wine_type: "cabernet sauvignon" }),
  ]);

  const actions = buildTasteBottleActions({
    genome,
    bottles: [
      bottle({ id: "owned-pinot", name: "Village Pinot", region: "Burgundy", wine_type: "pinot noir", producer: "Domaine Test", ratings_count: 0 }),
      bottle({ id: "owned-napa", region: "Napa Valley", wine_type: "cabernet sauvignon", ratings_count: 2 }),
    ],
  });

  assert.equal(actions.tasteNext[0].bottleId, "owned-pinot");
  assert.equal(actions.tasteNext[0].lane, "taste-next");
  assert.match(actions.tasteNext[0].reason, /thin but promising/i);
}

function testPlannerFindsOwnedReplacementForProvenLane() {
  const genome = buildTasteGenome([
    rating({ id: "napa-1", score: 96, region: "Napa Valley", wine_type: "cabernet sauvignon" }),
    rating({ id: "napa-2", score: 94, region: "Napa Valley", wine_type: "cabernet sauvignon" }),
    rating({ id: "napa-3", score: 93, region: "Napa Valley", wine_type: "cabernet sauvignon" }),
  ]);

  const actions = buildTasteBottleActions({
    genome,
    bottles: [
      bottle({ id: "last-napa", region: "Napa Valley", wine_type: "cabernet sauvignon", quantity: 1, ratings_count: 2 }),
      bottle({ id: "oregon", region: "Willamette Valley", wine_type: "pinot noir", quantity: 4 }),
    ],
  });

  assert.equal(actions.replaceProven[0].bottleId, "last-napa");
  assert.equal(actions.replaceProven[0].action, "Replace proven favorite");
  assert.match(actions.replaceProven[0].reason, /proven Brian lane/i);
}

function testPlannerFindsSignalCaptureAndRetasteActions() {
  const genome = buildTasteGenome([
    rating({ id: "miss", score: 84, region: "Bordeaux", wine_type: "red blend", purchase_price_cents: 18000 }),
    rating({ id: "napa", score: 94, region: "Napa Valley", wine_type: "cabernet sauvignon" }),
  ]);

  const actions = buildTasteBottleActions({
    genome,
    bottles: [
      bottle({ id: "needs-signal", ratings_count: 1, rating_signal_count: 0, region: "Napa Valley" }),
      bottle({ id: "owned-bordeaux", name: "Left Bank", producer: "Chateau Test", region: "Bordeaux", wine_type: "red blend", ratings_count: 1, rating_signal_count: 1, purchase_price_cents: 18000 }),
    ],
  });

  assert.equal(actions.captureSignal[0].bottleId, "needs-signal");
  assert.equal(actions.retasteResolve[0].bottleId, "owned-bordeaux");
  assert.match(actions.retasteResolve[0].reason, /expensive underperformer/i);
}

testPlannerNamesOwnedBottleForThinPromisingLane();
testPlannerFindsOwnedReplacementForProvenLane();
testPlannerFindsSignalCaptureAndRetasteActions();

console.log("taste-action-planner tests passed");
