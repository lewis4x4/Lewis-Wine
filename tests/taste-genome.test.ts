import assert from "node:assert/strict";
import { buildTasteGenome, type TasteGenomeRating } from "../src/lib/taste-genome";

function rating(overrides: Partial<TasteGenomeRating>): TasteGenomeRating {
  return {
    id: overrides.id ?? "rating-1",
    score: 90,
    wine_type: "red",
    region: "Napa Valley",
    producer: "Lewis Cellars",
    vintage: 2021,
    purchase_price_cents: 7500,
    rating_signal: null,
    ...overrides,
  };
}

function testGenomeSeparatesProvenPreferencesFromThinSignal() {
  const genome = buildTasteGenome([
    rating({ id: "napa-1", score: 96, region: "Napa Valley", producer: "Lewis Cellars" }),
    rating({ id: "napa-2", score: 94, region: "Napa Valley", producer: "Lewis Cellars" }),
    rating({ id: "napa-3", score: 93, region: "Napa Valley", producer: "Ridge" }),
    rating({ id: "burgundy-1", score: 97, region: "Burgundy", producer: "DRC" }),
  ]);

  assert.equal(genome.sampleSize, 4);
  assert.equal(genome.confidence.level, "developing");
  assert.match(genome.confidence.explanation, /4 ratings/);
  assert.equal(genome.affinities.regions[0].name, "Napa Valley");
  assert.equal(genome.affinities.regions[0].confidence, "proven");
  assert.equal(genome.affinities.regions.find((region) => region.name === "Burgundy")?.confidence, "thin");
  assert.match(genome.headline, /Napa Valley/);
}

function testGenomeBuildsStructureProfileFromRatingSignals() {
  const genome = buildTasteGenome([
    rating({
      id: "smooth-1",
      score: 95,
      rating_signal: {
        smoothness: 5,
        boldness: 4,
        earthiness: 4,
        spiciness: 3,
        fruit_forward: 3,
        dryness: 4,
        tannin_strength: 3,
        acidity_level: 3,
        finish_length: 5,
        richness: 5,
        buy_again: true,
        value_feel: "excellent",
      },
    }),
    rating({
      id: "smooth-2",
      score: 93,
      rating_signal: {
        smoothness: 4,
        boldness: 4,
        earthiness: 3,
        spiciness: 3,
        fruit_forward: 3,
        dryness: 4,
        tannin_strength: 3,
        acidity_level: 3,
        finish_length: 4,
        richness: 4,
        buy_again: true,
        value_feel: "strong",
      },
    }),
  ]);

  assert.equal(genome.structureProfile.length >= 3, true);
  assert.equal(genome.structureProfile[0].dimension, "smoothness");
  assert.equal(genome.structureProfile[0].average, 4.5);
  assert.equal(genome.structureProfile[0].signalCount, 2);
  assert.match(genome.insights[0], /Smoothness|Finish|Richness/);
}

function testGenomeFindsValuePatternAndOverUnderperformers() {
  const genome = buildTasteGenome([
    rating({ id: "value-star", score: 95, region: "Willamette Valley", purchase_price_cents: 3500 }),
    rating({ id: "luxury-letdown", score: 84, region: "Bordeaux", purchase_price_cents: 18000 }),
    rating({ id: "solid", score: 91, region: "Napa Valley", purchase_price_cents: 7000 }),
  ]);

  const bestValue = genome.valuePattern.bestValue;
  assert.ok(bestValue);
  assert.equal(bestValue.id, "value-star");
  assert.equal(genome.valuePattern.underperformers[0].id, "luxury-letdown");
  assert.match(genome.valuePattern.summary, /Willamette Valley|value-star/i);
}

function testGenomeBuildsActionLayer() {
  const genome = buildTasteGenome([
    rating({ id: "napa-1", score: 96, region: "Napa Valley", wine_type: "cabernet sauvignon", producer: "Lewis Cellars" }),
    rating({ id: "napa-2", score: 94, region: "Napa Valley", wine_type: "cabernet sauvignon", producer: "Lewis Cellars" }),
    rating({ id: "napa-3", score: 93, region: "Napa Valley", wine_type: "cabernet sauvignon", producer: "Ridge" }),
    rating({ id: "thin-star", score: 97, region: "Burgundy", wine_type: "pinot noir", producer: "DRC" }),
    rating({ id: "expensive-miss", score: 84, region: "Bordeaux", wine_type: "red blend", purchase_price_cents: 18000 }),
  ]);

  assert.equal(genome.actionPlan.buyMore[0].target, "Napa Valley");
  assert.equal(genome.actionPlan.buyMore[0].evidence, "3 ratings · 94.3 avg");
  assert.match(genome.actionPlan.buyMore[0].rationale, /proven/);
  assert.equal(genome.actionPlan.watchlist[0].target, "2021 Lewis Cellars Bordeaux");
  assert.equal(genome.actionPlan.compareNext[0].target, "Burgundy");
  assert.equal(genome.actionPlan.improveConfidence[0].action, "Capture rating signals");
}

function testGenomeEmptyStateIsHonest() {
  const genome = buildTasteGenome([]);

  assert.equal(genome.sampleSize, 0);
  assert.equal(genome.confidence.level, "empty");
  assert.equal(genome.headline, "Taste Genome needs ratings before it can make a serious claim.");
  assert.deepEqual(genome.affinities.regions, []);
  assert.equal(genome.actionPlan.improveConfidence[0].target, "First three rated bottles");
}

testGenomeSeparatesProvenPreferencesFromThinSignal();
testGenomeBuildsStructureProfileFromRatingSignals();
testGenomeFindsValuePatternAndOverUnderperformers();
testGenomeBuildsActionLayer();
testGenomeEmptyStateIsHonest();

console.log("taste-genome tests passed");
