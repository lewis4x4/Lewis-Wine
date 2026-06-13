export type SourceType =
  | "manual"
  | "cellartracker"
  | "wine_market_journal"
  | "retailer"
  | "winery"
  | "auction"
  | "public_web"
  | "ai_search"
  | "ai_inferred"
  | "wine_searcher_trial"
  | "provider"
  | "unknown";

export type TruthLabel = "verified" | "estimated" | "ai_inferred" | "unknown" | "stale" | "rejected";
export type ReviewStatus = "draft" | "accepted" | "rejected" | "superseded";
export type ObservationKind =
  | "purchase_price"
  | "market_value"
  | "replacement_price"
  | "auction_comp"
  | "producer_fact"
  | "drink_window"
  | "serving_guidance"
  | "identity"
  | "estimate";

export type PriceObservation = {
  id: string;
  inventoryId: string;
  wineReferenceId?: string | null;
  sourceType: SourceType;
  sourceName?: string | null;
  sourceUrl?: string | null;
  observationKind: ObservationKind;
  truthLabel: TruthLabel;
  reviewStatus: ReviewStatus;
  observedPriceCents: number | null;
  currency: string;
  bottleSizeMl?: number | null;
  vintage?: number | null;
  confidence: number;
  observedAt: string;
  notes?: string | null;
  rawPayload?: unknown;
};

export type EvidenceRecord = {
  id: string;
  inventoryId: string;
  wineReferenceId?: string | null;
  sourceType: SourceType;
  truthLabel: TruthLabel;
  reviewStatus: ReviewStatus;
  title: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  extractedFacts?: Record<string, unknown> | null;
  confidence: number;
  observedAt: string;
  notes?: string | null;
};

export type PricePostureValue = {
  status: "verified" | "estimated" | "unknown" | "stale";
  valueCents: number | null;
  sourceType: SourceType | null;
  sourceName: string | null;
  sourceUrl: string | null;
  observedAt: string | null;
  confidence: number;
  kind: ObservationKind | null;
  observation: PriceObservation | null;
};

export type PricePosture = {
  market: PricePostureValue;
  replacement: PricePostureValue;
  staleCount: number;
  acceptedCount: number;
  unknownReason?: string;
};
