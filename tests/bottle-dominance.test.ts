import assert from "node:assert/strict";
import {
  buildBottleDominanceDraft,
  buildSafeDominancePatch,
  getBottleConfidenceScore,
  summarizeDominanceProviderStatus,
  type BottleDominanceRecord,
} from "../src/lib/bottle-dominance";

const sparseBottle: BottleDominanceRecord = {
  id: "inv-1",
  wine_reference_id: null,
  custom_name: "Estate Cabernet",
  custom_producer: "Lewis Reserve",
  custom_region: "Napa Valley",
  vintage: 2021,
  custom_vintage: 2021,
  custom_wine_type: "red",
  quantity: 2,
  purchase_price_cents: 9500,
  current_market_value_cents: null,
  market_value_source: null,
  market_value_updated_at: null,
  drink_after: null,
  drink_before: null,
  notes: null,
  ratings: [],
  wine_reference: null,
};

const referenceBacked: BottleDominanceRecord = {
  ...sparseBottle,
  wine_reference_id: "ref-1",
  wine_reference: {
    id: "ref-1",
    name: "Estate Cabernet Sauvignon",
    producer: "Lewis Reserve",
    region: "Napa Valley",
    sub_region: "Oakville",
    country: "United States",
    appellation: "Oakville",
    grape_varieties: ["Cabernet Sauvignon"],
    wine_type: "red",
    alcohol_percentage: 14.8,
    drink_window_start: 2026,
    drink_window_end: 2036,
    critic_scores: { critic: 94 },
  },
};

function testDraftCreatesReviewableSuggestions() {
  const draft = buildBottleDominanceDraft(referenceBacked, {
    asOf: "2026-06-13T12:00:00.000Z",
    market: {
      provider: "Wine-Searcher",
      valueCents: 12800,
      lowCents: 11800,
      highCents: 14500,
      merchantCount: 14,
      sourceUrl: "https://example.com/market",
      checkedAt: "2026-06-13T12:00:00.000Z",
      confidence: 84,
    },
  });

  assert.equal(draft.title, "Dominate this bottle");
  assert.equal(draft.identity.confidence, 95);
  assert.equal(draft.market.status, "verified");
  assert.ok(draft.suggestions.some((s) => s.field === "current_market_value_cents" && s.proposedValue === 12800));
  assert.ok(draft.suggestions.some((s) => s.field === "drink_after" && s.proposedValue === "2026"));
  assert.ok(draft.evidence.some((e) => e.sourceType === "market" && e.truthLabel === "verified"));
  assert.ok(draft.evidence.some((e) => e.sourceType === "reference" && e.truthLabel === "verified"));
}

function testNoFakePricingWhenProviderMissing() {
  const draft = buildBottleDominanceDraft(sparseBottle, { asOf: "2026-06-13T12:00:00.000Z" });
  assert.equal(draft.market.status, "unknown");
  assert.ok(!draft.suggestions.some((s) => s.field === "current_market_value_cents"));
  assert.ok(draft.gaps.some((g) => g.kind === "market"));
}

function testSafePatchOnlyAppliesAcceptedSuggestions() {
  const draft = buildBottleDominanceDraft(referenceBacked, {
    asOf: "2026-06-13T12:00:00.000Z",
    market: {
      provider: "Wine-Searcher",
      valueCents: 12800,
      checkedAt: "2026-06-13T12:00:00.000Z",
      confidence: 84,
    },
  });

  const marketSuggestion = draft.suggestions.find((s) => s.field === "current_market_value_cents");
  assert.ok(marketSuggestion);
  const patch = buildSafeDominancePatch(draft, [marketSuggestion.id]);
  assert.deepEqual(patch, {
    current_market_value_cents: 12800,
    market_value_source: "wine-searcher",
    market_value_updated_at: "2026-06-13T12:00:00.000Z",
  });
}

function testConfidenceScoreSeparatesIdentityMarketReadinessMemory() {
  const score = getBottleConfidenceScore(buildBottleDominanceDraft(referenceBacked, { asOf: "2026-06-13T12:00:00.000Z" }));
  assert.equal(score.identity, 95);
  assert.equal(score.market, 20);
  assert.equal(score.readiness, 90);
  assert.equal(score.memory, 0);
  assert.equal(score.overall, 61);
}

function testProviderStatusIsExplicit() {
  assert.equal(summarizeDominanceProviderStatus({ wineSearcherConfigured: false, anthropicConfigured: true }).pricing, "not_configured");
  assert.equal(summarizeDominanceProviderStatus({ wineSearcherConfigured: true, anthropicConfigured: false }).ai, "not_configured");
}

testDraftCreatesReviewableSuggestions();
testNoFakePricingWhenProviderMissing();
testSafePatchOnlyAppliesAcceptedSuggestions();
testConfidenceScoreSeparatesIdentityMarketReadinessMemory();
testProviderStatusIsExplicit();

console.log("bottle-dominance tests passed");
