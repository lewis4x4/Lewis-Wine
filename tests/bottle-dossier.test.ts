import assert from "node:assert/strict";
import { buildBottleIntelligence, buildBottlePriceEvidenceFromObservations, type BottleIntelligenceInput } from "../src/lib/bottle-intelligence";

const bottle: BottleIntelligenceInput = {
  id: "inv-1",
  name: "Alta Collection Cabernet Sauvignon",
  producer: "Tapiz",
  vintage: 2021,
  region: "Mendoza",
  country: "Argentina",
  wineType: "red",
  grapeVarieties: ["Cabernet Sauvignon"],
  quantity: 1,
  bottleSizeMl: 750,
  drinkAfter: "2024-01-01",
  drinkBefore: "2028-12-31",
  purchasePriceCents: 4200,
  currentMarketValueCents: 1899,
  marketValueSource: "wine_searcher",
  simpleLocation: "Ready rack",
  brianFit: {
    score: 96,
    confidence: 88,
    reason: "Matches Brian's benchmark Cabernet lane.",
  },
  ratings: [
    {
      score: 95,
      tastingDate: "2026-06-24",
      tastingNotes: "Smooth, rich, long finish — one of the best wines ever.",
      body: "full",
      tannins: "medium_plus",
      acidity: "medium",
      sweetness: "dry",
      finish: "long",
    },
  ],
  benchmarkWines: [
    { id: "tapiz-benchmark", label: "Tapiz 2021 Alta Cabernet", producer: "Tapiz", varietal: "Cabernet Sauvignon", region: "Mendoza", score: 95 },
    { id: "pinot-benchmark", label: "Willamette Pinot", producer: "Other", varietal: "Pinot Noir", region: "Oregon", score: 94 },
  ],
  priceEvidence: {
    acceptedCount: 5,
    staleCount: 0,
    bestMarketValueCents: 1899,
    bestReplacementPriceCents: 1499,
    sourceLabel: "ABC Fine Wine & Spirits",
    sourceUrl: "https://example.com/tapiz",
    confidence: 93,
  },
};

function testBuildsPremiumDossierSignals() {
  const intelligence = buildBottleIntelligence(bottle, { asOf: new Date("2026-06-24T12:00:00Z") });

  assert.equal(intelligence.dossier.headline, "Pour with confidence");
  assert.equal(intelligence.dossier.benchmark.status, "matches_benchmark");
  assert.equal(intelligence.dossier.benchmark.label, "Tapiz 2021 Alta Cabernet");
  assert.ok(intelligence.dossier.benchmark.reason.includes("Tapiz"));
  assert.equal(intelligence.dossier.priceEvidence.status, "source_backed");
  assert.equal(intelligence.dossier.priceEvidence.bestAvailableCents, 1499);
  assert.equal(intelligence.dossier.priceEvidence.sourceLabel, "ABC Fine Wine & Spirits");
  assert.equal(intelligence.dossier.drinkPlan.primaryAction, "Open with intent");
  assert.ok(intelligence.dossier.drinkPlan.reason.includes("benchmark"));
  assert.ok(intelligence.dossier.actions.some((action) => action.id === "find-more" && action.primary));
  assert.ok(intelligence.dossier.actions.some((action) => action.href.includes("/capture")));
}

function testHoldBottleDossierDoesNotOverRecommend() {
  const intelligence = buildBottleIntelligence(
    {
      ...bottle,
      drinkAfter: "2030-01-01",
      drinkBefore: "2038-12-31",
      ratings: [],
      brianFit: { score: 91, confidence: 70, reason: "Strong profile match, but not ready." },
    },
    { asOf: new Date("2026-06-24T12:00:00Z") }
  );

  assert.equal(intelligence.readiness.state, "hold");
  assert.equal(intelligence.dossier.headline, "Hold intentionally");
  assert.equal(intelligence.dossier.drinkPlan.primaryAction, "Do not open yet");
  assert.ok(intelligence.dossier.drinkPlan.reason.includes("readiness"));
}

function testUnknownEvidenceStaysHonest() {
  const intelligence = buildBottleIntelligence({
    ...bottle,
    currentMarketValueCents: null,
    purchasePriceCents: null,
    priceEvidence: undefined,
    benchmarkWines: [],
    brianFit: null,
    ratings: [],
    simpleLocation: null,
    drinkAfter: null,
    drinkBefore: null,
  });

  assert.equal(intelligence.dossier.priceEvidence.status, "missing");
  assert.equal(intelligence.dossier.benchmark.status, "no_signal");
  assert.equal(intelligence.dossier.headline, "Build the dossier");
  assert.ok(intelligence.dossier.actions.some((action) => action.id === "add-location"));
}

function testBuildsDossierPriceEvidenceFromAcceptedObservations() {
  const evidence = buildBottlePriceEvidenceFromObservations([
    {
      review_status: "accepted",
      observation_kind: "replacement_price",
      observed_price_cents: 1799,
      source_name: "Wine.com",
      source_url: "https://example.com/wine",
      confidence: 84,
      truth_label: "estimated",
      observed_at: "2026-06-24T12:00:00Z",
    },
    {
      review_status: "accepted",
      observation_kind: "market_value",
      observed_price_cents: 4200,
      source_name: "Manual cellar value",
      confidence: 92,
      truth_label: "verified",
      observed_at: "2026-06-24T12:00:00Z",
    },
    {
      review_status: "draft",
      observation_kind: "replacement_price",
      observed_price_cents: 999,
      source_name: "Unreviewed draft",
      confidence: 99,
      truth_label: "estimated",
      observed_at: "2026-06-24T12:00:00Z",
    },
  ]);

  assert.deepEqual(evidence, {
    acceptedCount: 2,
    staleCount: 0,
    bestMarketValueCents: 4200,
    bestReplacementPriceCents: 1799,
    sourceLabel: "Wine.com",
    sourceUrl: "https://example.com/wine",
    confidence: 84,
  });
}

testBuildsPremiumDossierSignals();
testHoldBottleDossierDoesNotOverRecommend();
testUnknownEvidenceStaysHonest();
testBuildsDossierPriceEvidenceFromAcceptedObservations();

console.log("bottle-dossier tests passed");
