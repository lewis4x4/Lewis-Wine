import type { MarketValueSource } from "@/types/database";

export type TruthLabel = "verified" | "estimated" | "ai_inferred" | "unknown" | "stale";
export type DominanceSourceType = "cellar" | "reference" | "market" | "ai" | "public";
export type DominanceSuggestionField =
  | "wine_reference_id"
  | "current_market_value_cents"
  | "market_value_source"
  | "market_value_updated_at"
  | "drink_after"
  | "drink_before"
  | "custom_name"
  | "custom_producer"
  | "custom_region"
  | "custom_wine_type"
  | "notes";

export type BottleDominanceRecord = {
  id: string;
  wine_reference_id?: string | null;
  custom_name?: string | null;
  custom_producer?: string | null;
  custom_region?: string | null;
  vintage?: number | null;
  custom_vintage?: number | null;
  custom_wine_type?: string | null;
  quantity?: number | null;
  purchase_price_cents?: number | null;
  current_market_value_cents?: number | null;
  market_value_source?: MarketValueSource | null;
  market_value_updated_at?: string | null;
  drink_after?: string | null;
  drink_before?: string | null;
  notes?: string | null;
  ratings?: { score: number; tasting_notes?: string | null }[];
  wine_reference?: {
    id: string;
    name: string;
    producer: string | null;
    region: string | null;
    sub_region?: string | null;
    country: string | null;
    appellation?: string | null;
    grape_varieties?: string[] | null;
    wine_type?: string | null;
    alcohol_percentage?: number | null;
    drink_window_start?: number | null;
    drink_window_end?: number | null;
    critic_scores?: unknown;
  } | null;
};

export type DominanceMarketSignal = {
  provider: string;
  valueCents?: number | null;
  lowCents?: number | null;
  highCents?: number | null;
  merchantCount?: number | null;
  sourceUrl?: string | null;
  checkedAt: string;
  confidence: number;
};

export type DominanceEvidence = {
  id: string;
  sourceType: DominanceSourceType;
  truthLabel: TruthLabel;
  title: string;
  detail: string;
  url?: string | null;
  confidence: number;
};

export type DominanceSuggestion = {
  id: string;
  field: DominanceSuggestionField;
  label: string;
  currentValue: string | number | null;
  proposedValue: string | number | null;
  truthLabel: TruthLabel;
  confidence: number;
  reason: string;
  evidenceIds: string[];
  safeToApply: boolean;
};

export type BottleDominanceDraft = {
  title: "Dominate this bottle";
  bottleId: string;
  generatedAt: string;
  identity: {
    displayName: string;
    producer: string | null;
    region: string | null;
    vintage: number | null;
    confidence: number;
    status: "reference_backed" | "custom_first";
  };
  market: {
    status: "verified" | "estimated" | "unknown";
    provider: string | null;
    valueCents: number | null;
    rangeLabel: string | null;
    checkedAt: string | null;
    confidence: number;
  };
  evidence: DominanceEvidence[];
  suggestions: DominanceSuggestion[];
  gaps: { kind: "identity" | "market" | "readiness" | "memory" | "pricing_provider"; message: string }[];
};

type BuildOptions = {
  asOf?: string;
  market?: DominanceMarketSignal | null;
};

const MARKET_SOURCE_BY_PROVIDER: Record<string, MarketValueSource> = {
  "wine-searcher": "wine-searcher",
  "wine_searcher": "wine-searcher",
  "wine searcher": "wine-searcher",
  "Wine-Searcher": "wine-searcher",
};

function dollars(cents: number | null | undefined) {
  if (cents == null) return null;
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function normalizeProvider(provider: string) {
  return MARKET_SOURCE_BY_PROVIDER[provider] ?? MARKET_SOURCE_BY_PROVIDER[provider.toLowerCase()] ?? "manual";
}

function suggestionId(field: DominanceSuggestionField) {
  return `dominance:${field}`;
}

export function buildBottleDominanceDraft(record: BottleDominanceRecord, options: BuildOptions = {}): BottleDominanceDraft {
  const generatedAt = options.asOf ?? new Date().toISOString();
  const ref = record.wine_reference ?? null;
  const evidence: DominanceEvidence[] = [];
  const suggestions: DominanceSuggestion[] = [];
  const gaps: BottleDominanceDraft["gaps"] = [];
  const displayName = ref?.name ?? record.custom_name ?? "Unknown wine";
  const producer = ref?.producer ?? record.custom_producer ?? null;
  const region = ref?.region ?? record.custom_region ?? null;
  const vintage = record.vintage ?? record.custom_vintage ?? null;
  const identityConfidence = ref ? 95 : producer && displayName !== "Unknown wine" ? 68 : 35;

  evidence.push({
    id: "cellar:record",
    sourceType: "cellar",
    truthLabel: "verified",
    title: "Cellar record",
    detail: `${producer ? `${producer} — ` : ""}${displayName}${vintage ? ` ${vintage}` : ""}`,
    confidence: 90,
  });

  if (ref) {
    evidence.push({
      id: "reference:linked",
      sourceType: "reference",
      truthLabel: "verified",
      title: "Linked wine reference",
      detail: [ref.producer, ref.name, ref.region, ref.country].filter(Boolean).join(" • "),
      confidence: 95,
    });

    if (!record.drink_after && ref.drink_window_start) {
      suggestions.push({
        id: suggestionId("drink_after"),
        field: "drink_after",
        label: "Drink window start",
        currentValue: record.drink_after ?? null,
        proposedValue: String(ref.drink_window_start),
        truthLabel: "verified",
        confidence: 90,
        reason: "Linked reference includes a drink-window start.",
        evidenceIds: ["reference:linked"],
        safeToApply: true,
      });
    }

    if (!record.drink_before && ref.drink_window_end) {
      suggestions.push({
        id: suggestionId("drink_before"),
        field: "drink_before",
        label: "Drink window end",
        currentValue: record.drink_before ?? null,
        proposedValue: String(ref.drink_window_end),
        truthLabel: "verified",
        confidence: 90,
        reason: "Linked reference includes a drink-window end.",
        evidenceIds: ["reference:linked"],
        safeToApply: true,
      });
    }
  } else {
    gaps.push({ kind: "identity", message: "No linked wine reference yet; identity is custom-first." });
  }

  const market = options.market ?? null;
  if (market?.valueCents != null) {
    const rangeLabel = market.lowCents && market.highCents
      ? `${dollars(market.lowCents)}–${dollars(market.highCents)}`
      : dollars(market.valueCents);
    evidence.push({
      id: "market:primary",
      sourceType: "market",
      truthLabel: market.confidence >= 75 ? "verified" : "estimated",
      title: `${market.provider} market signal`,
      detail: `${dollars(market.valueCents)}${market.merchantCount ? ` across ${market.merchantCount} merchants` : ""}`,
      url: market.sourceUrl,
      confidence: market.confidence,
    });

    if (record.current_market_value_cents == null) {
      suggestions.push({
        id: suggestionId("current_market_value_cents"),
        field: "current_market_value_cents",
        label: "Market value",
        currentValue: null,
        proposedValue: market.valueCents,
        truthLabel: market.confidence >= 75 ? "verified" : "estimated",
        confidence: market.confidence,
        reason: `Market provider returned ${rangeLabel ?? dollars(market.valueCents)} as the current signal.`,
        evidenceIds: ["market:primary"],
        safeToApply: true,
      });
      suggestions.push({
        id: suggestionId("market_value_source"),
        field: "market_value_source",
        label: "Market value source",
        currentValue: record.market_value_source ?? null,
        proposedValue: normalizeProvider(market.provider),
        truthLabel: "verified",
        confidence: market.confidence,
        reason: "Attach the provider used for this valuation.",
        evidenceIds: ["market:primary"],
        safeToApply: true,
      });
      suggestions.push({
        id: suggestionId("market_value_updated_at"),
        field: "market_value_updated_at",
        label: "Market value checked at",
        currentValue: record.market_value_updated_at ?? null,
        proposedValue: market.checkedAt,
        truthLabel: "verified",
        confidence: market.confidence,
        reason: "Timestamp the market refresh.",
        evidenceIds: ["market:primary"],
        safeToApply: true,
      });
    }

    return {
      title: "Dominate this bottle",
      bottleId: record.id,
      generatedAt,
      identity: { displayName, producer, region, vintage, confidence: identityConfidence, status: ref ? "reference_backed" : "custom_first" },
      market: { status: market.confidence >= 75 ? "verified" : "estimated", provider: market.provider, valueCents: market.valueCents, rangeLabel, checkedAt: market.checkedAt, confidence: market.confidence },
      evidence,
      suggestions,
      gaps,
    };
  }

  gaps.push({ kind: "market", message: "No verified market-price provider returned a value; price remains Unknown, not $0." });
  if (!process.env.WINE_SEARCHER_API_KEY) {
    gaps.push({ kind: "pricing_provider", message: "Wine-Searcher provider is not configured." });
  }
  if (!record.drink_after && !record.drink_before && !ref?.drink_window_start && !ref?.drink_window_end) {
    gaps.push({ kind: "readiness", message: "No drink-window evidence available yet." });
  }
  if (!record.ratings?.length && !record.notes) {
    gaps.push({ kind: "memory", message: "No Brian tasting memory captured yet." });
  }

  return {
    title: "Dominate this bottle",
    bottleId: record.id,
    generatedAt,
    identity: { displayName, producer, region, vintage, confidence: identityConfidence, status: ref ? "reference_backed" : "custom_first" },
    market: { status: "unknown", provider: null, valueCents: null, rangeLabel: null, checkedAt: null, confidence: record.current_market_value_cents == null ? 20 : 65 },
    evidence,
    suggestions,
    gaps,
  };
}

export function buildSafeDominancePatch(draft: BottleDominanceDraft, acceptedSuggestionIds: string[]) {
  const accepted = new Set(acceptedSuggestionIds);
  const patch: Record<string, string | number | null> = {};
  const acceptsMarketValue = draft.suggestions.some(
    (suggestion) => accepted.has(suggestion.id) && suggestion.field === "current_market_value_cents"
  );
  for (const suggestion of draft.suggestions) {
    const acceptedExplicitly = accepted.has(suggestion.id);
    const acceptedAsMarketMetadata = acceptsMarketValue &&
      (suggestion.field === "market_value_source" || suggestion.field === "market_value_updated_at");
    if ((!acceptedExplicitly && !acceptedAsMarketMetadata) || !suggestion.safeToApply) continue;
    patch[suggestion.field] = suggestion.proposedValue;
  }
  return patch;
}

export function getBottleConfidenceScore(draft: BottleDominanceDraft) {
  const identity = draft.identity.confidence;
  const market = draft.market.confidence;
  const readiness = draft.suggestions.some((s) => s.field === "drink_after" || s.field === "drink_before") ||
    !draft.gaps.some((g) => g.kind === "readiness") ? 90 : 20;
  const memory = draft.gaps.some((g) => g.kind === "memory") ? 0 : 80;
  const overall = Math.round(identity * 0.35 + market * 0.25 + readiness * 0.25 + memory * 0.15);
  return { identity, market, readiness, memory, overall };
}

export function summarizeDominanceProviderStatus(options: { wineSearcherConfigured: boolean; anthropicConfigured: boolean }) {
  return {
    pricing: options.wineSearcherConfigured ? "configured" : "not_configured",
    ai: options.anthropicConfigured ? "configured" : "not_configured",
  } as const;
}
