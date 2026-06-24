import assert from "node:assert/strict";
import {
  brianFitScore,
  chooseCaptureFollowUp,
  compareBenchmarkTasting,
  computeTasteProfile,
  confidenceLabel,
  filterSourcedObservations,
  normalizeCaptureExtraction,
  pickBestObservation,
  type AdvisorLineItem,
  type BenchmarkInput,
  type PriceObservationDraft,
  type TastingProfileInput,
} from "../src/lib/pourfolio-intelligence";

{
  const extraction = normalizeCaptureExtraction({
    producer: "Tapiz",
    label: "Alta Collection Cabernet Sauvignon",
    vintage: "2021",
    region: "Mendoza",
    varietal: "Cabernet Sauvignon",
    wine_type: "red",
    confidence: { producer: 0.92, vintage: 0.88 },
    ambiguous_fields: [],
  });
  assert.equal(extraction.vintage, 2021);
  assert.equal(extraction.wineType, "red");
  assert.equal(chooseCaptureFollowUp(extraction), null);
}

{
  const extraction = normalizeCaptureExtraction({
    producer: "",
    label: "Estate Cabernet",
    vintage: 2021,
    confidence: { producer: 0.41, vintage: 0.95 },
  });
  const followUp = chooseCaptureFollowUp(extraction);
  assert.equal(followUp?.field, "producer");
  assert.match(followUp?.question ?? "", /producer/i);
}

{
  const extraction = normalizeCaptureExtraction({
    producer: "Tapiz",
    label: "Alta Collection",
    vintage: null,
    confidence: { producer: 0.95, vintage: 0.2 },
  });
  const followUp = chooseCaptureFollowUp(extraction);
  assert.equal(followUp?.field, "vintage");
}

{
  const benchmarks: BenchmarkInput[] = [
    { id: "b1", producer: "Tapiz", label: "Alta Cab", score: 95, region: "Mendoza", varietal: "Cabernet Sauvignon", descriptors: ["smooth", "rich", "long finish"] },
    { id: "b2", producer: "Lewis", label: "Reserve Cab", score: 94, region: "Napa", varietal: "Cabernet Sauvignon", descriptors: ["smooth", "bold"] },
  ];
  const comparison = compareBenchmarkTasting({ score: 96, region: "Mendoza", varietal: "Cabernet Sauvignon", descriptors: ["smooth", "rich"] }, benchmarks);
  assert.equal(comparison[0].id, "b1");
  assert.equal(comparison[0].sharedDescriptors.includes("smooth"), true);
  assert.equal(comparison[0].scoreDelta, 1);
}

{
  const drafts: PriceObservationDraft[] = [
    { sourceName: "No URL", price: 10, currency: "USD", availability: "in_stock", confidence: 0.9 },
    { sourceName: "Retailer", sourceUrl: "https://shop.example/wine", price: 42, currency: "USD", availability: "in_stock", confidence: 0.82 },
    { sourceName: "Thin", sourceUrl: "https://thin.example/wine", price: 39, currency: "USD", availability: "unknown", confidence: 0.4 },
  ];
  const filtered = filterSourcedObservations(drafts);
  assert.equal(filtered.length, 2);
  assert.equal(filtered.every((row) => row.sourceUrl && row.confidence >= 0 && row.confidence <= 1), true);
  assert.equal(pickBestObservation(filtered)?.sourceName, "Retailer");
  assert.equal(confidenceLabel(0.8), "High");
  assert.equal(confidenceLabel(0.5), "Medium");
  assert.equal(confidenceLabel(0.49), "Low");
}

{
  const tastings: TastingProfileInput[] = [
    { id: "t1", wineId: "w1", producer: "Tapiz", region: "Mendoza", varietal: "Cabernet Sauvignon", score: 95, descriptors: ["smooth", "rich", "long finish"], buyAgain: "yes" },
    { id: "t2", wineId: "w2", producer: "Lewis", region: "Napa", varietal: "Cabernet Sauvignon", score: 94, descriptors: ["smooth", "bold"], buyAgain: "yes" },
    { id: "t3", wineId: "w3", producer: "Miss", region: "Bordeaux", varietal: "Merlot", score: 78, descriptors: ["thin"], buyAgain: "no" },
  ];
  const profile = computeTasteProfile(tastings, [{ wineId: "w1", price: 85 }, { wineId: "w2", price: 120 }]);
  assert.deepEqual(profile.benchmarkWineIds, ["w1", "w2"]);
  assert.equal(profile.lovedDescriptors[0], "smooth");
  assert.equal(profile.preferredVarietals[0], "Cabernet Sauvignon");
  assert.equal(profile.preferredProducers.includes("Tapiz"), true);
  assert.equal(profile.avoidList.includes("Miss Merlot"), true);
  assert.equal(profile.priceBand.typical, 103);
}

{
  const item: AdvisorLineItem = {
    producer: "Tapiz",
    label: "Alta Collection",
    vintage: 2021,
    varietal: "Cabernet Sauvignon",
    region: "Mendoza",
    price: 95,
    descriptors: ["smooth", "rich"],
  };
  const fit = brianFitScore(item, {
    lovedDescriptors: ["smooth", "rich", "long finish"],
    preferredRegions: ["Mendoza"],
    preferredVarietals: ["Cabernet Sauvignon"],
    preferredProducers: ["Tapiz"],
    priceBand: { low: 60, typical: 100, high: 150 },
    avoidList: [],
    benchmarkWineIds: ["w1"],
    refreshedAt: "2026-06-23T00:00:00.000Z",
  });
  assert.equal(fit.score >= 90, true);
  assert.equal(fit.tier, "pour");
  assert.equal(fit.reasons.length > 0, true);
}

{
  const fit = brianFitScore({ producer: "Miss", label: "Merlot", varietal: "Merlot", price: 40, descriptors: ["thin"] }, {
    lovedDescriptors: ["smooth"],
    preferredRegions: [],
    preferredVarietals: [],
    preferredProducers: [],
    priceBand: { low: 50, typical: 90, high: 140 },
    avoidList: ["Miss Merlot"],
    benchmarkWineIds: [],
    refreshedAt: "2026-06-23T00:00:00.000Z",
  });
  assert.equal(fit.tier, "skip");
  assert.equal(fit.score <= 15, true);
  assert.match(fit.reasons.join(" "), /avoid/i);
}

console.log("pourfolio-intelligence tests passed");
