import type { ObservationKind, PriceObservation, PricePosture, PricePostureValue, SourceType, TruthLabel } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const STALE_AFTER_DAYS: Partial<Record<ObservationKind, number>> = {
  replacement_price: 60,
  market_value: 120,
  auction_comp: 365,
  estimate: 30,
  purchase_price: 3650,
};

const SOURCE_WEIGHT: Record<SourceType, number> = {
  manual: 100,
  cellartracker: 92,
  wine_market_journal: 90,
  provider: 86,
  wine_searcher_trial: 84,
  auction: 78,
  retailer: 62,
  winery: 58,
  public_web: 48,
  ai_search: 34,
  ai_inferred: 18,
  unknown: 0,
};

export type { ObservationKind, PriceObservation, PricePosture, SourceType, TruthLabel };

function stableId(prefix: string) {
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function classifyObservationKind(sourceType: SourceType, requested?: ObservationKind | string | null): ObservationKind {
  if (requested === "purchase_price") return "purchase_price";
  if (sourceType === "retailer" || sourceType === "winery") return "replacement_price";
  if (sourceType === "wine_market_journal" || sourceType === "auction") return "auction_comp";
  if (requested === "market_value" || requested === "auction_comp" || requested === "replacement_price" || requested === "estimate") return requested;
  if (sourceType === "cellartracker" || sourceType === "manual" || sourceType === "provider" || sourceType === "wine_searcher_trial") return "market_value";
  if (sourceType === "ai_search" || sourceType === "ai_inferred") return "estimate";
  return "estimate";
}

function defaultTruthLabel(sourceType: SourceType, kind: ObservationKind): TruthLabel {
  if (sourceType === "manual" || sourceType === "cellartracker" || sourceType === "wine_market_journal" || sourceType === "provider" || sourceType === "wine_searcher_trial") return "verified";
  if (sourceType === "ai_inferred" || kind === "estimate" || sourceType === "ai_search") return "ai_inferred";
  if (sourceType === "unknown") return "unknown";
  return "estimated";
}

export function normalizePriceObservation(input: Partial<PriceObservation> & { inventoryId: string; sourceType: SourceType }): PriceObservation {
  const kind = classifyObservationKind(input.sourceType, input.observationKind);
  const truthLabel = input.truthLabel ?? defaultTruthLabel(input.sourceType, kind);
  return {
    id: input.id ?? stableId("price"),
    inventoryId: input.inventoryId,
    wineReferenceId: input.wineReferenceId ?? null,
    sourceType: input.sourceType,
    sourceName: input.sourceName ?? input.sourceType,
    sourceUrl: input.sourceUrl ?? null,
    observationKind: kind,
    truthLabel,
    reviewStatus: input.reviewStatus ?? "draft",
    observedPriceCents: input.observedPriceCents ?? null,
    currency: input.currency ?? "USD",
    bottleSizeMl: input.bottleSizeMl ?? 750,
    vintage: input.vintage ?? null,
    confidence: Math.max(0, Math.min(100, input.confidence ?? (truthLabel === "verified" ? 85 : truthLabel === "estimated" ? 65 : 45))),
    observedAt: input.observedAt ?? new Date().toISOString(),
    notes: input.notes ?? null,
    rawPayload: input.rawPayload ?? null,
  };
}

export function isPriceObservationStale(observation: PriceObservation, asOf = new Date().toISOString()) {
  const days = STALE_AFTER_DAYS[observation.observationKind] ?? 90;
  const ageDays = (new Date(asOf).getTime() - new Date(observation.observedAt).getTime()) / DAY_MS;
  return ageDays > days || observation.truthLabel === "stale";
}

function recencyScore(observation: PriceObservation, asOf: string) {
  const ageDays = Math.max(0, (new Date(asOf).getTime() - new Date(observation.observedAt).getTime()) / DAY_MS);
  return Math.max(0, 30 - Math.min(30, ageDays / 4));
}

function scoreObservation(observation: PriceObservation, asOf: string) {
  if (observation.reviewStatus !== "accepted") return -1000;
  if (observation.observedPriceCents == null || observation.observedPriceCents <= 0) return -1000;
  const stalePenalty = isPriceObservationStale(observation, asOf) ? 45 : 0;
  const truthBonus = observation.truthLabel === "verified" ? 18 : observation.truthLabel === "estimated" ? 8 : observation.truthLabel === "ai_inferred" ? -18 : 0;
  return SOURCE_WEIGHT[observation.sourceType] + observation.confidence * 0.6 + recencyScore(observation, asOf) + truthBonus - stalePenalty;
}

function sortByScore(observations: PriceObservation[], asOf: string) {
  return [...observations].sort((a, b) => scoreObservation(b, asOf) - scoreObservation(a, asOf));
}

export function selectBestMarketValue(observations: PriceObservation[], asOf = new Date().toISOString()) {
  const marketish = observations.filter((observation) =>
    ["market_value", "auction_comp"].includes(observation.observationKind)
  );
  return sortByScore(marketish, asOf)[0] ?? null;
}

export function selectBestReplacementPrice(observations: PriceObservation[], asOf = new Date().toISOString()) {
  const replacement = observations.filter((observation) => observation.observationKind === "replacement_price");
  return sortByScore(replacement, asOf)[0] ?? null;
}

function valueFromObservation(observation: PriceObservation | null, asOf: string): PricePostureValue {
  if (!observation) {
    return { status: "unknown", valueCents: null, sourceType: null, sourceName: null, sourceUrl: null, observedAt: null, confidence: 0, kind: null, observation: null };
  }
  const stale = isPriceObservationStale(observation, asOf);
  return {
    status: stale ? "stale" : observation.observationKind === "auction_comp" ? "estimated" : observation.truthLabel === "verified" ? "verified" : "estimated",
    valueCents: observation.observedPriceCents,
    sourceType: observation.sourceType,
    sourceName: observation.sourceName ?? null,
    sourceUrl: observation.sourceUrl ?? null,
    observedAt: observation.observedAt,
    confidence: stale ? Math.max(1, observation.confidence - 30) : observation.confidence,
    kind: observation.observationKind,
    observation,
  };
}

export function summarizePricePosture(observations: PriceObservation[], asOf = new Date().toISOString()): PricePosture {
  const accepted = observations.filter((observation) => observation.reviewStatus === "accepted");
  return {
    market: valueFromObservation(selectBestMarketValue(accepted, asOf), asOf),
    replacement: valueFromObservation(selectBestReplacementPrice(accepted, asOf), asOf),
    staleCount: accepted.filter((observation) => isPriceObservationStale(observation, asOf)).length,
    acceptedCount: accepted.length,
    unknownReason: accepted.length === 0 ? "No accepted price evidence has been saved yet." : undefined,
  };
}
