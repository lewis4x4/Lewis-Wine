import assert from "node:assert/strict";
import {
  buildVoiceTastingDraft,
  rankVoiceTastingMatches,
  summarizeVoiceTastingDraft,
  type VoiceTastingWineDoc,
} from "../src/lib/voice-tasting-capture";

const docs: VoiceTastingWineDoc[] = [
  {
    id: "inv-ridge",
    wine_reference_id: "wine-ridge",
    displayName: "2018 Ridge Monte Bello",
    producer: "Ridge Vineyards",
    region: "Santa Cruz Mountains",
    quantity: 2,
    href: "/cellar/inv-ridge",
  },
  {
    id: "inv-burgundy",
    wine_reference_id: "wine-burgundy",
    displayName: "2020 Domaine Dujac Morey-Saint-Denis",
    producer: "Domaine Dujac",
    region: "Burgundy",
    quantity: 1,
    href: "/cellar/inv-burgundy",
  },
];

const transcript =
  "Jarvis, log the 2018 Ridge Monte Bello. 96 points. Black cherry, cedar, graphite, firm tannins, bright acidity, long finish. Had it with steak at home. Definitely buy again; value feels strong.";

const matches = rankVoiceTastingMatches(transcript, docs);
assert.equal(matches[0]?.id, "inv-ridge");
assert.equal(matches[0]?.confidence, "high");

const draft = buildVoiceTastingDraft(transcript, docs, { asOf: new Date("2026-06-12T12:00:00Z") });
assert.equal(draft.intent, "log_tasting");
assert.equal(draft.status, "ready_to_save");
assert.equal(draft.matchedWine?.id, "inv-ridge");
assert.equal(draft.rating.score, 96);
assert.equal(draft.rating.inventory_id, "inv-ridge");
assert.equal(draft.rating.wine_reference_id, "wine-ridge");
assert.equal(draft.rating.tasting_date, "2026-06-12");
assert.equal(draft.rating.food_pairing, "steak");
assert.equal(draft.rating.venue, "home");
assert.equal(draft.rating.tannins, "medium-high");
assert.equal(draft.rating.acidity, "medium-high");
assert.equal(draft.rating.finish, "long");
assert.deepEqual(draft.rating.occasion_tags, ["voice-capture", "dinner", "at-home"]);
assert.deepEqual(draft.ratingSignal.decision_tags, ["voice-capture", "buy-again", "strong-value"]);
assert.deepEqual(draft.ratingSignal.occasion_tags, ["voice-capture", "dinner", "at-home"]);
assert.equal(draft.ratingSignal.buy_again, true);
assert.equal(draft.ratingSignal.value_feel, "strong");
assert.ok(draft.ratingSignal.extracted_from_text?.transcript === transcript);
assert.ok(draft.ratingSignal.extracted_from_text?.descriptors instanceof Array);
assert.ok((draft.ratingSignal.extracted_from_text?.descriptors as string[]).includes("black cherry"));
assert.ok(draft.summary.includes("96-point tasting draft"));
assert.ok(draft.summary.includes("2018 Ridge Monte Bello"));

const ambiguousDraft = buildVoiceTastingDraft("Jarvis log this: really sharp red fruit and too much oak.", docs);
assert.equal(ambiguousDraft.status, "needs_wine_match");
assert.equal(ambiguousDraft.rating.score, 90);
assert.equal(ambiguousDraft.matchedWine, null);
assert.ok(summarizeVoiceTastingDraft(ambiguousDraft).includes("needs a bottle match"));

console.log("voice-tasting-capture tests passed");
