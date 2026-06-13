export type OfflineDraftStatus = "queued" | "syncing" | "failed";

export type OfflineTastingDraft = {
  id: string;
  idempotencyKey: string;
  transcript: string;
  selectedInventoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  status: OfflineDraftStatus;
  attempts: number;
  lastError?: string | null;
};

export type OfflineDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const OFFLINE_TASTING_DRAFTS_KEY = "pourfolio:offline-tasting-drafts:v1";

function safeParseDrafts(raw: string | null): OfflineTastingDraft[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((draft): OfflineTastingDraft[] => {
      if (!draft || typeof draft !== "object") return [];
      const candidate = draft as Partial<OfflineTastingDraft>;
      if (
        typeof candidate.id === "string" &&
        typeof candidate.transcript === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.updatedAt === "string" &&
        typeof candidate.status === "string" &&
        typeof candidate.attempts === "number"
      ) {
        return [
          {
            idempotencyKey: candidate.idempotencyKey || candidate.id,
            selectedInventoryId: candidate.selectedInventoryId || null,
            ...candidate,
          } as OfflineTastingDraft,
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function writeDrafts(storage: OfflineDraftStorage, drafts: OfflineTastingDraft[]) {
  if (drafts.length === 0) {
    storage.removeItem(OFFLINE_TASTING_DRAFTS_KEY);
    return;
  }

  storage.setItem(OFFLINE_TASTING_DRAFTS_KEY, JSON.stringify(drafts));
}

function makeDraftId(transcript: string, createdAt: string) {
  const slug = transcript
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "draft";
  const stamp = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `offline-tasting-${stamp}-${slug}`;
}

export function createOfflineTastingDraft(input: {
  transcript: string;
  selectedInventoryId?: string | null;
  createdAt?: string;
}): OfflineTastingDraft {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const transcript = input.transcript.trim();
  const id = makeDraftId(transcript, createdAt);

  return {
    id,
    idempotencyKey: id,
    transcript,
    selectedInventoryId: input.selectedInventoryId || null,
    createdAt,
    updatedAt: createdAt,
    status: "queued",
    attempts: 0,
    lastError: null,
  };
}

export function getOfflineTastingDrafts(storage: OfflineDraftStorage): OfflineTastingDraft[] {
  return safeParseDrafts(storage.getItem(OFFLINE_TASTING_DRAFTS_KEY));
}

export function saveOfflineTastingDraft(storage: OfflineDraftStorage, draft: OfflineTastingDraft) {
  const drafts = getOfflineTastingDrafts(storage);
  const existingIndex = drafts.findIndex((candidate) => candidate.id === draft.id);
  const nextDraft = {
    ...draft,
    idempotencyKey: draft.idempotencyKey || draft.id,
    transcript: draft.transcript.trim(),
    selectedInventoryId: draft.selectedInventoryId || null,
    updatedAt: draft.updatedAt || new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    drafts[existingIndex] = nextDraft;
  } else {
    drafts.unshift(nextDraft);
  }

  writeDrafts(storage, drafts.slice(0, 20));
  return nextDraft;
}

export function updateOfflineTastingDraft(
  storage: OfflineDraftStorage,
  id: string,
  updates: { transcript?: string; selectedInventoryId?: string | null },
): OfflineTastingDraft | null {
  const drafts = getOfflineTastingDrafts(storage);
  const existingIndex = drafts.findIndex((draft) => draft.id === id);
  if (existingIndex < 0) return null;

  const existingDraft = drafts[existingIndex];
  const updatedDraft: OfflineTastingDraft = {
    ...existingDraft,
    transcript: updates.transcript?.trim() || existingDraft.transcript,
    selectedInventoryId: updates.selectedInventoryId === undefined ? existingDraft.selectedInventoryId || null : updates.selectedInventoryId,
    status: "queued",
    updatedAt: new Date().toISOString(),
    lastError: null,
  };

  const nextDrafts = [...drafts];
  nextDrafts[existingIndex] = updatedDraft;
  writeDrafts(storage, nextDrafts);
  return updatedDraft;
}

export function deleteOfflineTastingDraft(storage: OfflineDraftStorage, id: string) {
  const remaining = getOfflineTastingDrafts(storage).filter((draft) => draft.id !== id);
  writeDrafts(storage, remaining);
  return remaining;
}

export function markOfflineTastingDraftFailed(storage: OfflineDraftStorage, id: string, lastError: string) {
  const drafts = getOfflineTastingDrafts(storage);
  const nextDrafts = drafts.map((draft) =>
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

export function markOfflineTastingDraftSyncing(storage: OfflineDraftStorage, id: string) {
  const drafts = getOfflineTastingDrafts(storage);
  const nextDrafts = drafts.map((draft) =>
    draft.id === id
      ? {
          ...draft,
          status: "syncing" as const,
          updatedAt: new Date().toISOString(),
        }
      : draft,
  );
  writeDrafts(storage, nextDrafts);
  return nextDrafts;
}

export function drainSavedOfflineTastingDrafts(storage: OfflineDraftStorage, savedIds: string[]) {
  const saved = new Set(savedIds);
  const remaining = getOfflineTastingDrafts(storage).filter((draft) => !saved.has(draft.id));
  writeDrafts(storage, remaining);
  return remaining;
}
