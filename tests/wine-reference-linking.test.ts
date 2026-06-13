import assert from "node:assert/strict";
import {
  buildReferenceSearchQuery,
  getReferenceMatchLabel,
  shouldShowReferenceLinkAction,
  type WineReferenceLinkCandidate,
  type WineReferenceLinkRecord,
} from "../src/lib/wine-reference-linking";

const customRecord: WineReferenceLinkRecord = {
  wine_reference_id: null,
  custom_name: "Estate Cabernet",
  custom_producer: "Lewis Reserve",
  custom_region: "Napa Valley",
  vintage: 2021,
};

const linkedRecord: WineReferenceLinkRecord = {
  ...customRecord,
  wine_reference_id: "ref-1",
};

const candidate: WineReferenceLinkCandidate = {
  id: "ref-1",
  name: "Estate Cabernet Sauvignon",
  producer: "Lewis Reserve",
  region: "Napa Valley",
  country: "United States",
  wineType: "red",
  grapeVariety: "Cabernet Sauvignon",
  rating: 94,
};

function testOnlyCustomRecordsNeedReferenceLinking() {
  assert.equal(shouldShowReferenceLinkAction(customRecord), true);
  assert.equal(shouldShowReferenceLinkAction(linkedRecord), false);
}

function testSearchQueryUsesBestKnownBottleIdentity() {
  assert.equal(buildReferenceSearchQuery(customRecord), "Lewis Reserve Estate Cabernet Napa Valley 2021");
  assert.equal(buildReferenceSearchQuery({ ...customRecord, custom_region: null, vintage: null }), "Lewis Reserve Estate Cabernet");
}

function testCandidateLabelMakesMatchReviewable() {
  assert.equal(
    getReferenceMatchLabel(candidate),
    "Lewis Reserve — Estate Cabernet Sauvignon • Napa Valley, United States • red • 94 pts"
  );
}

testOnlyCustomRecordsNeedReferenceLinking();
testSearchQueryUsesBestKnownBottleIdentity();
testCandidateLabelMakesMatchReviewable();

console.log("wine-reference-linking tests passed");
