import assert from "node:assert/strict";
import {
  buildCaptureFollowUpHint,
  buildCaptureWineRequest,
  buildEvidenceUpload,
  buildFieldCaptureCellarPayload,
  buildFieldCaptureAcquisitionTargetPayload,
  buildFieldCaptureBuyAgainQueuePayload,
  buildFieldCaptureCandidateFromLabelScan,
  buildFieldCaptureRatingPayload,
  buildFieldCaptureRatingSignalPayload,
  buildReviewDraft,
  buildSaveTastingPayload,
  buildWineIdentityKey,
  canSaveFieldCaptureDraft,
  createPostSaveActions,
  normalizeFieldCaptureIdempotencyKey,
  shouldEnterCaptureFollowUp,
  isBenchmarkScore,
  normalizeDescriptorText,
  tapizDemoCandidate,
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
  const request = buildCaptureWineRequest("data:image/png;base64,QUJD", "  Producer is Zuccardi Q  ");
  assert.equal(request.media_type, "image/png");
  assert.equal(request.image_base64, "QUJD");
  assert.equal(request.hint, "Producer is Zuccardi Q");
}

function testRejectsInvalidCaptureImage() {
  assert.throws(() => buildCaptureWineRequest("not-a-data-url"), /valid image data URL/);
  assert.throws(() => buildCaptureWineRequest("data:text/plain;base64,QUJD"), /JPEG, PNG, WebP, or GIF/);
}

function testBuildsFieldCaptureCandidateFromLabelScan() {
  const scanned = buildFieldCaptureCandidateFromLabelScan({
    name: "Cabernet Sauvignon",
    producer: "Zuccardi Q",
    vintage: 2020,
    wine_type: "red",
    region: "Valle de Uco, Mendoza",
    sub_region: null,
    appellation: "Valle de Uco",
    country: "Argentina",
    grape_varieties: ["Cabernet Sauvignon"],
    confidence: 88,
  });

  assert.equal(scanned.producer, "Zuccardi Q");
  assert.equal(scanned.label, "Cabernet Sauvignon");
  assert.equal(scanned.vintage, 2020);
  assert.equal(scanned.subregion, "Valle de Uco");
  assert.equal(scanned.varietal, "Cabernet Sauvignon");
  assert.equal(scanned.confidence?.producer, 0.88);
  assert.deepEqual(scanned.ambiguous_fields, []);
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

function testSavePayloadNormalizesRoseAccentForDatabase() {
  const payload = buildSaveTastingPayload(buildReviewDraft({ ...candidate, wine_type: "rosé" }, {
    score: 90,
    buy_again: "maybe",
    occasion: "shop tasting",
    descriptors: "red fruit",
    notes: "accent normalization proof",
  }));
  assert.equal(payload.wine.wine_type, "rose");
}

function testSaveReadinessMirrorsServerAndDatabaseConstraints() {
  assert.equal(canSaveFieldCaptureDraft(buildReviewDraft({ ...candidate, label: null }, { score: 90, buy_again: "maybe", occasion: "shop", descriptors: "", notes: "" })).ok, false);
  assert.equal(canSaveFieldCaptureDraft(buildReviewDraft({ ...candidate, vintage: 1700 }, { score: 90, buy_again: "maybe", occasion: "shop", descriptors: "", notes: "" })).ok, false);
  assert.equal(canSaveFieldCaptureDraft(buildReviewDraft(candidate, { score: 49, buy_again: "maybe", occasion: "shop", descriptors: "", notes: "" })).ok, false);
  assert.equal(canSaveFieldCaptureDraft(buildReviewDraft(candidate, { score: null, buy_again: "maybe", occasion: "shop", descriptors: "", notes: "" })).ok, true);
}

function testPostSaveActionsArePractical() {
  const actions = createPostSaveActions({ wine_id: "wine-1", tasting_id: "taste-1", inventory_id: "inventory-1", rating_id: "rating-1", is_benchmark: true, buy_again: "yes" });
  assert.deepEqual(actions.map((action) => action.id), ["find-more", "buy-again", "view-bottle", "capture-another"]);
  assert.equal(actions[0].href, "/intelligence?wine_id=wine-1&action=find-more");
  assert.equal(actions[2].href, "/cellar/inventory-1?tasting=rating-1");
}

function testDescriptorNormalization() {
  assert.deepEqual(normalizeDescriptorText(" Cassis, cassis\ncedar ; long finish "), ["Cassis", "cedar", "long finish"]);
}

function testWineIdentityKeyNormalizesCaseWhitespaceAndVintage() {
  assert.equal(
    buildWineIdentityKey({ producer: "  TAPIZ ", vintage: 2021, label: " Alta   Collection Cabernet Sauvignon " }),
    "tapiz|2021|alta collection cabernet sauvignon"
  );
  assert.notEqual(
    buildWineIdentityKey({ producer: "Tapiz", vintage: 2020, label: "Alta Collection Cabernet Sauvignon" }),
    buildWineIdentityKey({ producer: "Tapiz", vintage: 2021, label: "Alta Collection Cabernet Sauvignon" })
  );
  assert.equal(buildWineIdentityKey({ producer: null, vintage: null, label: "House Red" }), "||house red");
}

function testTapizDemoCandidateOpensAsBenchmarkReview() {
  const draft = buildReviewDraft(tapizDemoCandidate, {
    score: 95,
    buy_again: "yes",
    occasion: "best wines ever — reference Cab",
    descriptors: "smooth, rich, long finish",
    notes: "One of the best wines ever.",
  });

  assert.equal(draft.producer, "Tapiz");
  assert.equal(draft.label, "Alta Collection Cabernet Sauvignon");
  assert.equal(draft.is_benchmark, true);
  assert.ok(draft.benchmark_prompt?.toLowerCase().includes("benchmark"));
}

function testEvidenceUploadUsesPrivateOwnerScopedPath() {
  const upload = buildEvidenceUpload({
    ownerId: "user-123",
    wineId: "wine-456",
    dataUrl: "data:image/jpeg;base64,QUJD",
    token: "capture-token",
  });

  assert.equal(upload.bucket, "wine-evidence");
  assert.equal(upload.path, "user-123/bottles/wine-456/capture-token.jpg");
  assert.equal(upload.contentType, "image/jpeg");
  assert.equal(Buffer.from(upload.bytes).toString("utf8"), "ABC");
}

function testEvidenceUploadRejectsInvalidOrOversizedEvidence() {
  assert.throws(() => buildEvidenceUpload({ ownerId: "user-123", wineId: "wine-456", dataUrl: "data:text/plain;base64,QUJD", token: "x" }), /JPEG, PNG, WebP, or GIF/);
  assert.throws(() => buildEvidenceUpload({ ownerId: "user-123", wineId: "wine-456", dataUrl: "data:image/png;base64,!!!!", token: "x" }), /valid base64/);
  assert.throws(() => buildEvidenceUpload({ ownerId: "", wineId: "wine-456", dataUrl: "data:image/png;base64,QUJD", token: "x" }), /owner/);
}

function testSavePayloadKeepsRawEvidenceOutOfExtraction() {
  const draft = {
    ...buildReviewDraft(candidate, {
      score: 95,
      buy_again: "yes" as const,
      occasion: "best wines ever — reference Cab",
      descriptors: "smooth, rich, long finish",
      notes: "One of the best wines ever.",
    }),
    evidence_data_url: "data:image/jpeg;base64,QUJD",
  };

  const payload = buildSaveTastingPayload(draft);
  assert.equal(payload.evidence_data_url, "data:image/jpeg;base64,QUJD");
  assert.equal(JSON.stringify(payload.tasting.extraction).includes("QUJD"), false);
}

function testCaptureFollowUpRunsOnceForAmbiguousResponse() {
  const response = {
    candidate: { ...candidate, producer: null, confidence: { producer: 0.2 }, ambiguous_fields: ["producer"] },
    matched_wine_id: null,
    needs_follow_up: true,
    follow_up_question: "Who is the producer on this bottle?",
  };

  assert.equal(shouldEnterCaptureFollowUp(response, false), true);
  assert.equal(shouldEnterCaptureFollowUp(response, true), false);
}

function testCaptureFollowUpHintCarriesOneAnswer() {
  const hint = buildCaptureFollowUpHint("Who is the producer on this bottle?", "  Tapiz  ");
  assert.equal(hint, "Follow-up answer: Who is the producer on this bottle? Tapiz");
  assert.equal(buildCaptureFollowUpHint("What vintage year is this bottle?", "   "), null);
}

function testIncompleteIdentityBlocksSaveUntilReviewed() {
  const draft = buildReviewDraft({ ...candidate, producer: null, label: null, vintage: null, confidence: { producer: 0.1, label: 0.1, vintage: 0.1 }, ambiguous_fields: ["producer", "label", "vintage"] }, {
    score: 90,
    buy_again: "maybe",
    occasion: "shop tasting",
    descriptors: "dark fruit",
    notes: "identity uncertain",
  });
  assert.equal(canSaveFieldCaptureDraft(draft).ok, false);
  assert.match(canSaveFieldCaptureDraft(draft).reason ?? "", /label\/name/i);
  assert.equal(canSaveFieldCaptureDraft(buildReviewDraft(candidate, { score: 90, buy_again: "maybe", occasion: "shop tasting", descriptors: "dark fruit", notes: "" })).ok, true);
}

function tapizDraft() {
  return buildReviewDraft(candidate, {
    score: 95,
    buy_again: "yes",
    occasion: "best wines ever — reference Cab",
    descriptors: "smooth, rich, long finish",
    notes: "One of the best wines ever.",
  });
}

function testPostSaveActionsAvoidBrokenCellarLinkForMemoryOnlyCaptures() {
  const actions = createPostSaveActions({ wine_id: "wine-1", tasting_id: "taste-1", is_benchmark: true, buy_again: "yes" });
  assert.deepEqual(actions.map((action) => action.id), ["find-more", "buy-again", "capture-another"]);
  assert.equal(actions.some((action) => action.href === "/cellar/wine-1?tasting=taste-1"), false);
}

function testPostSaveActionsUseInventoryIdForLinkedCellarCapture() {
  const actions = createPostSaveActions({ wine_id: "wine-1", tasting_id: "taste-1", inventory_id: "inventory-1", rating_id: "rating-1", is_benchmark: true, buy_again: "yes" });
  const bottle = actions.find((action) => action.id === "view-bottle");
  assert.equal(bottle?.href, "/cellar/inventory-1?tasting=rating-1");
}

function testBuildFieldCaptureCellarPayloadDefaultsToOneBottleWithProvenance() {
  const payload = buildFieldCaptureCellarPayload(tapizDraft(), { cellarId: "cellar-1" });
  assert.equal(payload.cellar_id, "cellar-1");
  assert.equal(payload.custom_name, "Alta Collection Cabernet Sauvignon");
  assert.equal(payload.custom_producer, "Tapiz");
  assert.equal(payload.custom_vintage, 2021);
  assert.equal(payload.custom_region, "Mendoza");
  assert.equal(payload.custom_wine_type, "red");
  assert.equal(payload.quantity, 1);
  assert.deepEqual(payload.tags, ["field-capture", "benchmark", "buy-again"]);
  assert.match(payload.notes ?? "", /best wines ever|field capture/i);
}

function testBuildFieldCaptureRatingPayloadLinksExistingInventory() {
  const payload = buildFieldCaptureRatingPayload(tapizDraft(), { inventoryId: "inventory-1", wineReferenceId: "ref-1" });
  if (!payload) throw new Error("Expected rating payload");
  assert.equal(payload.inventory_id, "inventory-1");
  assert.equal(payload.wine_reference_id, "ref-1");
  assert.equal(payload.score, 95);
  assert.equal(payload.tasting_notes, "One of the best wines ever.");
  assert.equal(payload.occasion, "best wines ever — reference Cab");
}

function testBuildFieldCaptureRatingSignalPayloadPreservesDescriptorsAndBuyAgain() {
  const signal = buildFieldCaptureRatingSignalPayload(tapizDraft(), { saveMode: "link_existing_inventory", inventoryId: "inventory-1" });
  assert.equal(signal.buy_again, true);
  assert.deepEqual(signal.decision_tags, ["field-capture", "benchmark", "buy-again", "link-existing-inventory"]);
  assert.deepEqual(signal.brian_phrases, ["smooth", "rich", "long finish"]);
  assert.equal(signal.extracted_from_text.save_mode, "link_existing_inventory");
  assert.equal(signal.extracted_from_text.inventory_id, "inventory-1");
}

function testFieldCaptureIdempotencyKeyNormalizesRetryToken() {
  assert.equal(normalizeFieldCaptureIdempotencyKey("  field-save-123  "), "field-save-123");
  assert.equal(normalizeFieldCaptureIdempotencyKey(""), null);
  assert.equal(normalizeFieldCaptureIdempotencyKey(null), null);
  assert.throws(() => normalizeFieldCaptureIdempotencyKey("x".repeat(161)), /Invalid field capture idempotency key/);
}

function testSavePayloadCarriesFieldCaptureIdempotencyKey() {
  const draft = { ...tapizDraft(), idempotency_key: " field-capture-retry-1 " };
  const payload = buildSaveTastingPayload(draft);
  assert.equal(payload.idempotency_key, "field-capture-retry-1");
  assert.equal(payload.tasting.extraction.field_capture_idempotency_key, "field-capture-retry-1");
}

function testFieldCaptureDownstreamBuyAgainAndAcquisitionPayloads() {
  const draft = tapizDraft();
  const queue = buildFieldCaptureBuyAgainQueuePayload(draft, { ownerId: "user-1", wineId: "wine-1" });
  assert.ok(queue);
  assert.equal(queue.owner_id, "user-1");
  assert.equal(queue.wine_id, "wine-1");
  assert.equal(queue.status, "active");
  assert.match(queue.note ?? "", /field capture/i);

  const acquisition = buildFieldCaptureAcquisitionTargetPayload(draft, {
    userId: "user-1",
    sourceId: "queue-1",
    inventoryId: "inventory-1",
  });
  assert.ok(acquisition);
  assert.equal(acquisition.user_id, "user-1");
  assert.equal(acquisition.inventory_id, "inventory-1");
  assert.equal(acquisition.source_kind, "buy_again");
  assert.equal(acquisition.source_id, "queue-1");
  assert.equal(acquisition.status, "watching");
  assert.equal(acquisition.priority, "must_have");
  assert.equal(acquisition.desired_quantity, 6);
  assert.equal(acquisition.wine_title, "2021 Tapiz Alta Collection Cabernet Sauvignon");
  assert.match(acquisition.notes ?? "", /95\/100|field capture/i);
}

function testFieldCaptureDownstreamSkipsNonBuyAgainCaptures() {
  const draft = { ...tapizDraft(), buy_again: "no" as const };
  assert.equal(buildFieldCaptureBuyAgainQueuePayload(draft, { ownerId: "user-1", wineId: "wine-1" }), null);
  assert.equal(buildFieldCaptureAcquisitionTargetPayload(draft, { userId: "user-1", sourceId: "queue-1" }), null);
}

for (const test of [
  testBuildCaptureRequestFromDataUrl,
  testRejectsInvalidCaptureImage,
  testBuildsFieldCaptureCandidateFromLabelScan,
  testBuildReviewDraftPreservesIntelligence,
  testBenchmarkThreshold,
  testSavePayloadIsDatabaseReady,
  testSavePayloadNormalizesRoseAccentForDatabase,
  testSaveReadinessMirrorsServerAndDatabaseConstraints,
  testPostSaveActionsArePractical,
  testDescriptorNormalization,
  testWineIdentityKeyNormalizesCaseWhitespaceAndVintage,
  testTapizDemoCandidateOpensAsBenchmarkReview,
  testEvidenceUploadUsesPrivateOwnerScopedPath,
  testEvidenceUploadRejectsInvalidOrOversizedEvidence,
  testSavePayloadKeepsRawEvidenceOutOfExtraction,
  testCaptureFollowUpRunsOnceForAmbiguousResponse,
  testCaptureFollowUpHintCarriesOneAnswer,
  testIncompleteIdentityBlocksSaveUntilReviewed,
  testPostSaveActionsAvoidBrokenCellarLinkForMemoryOnlyCaptures,
  testPostSaveActionsUseInventoryIdForLinkedCellarCapture,
  testBuildFieldCaptureCellarPayloadDefaultsToOneBottleWithProvenance,
  testBuildFieldCaptureRatingPayloadLinksExistingInventory,
  testBuildFieldCaptureRatingSignalPayloadPreservesDescriptorsAndBuyAgain,
  testFieldCaptureIdempotencyKeyNormalizesRetryToken,
  testSavePayloadCarriesFieldCaptureIdempotencyKey,
  testFieldCaptureDownstreamBuyAgainAndAcquisitionPayloads,
  testFieldCaptureDownstreamSkipsNonBuyAgainCaptures,
]) {
  test();
}

console.log("field-capture tests passed");
