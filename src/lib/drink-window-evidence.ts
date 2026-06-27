import type { ReviewStatus, SourceType, TruthLabel } from "./current-intelligence/types";
import type { WineWindowInput } from "./wine-readiness";
import { parseWineWindowYear } from "./wine-readiness";

const DAY_MS = 24 * 60 * 60 * 1000;

const SOURCE_WEIGHT: Record<SourceType, number> = {
  manual: 100,
  cellartracker: 92,
  wine_market_journal: 90,
  provider: 88,
  wine_searcher_trial: 84,
  auction: 78,
  winery: 70,
  retailer: 64,
  public_web: 50,
  ai_search: 34,
  ai_inferred: 0,
  unknown: 0,
};

const URL_REQUIRED_SOURCE_TYPES = new Set<SourceType>([
  "auction",
  "public_web",
  "retailer",
  "winery",
  "ai_search",
]);

export type DrinkWindowObservation = {
  id: string;
  inventoryId: string;
  wineReferenceId?: string | null;
  evidenceId?: string | null;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string | null;
  truthLabel: TruthLabel;
  reviewStatus: ReviewStatus;
  drinkAfter?: string | null;
  drinkBefore?: string | null;
  peakStart?: string | null;
  peakEnd?: string | null;
  servingGuidance?: string | null;
  confidence: number;
  observedAt: string;
  reviewedAt?: string | null;
  notes?: string | null;
  rawPayload?: unknown;
};

export type DrinkWindowReadinessBridge = {
  wine: WineWindowInput;
  appliedObservation: DrinkWindowObservation | null;
};

function stableId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function clampConfidence(value: number | null | undefined) {
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function sourceName(sourceType: SourceType, explicit?: string | null) {
  const trimmed = explicit?.trim();
  return trimmed || sourceType.replaceAll("_", " ");
}

function defaultTruthLabel(sourceType: SourceType): TruthLabel {
  if (["manual", "cellartracker", "wine_market_journal", "provider", "wine_searcher_trial"].includes(sourceType)) {
    return "verified";
  }
  if (sourceType === "ai_inferred" || sourceType === "ai_search") return "ai_inferred";
  if (sourceType === "unknown") return "unknown";
  return "estimated";
}

function defaultConfidence(sourceType: SourceType, truthLabel: TruthLabel) {
  if (truthLabel === "verified") return 86;
  if (truthLabel === "estimated") return sourceType === "winery" ? 72 : 62;
  if (truthLabel === "ai_inferred") return 35;
  return 20;
}

export function normalizeDrinkWindowObservation(
  input: Partial<DrinkWindowObservation> & { inventoryId: string; sourceType: SourceType }
): DrinkWindowObservation {
  const truthLabel = input.truthLabel ?? defaultTruthLabel(input.sourceType);
  const sourceUrl = input.sourceUrl?.trim() || null;
  return {
    id: input.id ?? stableId("drink-window"),
    inventoryId: input.inventoryId,
    wineReferenceId: input.wineReferenceId ?? null,
    evidenceId: input.evidenceId ?? null,
    sourceType: input.sourceType,
    sourceName: sourceName(input.sourceType, input.sourceName),
    sourceUrl,
    truthLabel,
    reviewStatus: input.reviewStatus ?? "draft",
    drinkAfter: input.drinkAfter ?? null,
    drinkBefore: input.drinkBefore ?? null,
    peakStart: input.peakStart ?? null,
    peakEnd: input.peakEnd ?? null,
    servingGuidance: input.servingGuidance ?? null,
    confidence: clampConfidence(input.confidence ?? defaultConfidence(input.sourceType, truthLabel)),
    observedAt: input.observedAt ?? new Date().toISOString(),
    reviewedAt: input.reviewedAt ?? null,
    notes: input.notes ?? null,
    rawPayload: input.rawPayload ?? null,
  };
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function boundaryDate(value: string | null | undefined, side: "start" | "end") {
  const year = parseWineWindowYear(value);
  if (year == null) return null;

  const trimmed = value?.trim() ?? "";
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const month = Number.parseInt(isoDate[2], 10) - 1;
    const day = Number.parseInt(isoDate[3], 10);
    const date = side === "start"
      ? new Date(Date.UTC(year, month, day))
      : new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return side === "start"
    ? new Date(Date.UTC(year, 0, 1))
    : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

export function validateDrinkWindowObservation(observation: DrinkWindowObservation): string[] {
  const issues: string[] = [];
  const drinkAfter = boundaryDate(observation.drinkAfter, "start");
  const drinkBefore = boundaryDate(observation.drinkBefore, "end");
  const peakStart = boundaryDate(observation.peakStart, "start");
  const peakEnd = boundaryDate(observation.peakEnd, "end");

  if (!drinkAfter && !drinkBefore) {
    issues.push("drink window must include drink_after or drink_before");
  }
  if (trimOrNull(observation.drinkAfter) && !drinkAfter) {
    issues.push("drink_after must include a valid year");
  }
  if (trimOrNull(observation.drinkBefore) && !drinkBefore) {
    issues.push("drink_before must include a valid year");
  }
  if (drinkAfter && drinkBefore && drinkAfter.getTime() > drinkBefore.getTime()) {
    issues.push("drink_after must be before or equal to drink_before");
  }
  if (trimOrNull(observation.peakStart) && !peakStart) {
    issues.push("peak_start must include a valid year");
  }
  if (trimOrNull(observation.peakEnd) && !peakEnd) {
    issues.push("peak_end must include a valid year");
  }
  if (peakStart && peakEnd && peakStart.getTime() > peakEnd.getTime()) {
    issues.push("peak_start must be before or equal to peak_end");
  }
  if (drinkAfter && peakStart && peakStart.getTime() < drinkAfter.getTime()) {
    issues.push("peak_start must fall inside the proposed drink window");
  }
  if (drinkBefore && peakStart && peakStart.getTime() > drinkBefore.getTime()) {
    issues.push("peak_start must fall inside the proposed drink window");
  }
  if (drinkAfter && peakEnd && peakEnd.getTime() < drinkAfter.getTime()) {
    issues.push("peak_end must fall inside the proposed drink window");
  }
  if (drinkBefore && peakEnd && peakEnd.getTime() > drinkBefore.getTime()) {
    issues.push("peak_end must fall inside the proposed drink window");
  }

  return [...new Set(issues)];
}

function hasCompleteWindow(observation: DrinkWindowObservation) {
  return Boolean(trimOrNull(observation.drinkAfter) && trimOrNull(observation.drinkBefore));
}

function hasRequiredSource(observation: DrinkWindowObservation) {
  if (!observation.sourceName.trim()) return false;
  if (!URL_REQUIRED_SOURCE_TYPES.has(observation.sourceType)) return true;
  return Boolean(trimOrNull(observation.sourceUrl));
}

function canDriveReadiness(observation: DrinkWindowObservation) {
  return observation.reviewStatus === "accepted" &&
    observation.truthLabel !== "ai_inferred" &&
    observation.truthLabel !== "unknown" &&
    observation.truthLabel !== "rejected" &&
    observation.truthLabel !== "stale" &&
    observation.sourceType !== "ai_inferred" &&
    observation.sourceType !== "ai_search" &&
    hasCompleteWindow(observation) &&
    hasRequiredSource(observation) &&
    validateDrinkWindowObservation(observation).length === 0;
}

function recencyScore(observation: DrinkWindowObservation, asOf: string) {
  const ageDays = Math.max(0, (new Date(asOf).getTime() - new Date(observation.observedAt).getTime()) / DAY_MS);
  return Math.max(0, 30 - Math.min(30, ageDays / 10));
}

function observationScore(observation: DrinkWindowObservation, asOf: string) {
  return SOURCE_WEIGHT[observation.sourceType] + observation.confidence + recencyScore(observation, asOf);
}

export function selectApplicableDrinkWindowObservation(
  observations: DrinkWindowObservation[],
  options: { asOf?: string | Date } = {}
) {
  const asOf = options.asOf instanceof Date ? options.asOf.toISOString() : options.asOf ?? new Date().toISOString();
  return observations
    .filter(canDriveReadiness)
    .sort((a, b) => observationScore(b, asOf) - observationScore(a, asOf) ||
      new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime() ||
      a.id.localeCompare(b.id))[0] ?? null;
}

export function buildReadinessInputWithDrinkWindowEvidence(
  wine: WineWindowInput,
  observations: DrinkWindowObservation[],
  options: { asOf?: string | Date } = {}
): DrinkWindowReadinessBridge {
  const appliedObservation = selectApplicableDrinkWindowObservation(observations, options);
  if (!appliedObservation) {
    return { wine: { ...wine }, appliedObservation: null };
  }

  return {
    wine: {
      ...wine,
      evidence_drink_after: appliedObservation.drinkAfter ?? null,
      evidence_drink_before: appliedObservation.drinkBefore ?? null,
      evidence_peak_start: appliedObservation.peakStart ?? null,
      evidence_peak_end: appliedObservation.peakEnd ?? null,
    },
    appliedObservation,
  };
}
