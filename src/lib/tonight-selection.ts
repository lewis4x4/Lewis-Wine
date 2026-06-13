import type { TonightContext, TonightRecommendation } from "./tonight-engine";

export const TONIGHT_SELECTION_STORAGE_KEY = "pourfolio.tonight-selection.v1";
const DEFAULT_SELECTION_HOURS = 12;

export type TonightSelection = {
  source: "tonight-engine";
  inventoryId: string;
  recommendationId: string;
  name: string;
  producer: string | null;
  region: string | null;
  vintageLabel: string;
  confidence: number;
  recommendationType: TonightRecommendation["recommendation_type"];
  readinessStatus: TonightRecommendation["readiness_status"];
  context: TonightContext;
  selectedAt: string;
  expiresAt: string;
};

export type TonightSelectionStatus = {
  isActive: boolean;
  isActiveForBottle: boolean;
  reason: "active" | "missing" | "expired" | "different-bottle";
};

function defaultExpiresAt(selectedAt: Date) {
  return new Date(selectedAt.getTime() + DEFAULT_SELECTION_HOURS * 60 * 60 * 1000).toISOString();
}

export function buildTonightSelection(
  recommendation: TonightRecommendation,
  context: TonightContext,
  options: { selectedAt?: string; expiresAt?: string } = {}
): TonightSelection {
  const selectedAt = options.selectedAt ?? new Date().toISOString();
  return {
    source: "tonight-engine",
    inventoryId: recommendation.inventory_id,
    recommendationId: recommendation.id,
    name: recommendation.name,
    producer: recommendation.producer || null,
    region: recommendation.region || null,
    vintageLabel: recommendation.vintage_label,
    confidence: recommendation.confidence,
    recommendationType: recommendation.recommendation_type,
    readinessStatus: recommendation.readiness_status,
    context,
    selectedAt,
    expiresAt: options.expiresAt ?? defaultExpiresAt(new Date(selectedAt)),
  };
}

export function serializeTonightSelection(selection: TonightSelection) {
  return JSON.stringify(selection);
}

function isTonightSelection(value: unknown): value is TonightSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TonightSelection>;
  return candidate.source === "tonight-engine"
    && typeof candidate.inventoryId === "string"
    && typeof candidate.recommendationId === "string"
    && typeof candidate.name === "string"
    && typeof candidate.confidence === "number"
    && typeof candidate.selectedAt === "string"
    && typeof candidate.expiresAt === "string"
    && typeof candidate.context === "object";
}

export function parseTonightSelection(serialized: string | null): TonightSelection | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return isTonightSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getTonightSelectionStatus(
  selection: TonightSelection | null,
  inventoryId: string,
  asOf: Date = new Date()
): TonightSelectionStatus {
  if (!selection) {
    return { isActive: false, isActiveForBottle: false, reason: "missing" };
  }

  if (new Date(selection.expiresAt).getTime() <= asOf.getTime()) {
    return { isActive: false, isActiveForBottle: false, reason: "expired" };
  }

  if (selection.inventoryId !== inventoryId) {
    return { isActive: true, isActiveForBottle: false, reason: "different-bottle" };
  }

  return { isActive: true, isActiveForBottle: true, reason: "active" };
}
