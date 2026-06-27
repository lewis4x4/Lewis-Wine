import assert from "node:assert/strict";
import {
  buildReadinessInputWithDrinkWindowEvidence,
  normalizeDrinkWindowObservation,
  selectApplicableDrinkWindowObservation,
  validateDrinkWindowObservation,
  type DrinkWindowObservation,
} from "../src/lib/drink-window-evidence";
import { getWineReadinessProfile } from "../src/lib/wine-readiness";

const asOf = "2026-06-12T12:00:00.000Z";

function acceptedWineryObservation(overrides: Partial<DrinkWindowObservation> = {}): DrinkWindowObservation {
  return normalizeDrinkWindowObservation({
    id: "dw-winery-1",
    inventoryId: "inventory-1",
    wineReferenceId: "reference-1",
    sourceType: "winery",
    sourceName: "Producer tech sheet",
    sourceUrl: "https://winery.example/tech-sheet.pdf",
    truthLabel: "estimated",
    reviewStatus: "accepted",
    drinkAfter: "2024",
    drinkBefore: "2032",
    peakStart: "2026",
    peakEnd: "2028",
    confidence: 86,
    observedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  });
}

function testAcceptedSourceBackedObservationFeedsReadinessWithoutInventoryCopy() {
  const observation = acceptedWineryObservation();
  const readinessInput = buildReadinessInputWithDrinkWindowEvidence(
    { drink_after: null, drink_before: null },
    [observation],
    { asOf }
  );
  const profile = getWineReadinessProfile(readinessInput.wine, { asOf: new Date(asOf) });

  assert.equal(readinessInput.appliedObservation?.id, "dw-winery-1");
  assert.equal(profile.source, "drink_window_evidence");
  assert.equal(profile.confidence, "source-backed");
  assert.equal(profile.phase, "at_peak");
  assert.equal(profile.normalizedDrinkAfter, "2024-01-01");
  assert.equal(profile.normalizedDrinkBefore, "2032-12-31");
  assert.equal(profile.peakStart, "2026-01-01");
  assert.equal(profile.peakEnd, "2028-12-31");
}

function testInventoryWindowStillWinsOverAcceptedEvidence() {
  const readinessInput = buildReadinessInputWithDrinkWindowEvidence(
    { drink_after: "2030", drink_before: "2036" },
    [acceptedWineryObservation()],
    { asOf }
  );
  const profile = getWineReadinessProfile(readinessInput.wine, { asOf: new Date(asOf) });

  assert.equal(readinessInput.appliedObservation?.id, "dw-winery-1");
  assert.equal(profile.source, "inventory");
  assert.equal(profile.phase, "hold");
  assert.equal(profile.normalizedDrinkAfter, "2030-01-01");
}

function testDraftAndAiInferredEvidenceCannotSilentlyDriveReadiness() {
  const draftPublicWeb = acceptedWineryObservation({
    id: "dw-public-draft",
    sourceType: "public_web",
    sourceName: "Wine blog",
    sourceUrl: "https://blog.example/window",
    reviewStatus: "draft",
    confidence: 95,
  });
  const acceptedAi = acceptedWineryObservation({
    id: "dw-ai-accepted",
    sourceType: "ai_inferred",
    sourceName: "AI estimate",
    sourceUrl: null,
    truthLabel: "ai_inferred",
    reviewStatus: "accepted",
    confidence: 99,
  });

  assert.equal(selectApplicableDrinkWindowObservation([draftPublicWeb, acceptedAi], { asOf }), null);
  const readinessInput = buildReadinessInputWithDrinkWindowEvidence(
    { drink_after: null, drink_before: null },
    [draftPublicWeb, acceptedAi],
    { asOf }
  );
  const profile = getWineReadinessProfile(readinessInput.wine, { asOf: new Date(asOf) });

  assert.equal(readinessInput.appliedObservation, null);
  assert.equal(profile.phase, "missing_window");
}

function testInvalidDrinkWindowEvidenceIsHeldForReview() {
  const invalid = acceptedWineryObservation({
    id: "dw-invalid",
    drinkAfter: "2030",
    drinkBefore: "2028",
    peakStart: "2027",
    peakEnd: "2031",
  });

  assert.deepEqual(validateDrinkWindowObservation(invalid), [
    "drink_after must be before or equal to drink_before",
    "peak_start must fall inside the proposed drink window",
    "peak_end must fall inside the proposed drink window",
  ]);
  assert.equal(selectApplicableDrinkWindowObservation([invalid], { asOf }), null);
}

function testBestObservationPrefersAcceptedFresherSourceBackedEvidence() {
  const olderProvider = acceptedWineryObservation({
    id: "dw-provider-old",
    sourceType: "provider",
    sourceName: "Provider import",
    sourceUrl: null,
    truthLabel: "verified",
    confidence: 74,
    observedAt: "2025-01-01T00:00:00.000Z",
    drinkAfter: "2023",
    drinkBefore: "2030",
  });
  const newerWinery = acceptedWineryObservation({
    id: "dw-winery-new",
    confidence: 88,
    observedAt: "2026-06-10T00:00:00.000Z",
    drinkAfter: "2024",
    drinkBefore: "2032",
  });

  assert.equal(selectApplicableDrinkWindowObservation([olderProvider, newerWinery], { asOf })?.id, "dw-winery-new");
}

testAcceptedSourceBackedObservationFeedsReadinessWithoutInventoryCopy();
testInventoryWindowStillWinsOverAcceptedEvidence();
testDraftAndAiInferredEvidenceCannotSilentlyDriveReadiness();
testInvalidDrinkWindowEvidenceIsHeldForReview();
testBestObservationPrefersAcceptedFresherSourceBackedEvidence();

console.log("drink-window-evidence tests passed");
