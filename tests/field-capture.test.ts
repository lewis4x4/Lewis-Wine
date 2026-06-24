import assert from "node:assert/strict";
import {
  buildCaptureWineRequest,
  buildReviewDraft,
  buildSaveTastingPayload,
  createPostSaveActions,
  isBenchmarkScore,
  normalizeDescriptorText,
  type CaptureWineCandidate,
} from "../src/lib/field-capture";

const candidate: CaptureWineCandidate = {
  producer: "Tapiz",
  label: "Alta Collection Cabernet Sauvignon",
  vintage: 2021,
  region: "Mendoza",
  subregion: "San Pablo Vineyard, Uco Valley",
  country: "Argentina",
  varietal: "Cabernet Sauvignon",
  wine_type: "red",
  confidence: { producer: 0.95, label: 0.9, vintage: 0.92, region: 0.86, varietal: 0.94, wine_type: 0.9 },
  ambiguous_fields: [],
};

function testBuildCaptureRequestFromDataUrl() {
  const request = buildCaptureWineRequest("data:image/png;base64,QUJD");
  assert.equal(request.media_type, "image/png");
  assert.equal(request.image_base64, "QUJD");
}

function testRejectsInvalidCaptureImage() {
  assert.throws(() => buildCaptureWineRequest("not-a-data-url"), /valid image data URL/);
  assert.throws(() => buildCaptureWineRequest("data:text/plain;base64,QUJD"), /JPEG, PNG, WebP, or GIF/);
}

function testBuildReviewDraftPreservesIntelligence() {
  const draft = buildReviewDraft(candidate, {
    score: 95,
    buy_again: "yes",
    occasion: "best wines ever — reference Cab",
    descriptors: " smooth, rich\nlong finish, smooth ",
    notes: "One of the best wines ever.",
  });

  assert.equal(draft.title, "2021 Tapiz Alta Collection Cabernet Sauvignon");
  assert.equal(draft.is_benchmark, true);
  assert.deepEqual(draft.descriptors, ["smooth", "rich", "long finish"]);
  assert.equal(draft.benchmark_prompt?.includes("reference Cab"), true);
  assert.equal(draft.confidence_label, "High confidence");
}

function testBenchmarkThreshold() {
  assert.equal(isBenchmarkScore(93), false);
  assert.equal(isBenchmarkScore(94), true);
  assert.equal(isBenchmarkScore(100), true);
  assert.equal(isBenchmarkScore(null), false);
}

function testSavePayloadIsDatabaseReady() {
  const draft = buildReviewDraft(candidate, {
    score: 95,
    buy_again: "yes",
    occasion: "best wines ever — reference Cab",
    descriptors: "smooth, rich, long finish",
    notes: "One of the best wines ever.",
  });
  const payload = buildSaveTastingPayload(draft);

  assert.deepEqual(payload.wine, {
    producer: "Tapiz",
    label: "Alta Collection Cabernet Sauvignon",
    vintage: 2021,
    region: "Mendoza",
    subregion: "San Pablo Vineyard, Uco Valley",
    country: "Argentina",
    varietal: "Cabernet Sauvignon",
    wine_type: "red",
  });
  assert.equal(payload.tasting.score, 95);
  assert.equal(payload.tasting.buy_again, "yes");
  assert.equal(payload.tasting.occasion, "best wines ever — reference Cab");
  assert.equal(payload.tasting.is_benchmark, true);
  assert.deepEqual(payload.tasting.descriptors, ["smooth", "rich", "long finish"]);
  assert.equal(payload.tasting.extraction.candidate.producer, "Tapiz");
}

function testPostSaveActionsArePractical() {
  const actions = createPostSaveActions({ wine_id: "wine-1", tasting_id: "taste-1", is_benchmark: true, buy_again: "yes" });
  assert.deepEqual(actions.map((action) => action.id), ["find-more", "buy-again", "view-bottle", "capture-another"]);
  assert.equal(actions[0].href, "/intelligence?wine_id=wine-1&action=find-more");
}

function testDescriptorNormalization() {
  assert.deepEqual(normalizeDescriptorText(" Cassis, cassis\ncedar ; long finish "), ["Cassis", "cedar", "long finish"]);
}

for (const test of [
  testBuildCaptureRequestFromDataUrl,
  testRejectsInvalidCaptureImage,
  testBuildReviewDraftPreservesIntelligence,
  testBenchmarkThreshold,
  testSavePayloadIsDatabaseReady,
  testPostSaveActionsArePractical,
  testDescriptorNormalization,
]) {
  test();
}

console.log("field-capture tests passed");
