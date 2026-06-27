import {
  isPriceObservationStale,
  type ObservationKind,
  type PriceObservation,
  type SourceType,
} from "./current-intelligence/price-observations";
import type { WineReadinessPhase } from "./wine-readiness";

export type PortfolioValuationPhase =
  | "unknown"
  | "estimate_only"
  | "replacement_known"
  | "market_known"
  | "sell_watch"
  | "buy_watch";

export type PortfolioValuationValue = {
  valueCents: number | null;
  sourceType: SourceType | "stored" | null;
  sourceName: string | null;
  sourceUrl: string | null;
  observationId: string | null;
  observedAt: string | null;
  confidence: number;
  kind: ObservationKind | "stored_market_value" | null;
  stale: boolean;
};

export type PortfolioValuationInput = {
  inventoryId: string;
  displayName: string;
  quantity: number;
  purchasePriceCents?: number | null;
  storedMarketValueCents?: number | null;
  storedMarketValueSource?: string | null;
  storedMarketValueUpdatedAt?: string | null;
  brianFitScore?: number | null;
  readinessPhase?: WineReadinessPhase | null;
  observations?: PriceObservation[];
  asOf: string;
};

export type PortfolioSellWatchSignal = {
  shouldWatch: boolean;
  reason: string;
  confidence: number;
};

export type PortfolioValuationPosture = {
  inventoryId: string;
  displayName: string;
  quantity: number;
  purchasePriceCents: number | null;
  market: PortfolioValuationValue;
  replacement: PortfolioValuationValue;
  ignoredAiEstimateCents: number | null;
  gainLossCents: number | null;
  gainLossPercent: number | null;
  totalGainLossCents: number | null;
  valuationPhase: PortfolioValuationPhase;
  sellWatch: PortfolioSellWatchSignal;
};

const STORED_MARKET_VALUE_STALE_DAYS = 120;
const MARKET_GAIN_PERCENT_THRESHOLD = 0.3;
const MARKET_GAIN_CENTS_THRESHOLD = 10_000;

const TRUSTED_MARKET_SOURCE_TYPES = new Set<SourceType>([
  "manual",
  "cellartracker",
  "wine_market_journal",
  "auction",
  "wine_searcher_trial",
  "provider",
]);

const TRUSTED_REPLACEMENT_SOURCE_TYPES = new Set<SourceType>([
  "manual",
  "retailer",
  "winery",
  "auction",
  "wine_searcher_trial",
  "provider",
]);

const TRUSTED_STORED_MARKET_VALUE_SOURCES = new Set([
  "manual",
  "cellartracker",
  "wine_market_journal",
  "auction",
  "wine_searcher_trial",
  "wine-searcher",
  "provider",
  "vivino",
]);

const AI_SOURCE_TYPES = new Set<SourceType>(["ai_inferred", "ai_search"]);
const AI_STORED_MARKET_VALUE_SOURCES = new Set(["ai_inferred", "ai_search"]);
const IMMEDIATE_READINESS_PHASES = new Set<WineReadinessPhase>(["at_peak", "drink_soon", "past_peak"]);

function positiveCents(value: number | null | undefined) {
  return value != null && value > 0 ? value : null;
}

function normalizedSource(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function safeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isStoredMarketValueStale(updatedAt: string | null | undefined, asOf: string) {
  const updated = safeTimestamp(updatedAt);
  if (updated == null) return false;
  const reference = safeTimestamp(asOf);
  if (reference == null) return false;
  const ageDays = (reference - updated) / (24 * 60 * 60 * 1000);
  return ageDays > STORED_MARKET_VALUE_STALE_DAYS;
}

function emptyValue(): PortfolioValuationValue {
  return {
    valueCents: null,
    sourceType: null,
    sourceName: null,
    sourceUrl: null,
    observationId: null,
    observedAt: null,
    confidence: 0,
    kind: null,
    stale: false,
  };
}

function valueFromObservation(observation: PriceObservation | null, asOf: string): PortfolioValuationValue {
  if (!observation) return emptyValue();
  const stale = isPriceObservationStale(observation, asOf);
  return {
    valueCents: observation.observedPriceCents,
    sourceType: observation.sourceType,
    sourceName: observation.sourceName ?? null,
    sourceUrl: observation.sourceUrl ?? null,
    observationId: observation.id,
    observedAt: observation.observedAt,
    confidence: stale ? Math.max(1, observation.confidence - 30) : observation.confidence,
    kind: observation.observationKind,
    stale,
  };
}

function trustedStoredMarketValue(input: PortfolioValuationInput): PortfolioValuationValue {
  const storedValue = positiveCents(input.storedMarketValueCents);
  if (storedValue == null) return emptyValue();
  const source = normalizedSource(input.storedMarketValueSource);
  if (!source || !TRUSTED_STORED_MARKET_VALUE_SOURCES.has(source)) return emptyValue();
  const stale = isStoredMarketValueStale(input.storedMarketValueUpdatedAt, input.asOf);
  return {
    valueCents: storedValue,
    sourceType: "stored",
    sourceName: input.storedMarketValueSource ?? "Stored market value",
    sourceUrl: null,
    observationId: null,
    observedAt: input.storedMarketValueUpdatedAt ?? null,
    confidence: stale ? 55 : 70,
    kind: "stored_market_value",
    stale,
  };
}

function isAiInferredPrice(observation: PriceObservation) {
  return AI_SOURCE_TYPES.has(observation.sourceType) ||
    observation.truthLabel === "ai_inferred" ||
    observation.observationKind === "estimate";
}

function isAcceptedPricedNonAiObservation(observation: PriceObservation) {
  return observation.reviewStatus === "accepted" &&
    positiveCents(observation.observedPriceCents) != null &&
    !isAiInferredPrice(observation) &&
    observation.truthLabel !== "unknown" &&
    observation.truthLabel !== "rejected";
}

function isTrustedMarketObservation(observation: PriceObservation) {
  return isAcceptedPricedNonAiObservation(observation) &&
    TRUSTED_MARKET_SOURCE_TYPES.has(observation.sourceType) &&
    (observation.observationKind === "market_value" || observation.observationKind === "auction_comp");
}

function isTrustedReplacementObservation(observation: PriceObservation) {
  return isAcceptedPricedNonAiObservation(observation) &&
    TRUSTED_REPLACEMENT_SOURCE_TYPES.has(observation.sourceType) &&
    observation.observationKind === "replacement_price";
}

function kindWeight(observation: PriceObservation) {
  if (observation.observationKind === "market_value") return 3;
  if (observation.observationKind === "auction_comp") return 2;
  return 1;
}

function bestObservation(
  observations: PriceObservation[],
  asOf: string,
  predicate: (observation: PriceObservation) => boolean
) {
  return observations
    .filter(predicate)
    .sort((a, b) => {
      const staleDelta = Number(isPriceObservationStale(a, asOf)) - Number(isPriceObservationStale(b, asOf));
      if (staleDelta) return staleDelta;
      return kindWeight(b) - kindWeight(a) ||
        b.confidence - a.confidence ||
        new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime() ||
        a.id.localeCompare(b.id);
    })[0] ?? null;
}

function aiEstimateCents(input: PortfolioValuationInput) {
  const observationValue = (input.observations ?? [])
    .filter(isAiInferredPrice)
    .filter((observation) => positiveCents(observation.observedPriceCents) != null)
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))[0]?.observedPriceCents ?? null;
  if (observationValue != null) return observationValue;
  const storedValue = positiveCents(input.storedMarketValueCents);
  const storedSource = normalizedSource(input.storedMarketValueSource);
  return storedValue != null && storedSource != null && AI_STORED_MARKET_VALUE_SOURCES.has(storedSource)
    ? storedValue
    : null;
}

function calculateGainLoss(marketValueCents: number | null, purchasePriceCents: number | null, quantity: number) {
  if (marketValueCents == null || purchasePriceCents == null || purchasePriceCents <= 0) {
    return { gainLossCents: null, gainLossPercent: null, totalGainLossCents: null };
  }
  const gainLossCents = marketValueCents - purchasePriceCents;
  const gainLossPercent = Number((gainLossCents / purchasePriceCents).toFixed(4));
  return {
    gainLossCents,
    gainLossPercent,
    totalGainLossCents: gainLossCents * Math.max(0, quantity),
  };
}

function percentLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function currencyLabel(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function buildSellWatchSignal(input: PortfolioValuationInput, market: PortfolioValuationValue, gainLossCents: number | null, gainLossPercent: number | null): PortfolioSellWatchSignal {
  if (market.valueCents == null || market.stale || gainLossCents == null || gainLossPercent == null) {
    return {
      shouldWatch: false,
      reason: "No fresh trusted market value with purchase basis is available for sell-watch review.",
      confidence: 0,
    };
  }

  const readinessPhase = input.readinessPhase ?? null;
  if (readinessPhase && IMMEDIATE_READINESS_PHASES.has(readinessPhase)) {
    return {
      shouldWatch: false,
      reason: "Readiness is a stronger signal than market gain for this bottle right now; review opening or window correction first.",
      confidence: Math.min(82, market.confidence),
    };
  }

  const gainThresholdMet = gainLossPercent >= MARKET_GAIN_PERCENT_THRESHOLD || gainLossCents >= MARKET_GAIN_CENTS_THRESHOLD;
  if (!gainThresholdMet) {
    return {
      shouldWatch: false,
      reason: "Trusted market value is present, but the gain is below sell-watch thresholds.",
      confidence: Math.min(78, market.confidence),
    };
  }

  const quantity = Math.max(0, input.quantity);
  const lowFit = input.brianFitScore != null && input.brianFitScore < 90;
  const enoughQuantity = quantity > 1;
  const notBeloved = input.brianFitScore == null || lowFit;
  if (!enoughQuantity && !notBeloved) {
    return {
      shouldWatch: false,
      reason: "Gain is visible, but quantity and Brian-Fit do not yet make the trade-off worth surfacing as sell-watch.",
      confidence: Math.min(78, market.confidence),
    };
  }

  const cues = [
    `${percentLabel(gainLossPercent)} gain (${currencyLabel(gainLossCents)} per bottle)`,
    `${quantity} ${quantity === 1 ? "bottle" : "bottles"} on hand`,
    input.brianFitScore != null ? `Brian-Fit ${input.brianFitScore}` : "Brian-Fit unknown",
    readinessPhase ? `readiness ${readinessPhase.replace("_", " ")}` : "readiness unknown",
  ];

  return {
    shouldWatch: true,
    reason: `${cues.join(" · ")}; review whether holding, drinking, or selling deserves attention before value drift changes the trade-off.`,
    confidence: Math.min(94, Math.max(70, market.confidence + (enoughQuantity ? 4 : 0) + (lowFit ? 4 : 0))),
  };
}

function phaseFor(market: PortfolioValuationValue, replacement: PortfolioValuationValue, ignoredAiEstimateCents: number | null, sellWatch: PortfolioSellWatchSignal): PortfolioValuationPhase {
  if (sellWatch.shouldWatch) return "sell_watch";
  if (market.valueCents != null) return "market_known";
  if (replacement.valueCents != null) return "replacement_known";
  if (ignoredAiEstimateCents != null) return "estimate_only";
  return "unknown";
}

export function buildPortfolioValuationPosture(input: PortfolioValuationInput): PortfolioValuationPosture {
  const observations = input.observations ?? [];
  const trustedMarket = valueFromObservation(bestObservation(observations, input.asOf, isTrustedMarketObservation), input.asOf);
  const storedMarket = trustedStoredMarketValue(input);
  const market = trustedMarket.valueCents != null ? trustedMarket : storedMarket;
  const replacement = valueFromObservation(bestObservation(observations, input.asOf, isTrustedReplacementObservation), input.asOf);
  const ignoredAiEstimateCents = aiEstimateCents(input);
  const purchasePriceCents = positiveCents(input.purchasePriceCents);
  const { gainLossCents, gainLossPercent, totalGainLossCents } = calculateGainLoss(market.valueCents, purchasePriceCents, input.quantity);
  const sellWatch = buildSellWatchSignal(input, market, gainLossCents, gainLossPercent);

  return {
    inventoryId: input.inventoryId,
    displayName: input.displayName,
    quantity: Math.max(0, input.quantity),
    purchasePriceCents,
    market,
    replacement,
    ignoredAiEstimateCents,
    gainLossCents,
    gainLossPercent,
    totalGainLossCents,
    valuationPhase: phaseFor(market, replacement, ignoredAiEstimateCents, sellWatch),
    sellWatch,
  };
}
