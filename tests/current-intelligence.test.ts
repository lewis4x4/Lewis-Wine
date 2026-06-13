import assert from "node:assert/strict";
import {
  buildBottleSearchIdentity,
  buildRefreshPlan,
  classifyEvidenceKind,
  classifySourcePolicy,
  normalizeAiEvidenceCandidates,
  shouldSkipRefresh,
  type AiEvidenceCandidate,
  type ExistingEvidenceSignal,
} from "@/lib/current-intelligence";

const bottle = {
  id: "inv-1",
  custom_name: "Estate Cabernet Sauvignon",
  custom_producer: "Lewis Cellars",
  custom_region: "Napa Valley",
  vintage: 2019,
  wine_reference: null,
};

{
  const identity = buildBottleSearchIdentity(bottle);
  assert.equal(identity.query, "2019 Lewis Cellars Estate Cabernet Sauvignon Napa Valley 750ml wine");
  assert.equal(identity.confidence, 72);
}

{
  const plan = buildRefreshPlan(bottle, "quick", [], "2026-06-13T00:00:00.000Z");
  assert.deepEqual(plan.targets, ["identity", "pricing"]);
  assert.equal(plan.queries[0].includes("current price"), true);
  assert.equal(plan.queries.some((query) => query.includes("serving temperature")), false);
}

{
  const plan = buildRefreshPlan(bottle, "deep", [], "2026-06-13T00:00:00.000Z");
  assert.equal(plan.targets.includes("readiness"), true);
  assert.equal(plan.targets.includes("serving"), true);
  assert.equal(plan.queries.some((query) => query.includes("tech sheet")), true);
}

{
  const fresh: ExistingEvidenceSignal[] = [{ kind: "replacement_price", observedAt: "2026-06-01T00:00:00.000Z", reviewStatus: "accepted" }];
  assert.equal(shouldSkipRefresh(fresh, "pricing", "2026-06-13T00:00:00.000Z"), true);
  assert.equal(shouldSkipRefresh(fresh, "deep", "2026-06-13T00:00:00.000Z"), false);
}

{
  assert.equal(classifySourcePolicy("https://www.winery.example/tech-sheet.pdf").allowedUse.includes("producer_fact"), true);
  assert.equal(classifySourcePolicy("https://www.vivino.com/wines/123").extractionAllowed, false);
  assert.equal(classifySourcePolicy("https://shop.example/wine").allowedUse.includes("replacement_price"), true);
  assert.equal(classifyEvidenceKind({ domain: "retailer.example", sourceType: "retailer" }, { kind: "market_value" }), "replacement_price");
}

{
  const candidates: AiEvidenceCandidate[] = [
    {
      title: "Retail listing",
      url: "https://retailer.example/lewis-cab-2019",
      sourceType: "retailer",
      extractedText: "$129.99 per 750ml bottle",
      priceCents: 12999,
      currency: "USD",
      vintage: 2019,
      bottleSizeMl: 750,
      confidence: 78,
    },
    {
      title: "Forum guess",
      sourceType: "ai_search",
      extractedText: "Likely worth around $150",
      priceCents: 15000,
      currency: "USD",
      confidence: 45,
    },
  ];
  const normalized = normalizeAiEvidenceCandidates(candidates, buildRefreshPlan(bottle, "pricing", [], "2026-06-13T00:00:00.000Z"));
  assert.equal(normalized.observations[0].observationKind, "replacement_price");
  assert.equal(normalized.observations[0].truthLabel, "estimated");
  assert.equal(normalized.observations[1].truthLabel, "ai_inferred");
  assert.equal(normalized.gaps.length, 0);
}

{
  const normalized = normalizeAiEvidenceCandidates([
    {
      title: "Wrong vintage",
      url: "https://retailer.example/lewis-cab-2018",
      sourceType: "retailer",
      extractedText: "2018 bottle $99",
      priceCents: 9900,
      currency: "USD",
      vintage: 2018,
      confidence: 80,
    },
  ], buildRefreshPlan(bottle, "pricing", [], "2026-06-13T00:00:00.000Z"));
  assert.equal(normalized.observations[0].confidence < 80, true);
  assert.equal(normalized.gaps.some((gap) => gap.includes("vintage")), true);
}

console.log("current-intelligence tests passed");
