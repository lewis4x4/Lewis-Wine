import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import manifest from "../public/manifest.json" with { type: "json" };
import {
  createOfflineTastingDraft,
  deleteOfflineTastingDraft,
  drainSavedOfflineTastingDrafts,
  getOfflineTastingDrafts,
  saveOfflineTastingDraft,
  updateOfflineTastingDraft,
  type OfflineDraftStorage,
} from "../src/lib/offline-tasting-drafts";
import {
  createOfflineFieldCaptureDraft,
  deleteOfflineFieldCaptureDraft,
  drainSavedOfflineFieldCaptureDrafts,
  getOfflineFieldCaptureDrafts,
  markOfflineFieldCaptureDraftFailed,
  markOfflineFieldCaptureDraftSyncing,
  saveOfflineFieldCaptureDraft,
  type OfflineFieldCaptureDraft,
} from "../src/lib/offline-field-capture-drafts";
import {
  shouldQueueFieldCaptureFailure,
  fieldCaptureFailureMessage,
} from "../src/lib/field-capture-sync";
import {
  buildReviewDraft,
  buildSaveTastingPayload,
  tapizDemoCandidate,
} from "../src/lib/field-capture";
import {
  shouldQueueVoiceTastingFailure,
  voiceTastingFailureMessage,
} from "../src/lib/voice-tasting-sync";

class MemoryStorage implements OfflineDraftStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "/");
assert.equal(manifest.theme_color, "#722F37");
assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === "/jarvis/voice"));
assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === "/bottle-brain"));

for (const icon of manifest.icons) {
  assert.ok(existsSync(join(process.cwd(), "public", icon.src)), `Missing manifest icon: ${icon.src}`);
  assert.ok(icon.purpose?.includes("maskable"), `Icon should be maskable: ${icon.src}`);
}

for (const shortcut of manifest.shortcuts) {
  for (const icon of shortcut.icons || []) {
    assert.ok(existsSync(join(process.cwd(), "public", icon.src)), `Missing shortcut icon: ${icon.src}`);
  }
}

const storage = new MemoryStorage();
const draft = createOfflineTastingDraft({
  transcript: "Jarvis, log the 2018 Ridge Monte Bello. 96 points. Great with steak.",
  selectedInventoryId: "inv-ridge",
  createdAt: "2026-06-12T12:00:00.000Z",
});
assert.equal(draft.status, "queued");
assert.equal(draft.attempts, 0);
assert.ok(draft.id.startsWith("offline-tasting-"));
assert.equal(draft.idempotencyKey, draft.id);
assert.equal(draft.selectedInventoryId, "inv-ridge");
assert.ok(draft.transcript.includes("Ridge Monte Bello"));

saveOfflineTastingDraft(storage, draft);
assert.deepEqual(getOfflineTastingDrafts(storage), [draft]);

const edited = updateOfflineTastingDraft(storage, draft.id, {
  transcript: "Jarvis, log the 2018 Ridge Monte Bello. 97 points. Even better after air.",
});
assert.equal(edited?.idempotencyKey, draft.idempotencyKey);
assert.equal(edited?.status, "queued");
assert.equal(edited?.selectedInventoryId, "inv-ridge");
assert.ok(edited?.transcript.includes("97 points"));

saveOfflineTastingDraft(storage, { ...draft, status: "syncing", attempts: 1 });
assert.deepEqual(getOfflineTastingDrafts(storage), [{ ...draft, status: "syncing", attempts: 1 }]);

const secondDraft = createOfflineTastingDraft({
  transcript: "Jarvis, log a quick tasting for the Dujac.",
  createdAt: "2026-06-12T12:01:00.000Z",
});
saveOfflineTastingDraft(storage, secondDraft);
assert.equal(getOfflineTastingDrafts(storage).length, 2);
deleteOfflineTastingDraft(storage, secondDraft.id);
assert.equal(getOfflineTastingDrafts(storage).length, 1);

const drained = drainSavedOfflineTastingDrafts(storage, [draft.id]);
assert.deepEqual(drained, []);
assert.deepEqual(getOfflineTastingDrafts(storage), []);

assert.equal(shouldQueueVoiceTastingFailure({ isOnline: false }), true);
assert.equal(shouldQueueVoiceTastingFailure({ isOnline: true }), true);
assert.equal(shouldQueueVoiceTastingFailure({ isOnline: true, status: 0 }), true);
assert.equal(shouldQueueVoiceTastingFailure({ isOnline: true, status: 500 }), true);
assert.equal(shouldQueueVoiceTastingFailure({ isOnline: true, status: 503 }), true);
assert.equal(shouldQueueVoiceTastingFailure({ isOnline: true, status: 422 }), false);
assert.equal(shouldQueueVoiceTastingFailure({ isOnline: true, status: 401 }), false);
assert.ok(voiceTastingFailureMessage(422).includes("clearer bottle match"));

const fieldStorage = new MemoryStorage();
const fieldReview = buildReviewDraft(tapizDemoCandidate, {
  score: 95,
  buy_again: "yes",
  occasion: "best wines ever — offline queue proof",
  descriptors: "smooth, rich, long finish",
  notes: "Do not lose this field capture if the cellar signal drops.",
});
const fieldDraft = createOfflineFieldCaptureDraft({
  reviewDraft: {
    ...fieldReview,
    save_mode: "link_existing_inventory",
    inventory_id: "inv-tapiz",
    idempotency_key: "field-capture-stable-key",
  },
  evidenceDataUrl: "data:image/png;base64,QUJD",
  createdAt: "2026-06-25T17:00:00.000Z",
});
assert.equal(fieldDraft.status, "queued");
assert.equal(fieldDraft.attempts, 0);
assert.ok(fieldDraft.id.startsWith("offline-field-capture-"));
assert.equal(fieldDraft.idempotencyKey, "field-capture-stable-key");
assert.equal(fieldDraft.payload.idempotency_key, "field-capture-stable-key");
assert.equal(fieldDraft.payload.inventory_id, "inv-tapiz");
assert.equal(fieldDraft.payload.evidence_data_url, "data:image/png;base64,QUJD");
assert.equal(JSON.stringify(fieldDraft.payload).includes("QUJD"), true);
assert.equal(JSON.stringify(buildSaveTastingPayload(fieldDraft.payload).tasting.extraction).includes("QUJD"), false);

saveOfflineFieldCaptureDraft(fieldStorage, fieldDraft);
assert.deepEqual(getOfflineFieldCaptureDrafts(fieldStorage), [fieldDraft]);

markOfflineFieldCaptureDraftSyncing(fieldStorage, fieldDraft.id);
assert.equal(getOfflineFieldCaptureDrafts(fieldStorage)[0].status, "syncing");

markOfflineFieldCaptureDraftFailed(fieldStorage, fieldDraft.id, "Network uncertain");
const failedFieldDraft = getOfflineFieldCaptureDrafts(fieldStorage)[0] as OfflineFieldCaptureDraft;
assert.equal(failedFieldDraft.status, "failed");
assert.equal(failedFieldDraft.attempts, 1);
assert.equal(failedFieldDraft.idempotencyKey, "field-capture-stable-key");
assert.equal(failedFieldDraft.payload.idempotency_key, "field-capture-stable-key");

const secondFieldDraft = createOfflineFieldCaptureDraft({
  reviewDraft: { ...fieldReview, idempotency_key: "field-capture-second-key" },
  evidenceDataUrl: null,
  createdAt: "2026-06-25T17:01:00.000Z",
});
saveOfflineFieldCaptureDraft(fieldStorage, secondFieldDraft);
assert.equal(getOfflineFieldCaptureDrafts(fieldStorage).length, 2);
deleteOfflineFieldCaptureDraft(fieldStorage, secondFieldDraft.id);
assert.equal(getOfflineFieldCaptureDrafts(fieldStorage).length, 1);
assert.deepEqual(drainSavedOfflineFieldCaptureDrafts(fieldStorage, [fieldDraft.id]), []);
assert.deepEqual(getOfflineFieldCaptureDrafts(fieldStorage), []);

assert.equal(shouldQueueFieldCaptureFailure({ isOnline: false }), true);
assert.equal(shouldQueueFieldCaptureFailure({ isOnline: true }), true);
assert.equal(shouldQueueFieldCaptureFailure({ isOnline: true, status: 0 }), true);
assert.equal(shouldQueueFieldCaptureFailure({ isOnline: true, status: 500 }), true);
assert.equal(shouldQueueFieldCaptureFailure({ isOnline: true, status: 503 }), true);
assert.equal(shouldQueueFieldCaptureFailure({ isOnline: true, status: 422 }), false);
assert.equal(shouldQueueFieldCaptureFailure({ isOnline: true, status: 401 }), false);
assert.ok(fieldCaptureFailureMessage(422).includes("review"));

console.log("field-reliability tests passed");
