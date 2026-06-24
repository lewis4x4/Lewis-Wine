import assert from "node:assert/strict";
import { buildTasteGenomeDashboard, type TasteGenomeDashboardInput } from "../src/lib/taste-genome-dashboard";

const input: TasteGenomeDashboardInput = {
  firstParty: {
    sampleSize: 12,
    averageRating: 92.4,
    confidence: { level: "proven", explanation: "12 ratings available; enough for durable patterns." },
    headline: "Mendoza and smoothness are the clearest taste signals so far.",
    affinities: {
      regions: [{ name: "Mendoza", averageRating: 95, count: 4, lift: 2.6, confidence: "proven" }],
      types: [{ name: "Cabernet Sauvignon", averageRating: 94.2, count: 5, lift: 1.8, confidence: "proven" }],
      producers: [{ name: "Tapiz", averageRating: 95, count: 3, lift: 2.6, confidence: "proven" }],
    },
    structureProfile: [
      { dimension: "smoothness", label: "Smoothness", average: 4.8, signalCount: 8, confidence: "proven" },
      { dimension: "finish_length", label: "Finish", average: 4.7, signalCount: 8, confidence: "proven" },
    ],
    valuePattern: {
      bestValue: { id: "tapiz", label: "2021 Tapiz Mendoza", score: 95, priceCents: 1899, valueIndex: 39.5 },
      underperformers: [],
      summary: "Tapiz is the strongest value signal so far.",
    },
    actionPlan: { buyMore: [], watchlist: [], compareNext: [], improveConfidence: [] },
    insights: ["Smoothness is the most visible structural preference."],
  },
  activeProfile: {
    lovedDescriptors: ["smooth", "rich", "long finish", "black fruit"],
    preferredRegions: ["Mendoza", "Napa Valley"],
    preferredVarietals: ["Cabernet Sauvignon"],
    preferredProducers: ["Tapiz"],
    priceBand: { low: 15, typical: 21, high: 38 },
    avoidList: ["thin merlot"],
    benchmarkWineIds: ["wine-tapiz"],
    refreshedAt: "2026-06-24T12:00:00Z",
  },
  brianFitProfile: {
    favoriteDescriptors: ["velvety", "structured"],
    avoidDescriptors: ["flabby"],
    confidenceScore: 86,
    summary: "Cabernet benchmark profile is strong.",
    updatedAt: "2026-06-24T12:00:00Z",
  },
};

function testDashboardProducesWorldClassSummary() {
  const dashboard = buildTasteGenomeDashboard(input);

  assert.equal(dashboard.headline, "Mendoza and smoothness are the clearest taste signals so far.");
  assert.equal(dashboard.confidence.label, "proven");
  assert.equal(dashboard.confidence.score, 86);
  assert.equal(dashboard.metrics[0].label, "Rated bottles");
  assert.equal(dashboard.metrics[0].value, "12");
  assert.equal(dashboard.priceBand.typicalLabel, "$21");
  assert.equal(dashboard.benchmarkSummary, "1 benchmark bottle anchoring the profile");
}

function testDashboardRanksLanesAndSignals() {
  const dashboard = buildTasteGenomeDashboard(input);

  assert.equal(dashboard.lanes.producers[0].name, "Tapiz");
  assert.equal(dashboard.lanes.varietals[0].name, "Cabernet Sauvignon");
  assert.equal(dashboard.lanes.regions[0].name, "Mendoza");
  assert.deepEqual(dashboard.lovedDescriptors.slice(0, 4).map((item) => item.label), ["smooth", "rich", "long finish", "black fruit"]);
  assert.deepEqual(dashboard.avoidSignals.map((item) => item.label), ["thin merlot", "flabby"]);
  assert.equal(dashboard.structureFingerprint[0].label, "Smoothness");
}

function testEmptyDashboardIsHonest() {
  const dashboard = buildTasteGenomeDashboard({});

  assert.equal(dashboard.confidence.label, "empty");
  assert.equal(dashboard.metrics[0].value, "0");
  assert.equal(dashboard.lanes.regions.length, 0);
  assert.match(dashboard.nextActions[0], /Capture|Rate/);
}

testDashboardProducesWorldClassSummary();
testDashboardRanksLanesAndSignals();
testEmptyDashboardIsHonest();

console.log("taste-genome-dashboard tests passed");
