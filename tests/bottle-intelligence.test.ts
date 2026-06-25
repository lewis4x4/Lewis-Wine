import assert from "node:assert/strict";
import { buildBottleIntelligence, type BottleIntelligenceInput } from "../src/lib/bottle-intelligence";
import { buildFieldCaptureRatingPayload, buildReviewDraft, tapizDemoCandidate } from "../src/lib/field-capture";

const baseBottle: BottleIntelligenceInput = {
  id: "cellar-1",
  name: "Estate Cabernet Sauvignon",
  producer: "Lewis Reserve",
  vintage: 2021,
  region: "Napa Valley",
  country: "United States",
  wineType: "red",
  grapeVarieties: ["Cabernet Sauvignon"],
  alcoholPercentage: 14.5,
  quantity: 2,
  bottleSizeMl: 750,
  drinkAfter: "2024-01-01",
  drinkBefore: "2029-12-31",
  purchasePriceCents: 9500,
  currentMarketValueCents: 12500,
  marketValueSource: "wine_searcher",
  simpleLocation: "Rack A / Row 2",
  brianFit: {
    score: 94,
    confidence: 86,
    reason: "Matches Brian's preference for structured Cabernet with dark fruit and firm tannin.",
  },
  ratings: [
    {
      score: 95,
      tastingDate: "2026-01-15",
      tastingNotes: "Black cherry, cedar, grippy tannin, long finish.",
      body: "full",
      tannins: "high",
      acidity: "medium_plus",
      sweetness: "dry",
      finish: "long",
    },
    {
      score: 93,
      tastingDate: "2025-03-02",
      tastingNotes: "Powerful and polished.",
      body: "full",
      tannins: "medium_plus",
      acidity: "medium_plus",
      sweetness: "dry",
    },
  ],
};

function testBuildsWorldClassBottleIntelligenceCard() {
  const intelligence = buildBottleIntelligence(baseBottle, { asOf: new Date("2026-06-13T12:00:00Z") });

  assert.equal(intelligence.identity.title, "2021 Estate Cabernet Sauvignon");
  assert.equal(intelligence.identity.subtitle, "Lewis Reserve • Napa Valley, United States");
  assert.equal(intelligence.structure.profileSource, "tasting_memory");
  assert.deepEqual(
    intelligence.structure.traits.map((trait) => trait.key),
    ["body", "tannin", "acidity", "sweetness", "abv", "finish"]
  );
  assert.equal(intelligence.readiness.state, "ready");
  assert.equal(intelligence.readiness.label, "Ready now");
  assert.equal(intelligence.memoryDensity.state, "emerging");
  assert.equal(intelligence.memoryDensity.ratingCount, 2);
  assert.equal(intelligence.bottleBrainRole.role, "safe_pick");
  assert.equal(intelligence.value.status, "tracked");
  assert.equal(intelligence.nextSignals[0].kind, "confirm_drink_window");
}

function testFlagsThinBottleAsLearningPickWithReferenceDerivedStructure() {
  const intelligence = buildBottleIntelligence(
    {
      ...baseBottle,
      id: "cellar-2",
      name: "Willamette Pinot Noir",
      vintage: 2022,
      region: "Willamette Valley",
      wineType: "red",
      grapeVarieties: ["Pinot Noir"],
      alcoholPercentage: null,
      quantity: 1,
      drinkAfter: null,
      drinkBefore: null,
      currentMarketValueCents: null,
      marketValueSource: null,
      simpleLocation: null,
      brianFit: null,
      ratings: [],
    },
    { asOf: new Date("2026-06-13T12:00:00Z") }
  );

  assert.equal(intelligence.structure.profileSource, "reference_default");
  assert.equal(intelligence.memoryDensity.state, "thin");
  assert.equal(intelligence.bottleBrainRole.role, "learning_pick");
  assert.ok(intelligence.nextSignals.some((signal) => signal.kind === "capture_tasting_memory"));
  assert.ok(intelligence.nextSignals.some((signal) => signal.kind === "set_location"));
  assert.ok(intelligence.nextSignals.some((signal) => signal.kind === "confirm_drink_window"));
}

function testTriagePastPeakAndMissingLocation() {
  const intelligence = buildBottleIntelligence(
    {
      ...baseBottle,
      drinkAfter: "2018-01-01",
      drinkBefore: "2021-12-31",
      quantity: 1,
      simpleLocation: null,
    },
    { asOf: new Date("2026-06-13T12:00:00Z") }
  );

  assert.equal(intelligence.readiness.state, "past_peak");
  assert.equal(intelligence.bottleBrainRole.role, "triage_now");
  assert.equal(intelligence.location.status, "missing");
  assert.ok(intelligence.nextSignals.some((signal) => signal.kind === "open_or_review"));
}

function testCriticScoreExtractionIsSourceLabeled() {
  const intelligence = buildBottleIntelligence({
    ...baseBottle,
    criticScores: { wine_spectator: 94, james_suckling: "95" },
  });

  assert.equal(intelligence.criticScores.length, 2);
  assert.deepEqual(intelligence.criticScores[0], {
    source: "James Suckling",
    score: 95,
    label: "James Suckling 95",
  });
}

function testFieldCaptureRatingFeedsBottleIntelligenceMemory() {
  const draft = buildReviewDraft(tapizDemoCandidate, {
    score: 95,
    buy_again: "yes",
    occasion: "best wines ever — reference Cab",
    descriptors: "smooth, rich, long finish",
    notes: "One of the best wines ever.",
  });
  const rating = buildFieldCaptureRatingPayload(draft, { inventoryId: "cellar-1", wineReferenceId: null });
  assert.ok(rating);
  const intelligence = buildBottleIntelligence({
    ...baseBottle,
    id: "cellar-1",
    name: tapizDemoCandidate.label ?? "Tapiz",
    producer: tapizDemoCandidate.producer,
    vintage: tapizDemoCandidate.vintage,
    region: tapizDemoCandidate.region,
    country: tapizDemoCandidate.country,
    wineType: tapizDemoCandidate.wine_type,
    grapeVarieties: [tapizDemoCandidate.varietal ?? "Cabernet Sauvignon"],
    ratings: [{ score: rating.score, tastingNotes: rating.tasting_notes, tastingDate: "2026-06-25" }],
  });
  assert.equal(intelligence.memoryDensity.state, "emerging");
  assert.equal(intelligence.memoryDensity.ratingCount, 1);
  assert.match(intelligence.memoryDensity.latestMemory ?? "", /best wines ever|smooth|rich|long finish/i);
  assert.equal(intelligence.dossier.benchmark.status, "self_benchmark");
}

testBuildsWorldClassBottleIntelligenceCard();
testFlagsThinBottleAsLearningPickWithReferenceDerivedStructure();
testTriagePastPeakAndMissingLocation();
testCriticScoreExtractionIsSourceLabeled();
testFieldCaptureRatingFeedsBottleIntelligenceMemory();

console.log("bottle-intelligence tests passed");
