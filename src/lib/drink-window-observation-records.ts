import type { DrinkWindowObservation } from "./drink-window-evidence";
import type { ReviewStatus, SourceType, TruthLabel } from "./current-intelligence/types";
import { parseWineWindowYear } from "./wine-readiness";

export type DrinkWindowObservationDbRow = Record<string, unknown>;

export function isMissingDrinkWindowObservationTable(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null | undefined;
  return candidate?.code === "42P01" ||
    candidate?.code === "PGRST205" ||
    /wine_drink_window_observations|relation .* does not exist|could not find the table/i.test(candidate?.message ?? "");
}

function dateForDb(value: string | null | undefined, side: "start" | "end") {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const year = parseWineWindowYear(trimmed);
  if (year == null) return null;
  return side === "start" ? `${year}-01-01` : `${year}-12-31`;
}

export function drinkWindowObservationFromDb(row: DrinkWindowObservationDbRow): DrinkWindowObservation {
  return {
    id: String(row.id),
    inventoryId: String(row.inventory_id),
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    evidenceId: (row.evidence_id as string | null) ?? null,
    sourceType: row.source_type as SourceType,
    sourceName: String(row.source_name ?? row.source_type ?? "unknown"),
    sourceUrl: (row.source_url as string | null) ?? null,
    truthLabel: row.truth_label as TruthLabel,
    reviewStatus: row.review_status as ReviewStatus,
    drinkAfter: (row.drink_after as string | null) ?? null,
    drinkBefore: (row.drink_before as string | null) ?? null,
    peakStart: (row.peak_start as string | null) ?? null,
    peakEnd: (row.peak_end as string | null) ?? null,
    servingGuidance: (row.serving_guidance as string | null) ?? null,
    confidence: Number(row.confidence ?? 0),
    observedAt: String(row.observed_at ?? row.created_at ?? new Date(0).toISOString()),
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    rawPayload: row.raw_payload ?? null,
  };
}

export function drinkWindowObservationToDbInsert(observation: DrinkWindowObservation, ownerId: string) {
  return {
    owner_id: ownerId,
    inventory_id: observation.inventoryId,
    wine_reference_id: observation.wineReferenceId ?? null,
    evidence_id: observation.evidenceId ?? null,
    source_type: observation.sourceType,
    source_name: observation.sourceName,
    source_url: observation.sourceUrl || null,
    truth_label: observation.truthLabel,
    review_status: observation.reviewStatus,
    drink_after: dateForDb(observation.drinkAfter, "start"),
    drink_before: dateForDb(observation.drinkBefore, "end"),
    peak_start: dateForDb(observation.peakStart, "start"),
    peak_end: dateForDb(observation.peakEnd, "end"),
    serving_guidance: observation.servingGuidance ?? null,
    confidence: observation.confidence,
    observed_at: observation.observedAt,
    reviewed_at: observation.reviewedAt ?? null,
    notes: observation.notes ?? null,
    raw_payload: observation.rawPayload ?? {},
  };
}

export function drinkWindowObservationToDbPatch(observation: DrinkWindowObservation) {
  return {
    source_type: observation.sourceType,
    source_name: observation.sourceName,
    source_url: observation.sourceUrl || null,
    truth_label: observation.truthLabel,
    review_status: observation.reviewStatus,
    drink_after: dateForDb(observation.drinkAfter, "start"),
    drink_before: dateForDb(observation.drinkBefore, "end"),
    peak_start: dateForDb(observation.peakStart, "start"),
    peak_end: dateForDb(observation.peakEnd, "end"),
    serving_guidance: observation.servingGuidance ?? null,
    confidence: observation.confidence,
    observed_at: observation.observedAt,
    reviewed_at: observation.reviewedAt ?? null,
    notes: observation.notes ?? null,
  };
}
