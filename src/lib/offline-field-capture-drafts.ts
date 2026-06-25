import { buildSaveTastingPayload, normalizeFieldCaptureIdempotencyKey, type ReviewDraft, type SaveTastingPayload } from "@/lib/field-capture";

export type OfflineFieldCaptureDraftStatus = "queued" | "syncing" | "failed";

export type OfflineFieldCaptureDraft = {
  id: string;
  idempotencyKey: string;
  payload: SaveTastingPayload;
  createdAt: string;
  updatedAt: string;
  status: OfflineFieldCaptureDraftStatus;
  attempts: number;
  lastError?: string | null;
};

export type OfflineFieldCaptureDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const OFFLINE_FIELD_CAPTURE_DRAFTS_KEY = "pourfolio:offline-field-capture-drafts:v1";

function safeParseDrafts(raw: string | null): OfflineFieldCaptureDraft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((draft): OfflineFieldCaptureDraft[] => {
      if (!draft || typeof draft !== "object") return [];
      const candidate = draft as Partial<OfflineFieldCaptureDraft>;
      if (
        typeof candidate.id === "string" &&
        typeof candidate.idempotencyKey === "string" &&
        candidate.payload &&
        typeof candidate.payload === "object" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.updatedAt === "string" &&
        typeof candidate.status === "string" &&
        typeof candidate.attempts === "number"
      ) {
        return [candidate as OfflineFieldCaptureDraft];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function writeDrafts(storage: OfflineFieldCaptureDraftStorage, drafts: OfflineFieldCaptureDraft[]) {
  if (drafts.length === 0) {
    storage.removeItem(OFFLINE_FIELD_CAPTURE_DRAFTS_KEY);
    return;
  }
  storage.setItem(OFFLINE_FIELD_CAPTURE_DRAFTS_KEY, JSON.stringify(drafts));
}

function makeDraftId(idempotencyKey: string, createdAt: string) {
  const stamp = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
  const slug = idempotencyKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52) || "capture";
  return `offline-field-capture-${stamp}-${slug}`;
}

function createFallbackFieldCaptureKey(createdAt: string) {
  return `field-capture-offline-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

export function createOfflineFieldCaptureDraft(input: {
  reviewDraft: ReviewDraft;
  evidenceDataUrl?: string | null;
  createdAt?: string;
}): OfflineFieldCaptureDraft {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const idempotencyKey = normalizeFieldCaptureIdempotencyKey(input.reviewDraft.idempotency_key) ?? createFallbackFieldCaptureKey(createdAt);
  const payload = buildSaveTastingPayload({
    ...input.reviewDraft,
    idempotency_key: idempotencyKey,
    evidence_data_url: input.evidenceDataUrl ?? input.reviewDraft.evidence_data_url ?? null,
  });

  return {
    id: makeDraftId(idempotencyKey, createdAt),
    idempotencyKey,
    payload,
    createdAt,
    updatedAt: createdAt,
    status: "queued",
    attempts: 0,
    lastError: null,
  };
}

export function getOfflineFieldCaptureDrafts(storage: OfflineFieldCaptureDraftStorage): OfflineFieldCaptureDraft[] {
  return safeParseDrafts(storage.getItem(OFFLINE_FIELD_CAPTURE_DRAFTS_KEY));
}

export function saveOfflineFieldCaptureDraft(storage: OfflineFieldCaptureDraftStorage, draft: OfflineFieldCaptureDraft) {
  const drafts = getOfflineFieldCaptureDrafts(storage);
  const existingIndex = drafts.findIndex((candidate) => candidate.id === draft.id || candidate.idempotencyKey === draft.idempotencyKey);
  const nextDraft: OfflineFieldCaptureDraft = {
    ...draft,
    idempotencyKey: draft.idempotencyKey || draft.payload.idempotency_key || draft.id,
    payload: {
      ...draft.payload,
      idempotency_key: draft.payload.idempotency_key || draft.idempotencyKey || draft.id,
    },
    updatedAt: draft.updatedAt || new Date().toISOString(),
  };

  if (existingIndex >= 0) drafts[existingIndex] = nextDraft;
  else drafts.unshift(nextDraft);
  writeDrafts(storage, drafts.slice(0, 20));
  return nextDraft;
}

export function deleteOfflineFieldCaptureDraft(storage: OfflineFieldCaptureDraftStorage, id: string) {
  const remaining = getOfflineFieldCaptureDrafts(storage).filter((draft) => draft.id !== id);
  writeDrafts(storage, remaining);
  return remaining;
}

export function markOfflineFieldCaptureDraftSyncing(storage: OfflineFieldCaptureDraftStorage, id: string) {
  const nextDrafts = getOfflineFieldCaptureDrafts(storage).map((draft) =>
    draft.id === id
      ? { ...draft, status: "syncing" as const, updatedAt: new Date().toISOString() }
      : draft,
  );
  writeDrafts(storage, nextDrafts);
  return nextDrafts;
}

export function markOfflineFieldCaptureDraftFailed(storage: OfflineFieldCaptureDraftStorage, id: string, lastError: string) {
  const nextDrafts = getOfflineFieldCaptureDrafts(storage).map((draft) =>
    draft.id === id
      ? {
          ...draft,
          status: "failed" as const,
          attempts: draft.attempts + 1,
          updatedAt: new Date().toISOString(),
          lastError,
        }
      : draft,
  );
  writeDrafts(storage, nextDrafts);
  return nextDrafts;
}

export function drainSavedOfflineFieldCaptureDrafts(storage: OfflineFieldCaptureDraftStorage, savedIds: string[]) {
  const saved = new Set(savedIds);
  const remaining = getOfflineFieldCaptureDrafts(storage).filter((draft) => !saved.has(draft.id));
  writeDrafts(storage, remaining);
  return remaining;
}
