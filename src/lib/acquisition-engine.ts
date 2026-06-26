export type AcquisitionSourceKind = "buy_again" | "wishlist" | "shopping" | "restaurant_discovery" | "replenishment" | "manual";
export type AcquisitionStatus = "watching" | "buy_now" | "ordered" | "acquired" | "passed";
export type AcquisitionPriority = "must_have" | "high" | "medium" | "low";
export type AcquisitionAction = "watch" | "mark_buy_now" | "mark_ordered" | "mark_acquired" | "pass" | "reopen";
export type AcquisitionAvailability = "available" | "limited" | "unknown" | "sold_out";
export type AcquisitionPriceSourceType = "manual" | "cellartracker" | "wine_market_journal" | "retailer" | "winery" | "auction" | "public_web" | "ai_search" | "ai_inferred" | "wine_searcher_trial" | "provider" | "unknown";

export type AcquisitionTarget = {
  id: string;
  wineTitle: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
  sourceKind: AcquisitionSourceKind;
  sourceId?: string | null;
  status: AcquisitionStatus;
  targetPriceCents?: number | null;
  maxPriceCents?: number | null;
  desiredQuantity?: number | null;
  priority: AcquisitionPriority;
  nextRefreshAt?: string | null;
  lastRefreshedAt?: string | null;
  notes?: string | null;
};

export type AcquisitionPriceObservation = {
  id: string;
  targetId: string;
  observedPriceCents: number | null;
  sourceType?: AcquisitionPriceSourceType | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  availability: AcquisitionAvailability;
  confidence: number;
  observedAt: string;
};

export type AcquisitionPriceCandidate = {
  title: string;
  url?: string | null;
  sourceType?: AcquisitionPriceSourceType | null;
  sourceName?: string | null;
  extractedText?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  availability?: AcquisitionAvailability | null;
  confidence?: number | null;
};

export type NormalizedAcquisitionPriceCandidate = {
  sourceType: AcquisitionPriceSourceType;
  sourceName: string;
  sourceUrl: string | null;
  observedPriceCents: number | null;
  currency: string;
  availability: AcquisitionAvailability;
  confidence: number;
  notes: string;
  rawPayload: AcquisitionPriceCandidate;
};

export type AcquisitionEngineInput = {
  targets: AcquisitionTarget[];
  priceObservations: AcquisitionPriceObservation[];
  asOf?: string;
};

export type AcquisitionCommandItem = AcquisitionTarget & {
  decision: "buy_now" | "watch" | "ordered" | "acquired" | "passed";
  bestObservation: AcquisitionPriceObservation | null;
  bestPriceLabel: string;
  targetPriceLabel: string;
  sourceLabel: string;
  valueLabel: "below target" | "within max" | "over target" | "unknown";
  confidenceLabel: "high" | "medium" | "low" | "unknown";
  quantity: number;
  projectedSpendCents: number | null;
  refreshDue: boolean;
  refreshReason: "refresh scheduled" | "price evidence stale" | "no price evidence" | "none";
  reasons: string[];
};

export type AcquisitionEngine = {
  lanes: {
    buyNow: AcquisitionCommandItem[];
    watch: AcquisitionCommandItem[];
    ordered: AcquisitionCommandItem[];
    acquired: AcquisitionCommandItem[];
    passed: AcquisitionCommandItem[];
  };
  refreshQueue: AcquisitionCommandItem[];
  summary: {
    totalTargets: number;
    buyNowCount: number;
    watchCount: number;
    orderedCount: number;
    acquiredCount: number;
    passedCount: number;
    refreshDueCount: number;
    estimatedBuyNowSpendCents: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_STALE_DAYS = 45;

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

const sourceTypes = new Set<AcquisitionPriceSourceType>(["manual", "cellartracker", "wine_market_journal", "retailer", "winery", "auction", "public_web", "ai_search", "ai_inferred", "wine_searcher_trial", "provider", "unknown"]);
const availabilities = new Set<AcquisitionAvailability>(["available", "limited", "unknown", "sold_out"]);

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function clampConfidence(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return 60;
  return Math.max(0, Math.min(100, Math.round(value ?? 60)));
}

function safeUrl(value: string | null | undefined) {
  const trimmed = clean(value);
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function hostFromUrl(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isProtectedPricingHost(host: string | null) {
  return Boolean(host && /(^|\.)(vivino\.com|cellartracker\.com|wine-searcher\.com)$/i.test(host));
}

function sourceTypeFromCandidate(candidate: AcquisitionPriceCandidate, url: string | null): AcquisitionPriceSourceType {
  const requested = candidate.sourceType && sourceTypes.has(candidate.sourceType) ? candidate.sourceType : null;
  if (requested && requested !== "ai_search") return requested;
  const host = hostFromUrl(url);
  if (!host) return requested ?? "ai_inferred";
  if (isProtectedPricingHost(host)) return "public_web";
  if (/auction|acker|sotheby|christie|winebid|heritage/i.test(host)) return "auction";
  if (/wine\.com|totalwine|klwines|benchmarkwine|wineaccess|merchant|retail|shop/i.test(host)) return "retailer";
  if (/winery|vineyard|estate|cellars|wines?\./i.test(host)) return "winery";
  return requested ?? "public_web";
}

export function buildAcquisitionSearchRecord(target: AcquisitionTarget) {
  return {
    id: target.id,
    title: target.wineTitle,
    producer: target.producer ?? null,
    vintage: target.vintage ?? null,
    region: target.region ?? null,
    varietal: target.varietal ?? null,
    desiredQuantity: target.desiredQuantity ?? 1,
    targetPriceCents: target.targetPriceCents ?? null,
    maxPriceCents: target.maxPriceCents ?? null,
    priority: target.priority,
    sourceKind: target.sourceKind,
  };
}

export function normalizeAcquisitionPriceCandidate(candidate: AcquisitionPriceCandidate): NormalizedAcquisitionPriceCandidate {
  const sourceUrl = safeUrl(candidate.url);
  const sourceType = sourceTypeFromCandidate(candidate, sourceUrl);
  const sourceName = clean(candidate.sourceName) ?? hostFromUrl(sourceUrl) ?? clean(candidate.title) ?? sourceType;
  const price = Number.isFinite(candidate.priceCents ?? NaN) ? Math.max(0, Math.round(candidate.priceCents ?? 0)) : null;
  const sourceBackedPrice = (sourceUrl && !isProtectedPricingHost(hostFromUrl(sourceUrl))) || ["manual", "cellartracker", "wine_market_journal", "provider", "wine_searcher_trial"].includes(sourceType)
    ? price
    : null;
  return {
    sourceType,
    sourceName,
    sourceUrl,
    observedPriceCents: sourceBackedPrice,
    currency: clean(candidate.currency)?.toUpperCase().slice(0, 3) || "USD",
    availability: candidate.availability && availabilities.has(candidate.availability) ? candidate.availability : sourceBackedPrice ? "available" : "unknown",
    confidence: clampConfidence(candidate.confidence),
    notes: clean(candidate.extractedText) ?? clean(candidate.title) ?? "Acquisition price refresh candidate.",
    rawPayload: candidate,
  };
}

export function normalizeAcquisitionPriceCandidates(candidates: AcquisitionPriceCandidate[]) {
  const normalized = candidates.map(normalizeAcquisitionPriceCandidate);
  const gaps: string[] = [];
  if (!normalized.length) gaps.push("No source-backed acquisition price evidence was found.");
  if (!normalized.some((candidate) => candidate.observedPriceCents != null)) gaps.push("No usable current price was found; keep this target in the refresh queue.");
  return { observations: normalized, gaps };
}

function ageDays(iso: string, asOf: string) {
  return (new Date(asOf).getTime() - new Date(iso).getTime()) / DAY_MS;
}

function priorityWeight(priority: AcquisitionPriority) {
  return priority === "must_have" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function confidenceLabel(confidence: number | null | undefined): AcquisitionCommandItem["confidenceLabel"] {
  if (confidence == null) return "unknown";
  if (confidence >= 75) return "high";
  if (confidence >= 50) return "medium";
  return "low";
}

function observationScore(observation: AcquisitionPriceObservation, asOf: string) {
  if (observation.observedPriceCents == null || observation.observedPriceCents <= 0) return -1000;
  const availability = observation.availability === "available" ? 40 : observation.availability === "limited" ? 25 : observation.availability === "unknown" ? 5 : -80;
  const recency = Math.max(0, 30 - Math.min(30, ageDays(observation.observedAt, asOf) / 2));
  return observation.confidence + availability + recency;
}

function bestObservation(targetId: string, observations: AcquisitionPriceObservation[], asOf: string) {
  return observations
    .filter((observation) => observation.targetId === targetId)
    .sort((a, b) => observationScore(b, asOf) - observationScore(a, asOf))[0] ?? null;
}

function valueLabel(target: AcquisitionTarget, price: number | null): AcquisitionCommandItem["valueLabel"] {
  if (price == null) return "unknown";
  if (target.targetPriceCents != null && price <= target.targetPriceCents) return "below target";
  if (target.maxPriceCents != null && price <= target.maxPriceCents) return "within max";
  return "over target";
}

function refreshState(target: AcquisitionTarget, observation: AcquisitionPriceObservation | null, asOf: string): Pick<AcquisitionCommandItem, "refreshDue" | "refreshReason"> {
  if (target.status === "acquired" || target.status === "passed" || target.status === "ordered") return { refreshDue: false, refreshReason: "none" };
  if (target.nextRefreshAt && new Date(target.nextRefreshAt).getTime() <= new Date(asOf).getTime()) return { refreshDue: true, refreshReason: "refresh scheduled" };
  if (!observation) return { refreshDue: true, refreshReason: "no price evidence" };
  if (ageDays(observation.observedAt, asOf) > PRICE_STALE_DAYS) return { refreshDue: true, refreshReason: "price evidence stale" };
  return { refreshDue: false, refreshReason: "none" };
}

function decisionFor(target: AcquisitionTarget, observation: AcquisitionPriceObservation | null): AcquisitionCommandItem["decision"] {
  if (target.status === "ordered") return "ordered";
  if (target.status === "acquired") return "acquired";
  if (target.status === "passed") return "passed";
  if (target.status === "buy_now") return "buy_now";
  if (!observation || observation.observedPriceCents == null) return "watch";
  if (observation.availability === "sold_out") return "watch";
  const label = valueLabel(target, observation.observedPriceCents);
  if ((label === "below target" || label === "within max") && observation.confidence >= 60) return "buy_now";
  return "watch";
}

function reasonsFor(target: AcquisitionTarget, observation: AcquisitionPriceObservation | null, value: AcquisitionCommandItem["valueLabel"], refreshReason: AcquisitionCommandItem["refreshReason"]) {
  const reasons: string[] = [];
  if (target.priority === "must_have") reasons.push("Must-have target for the acquisition list.");
  if (observation?.sourceName) reasons.push(`Best current evidence from ${observation.sourceName}.`);
  if (value === "below target") reasons.push("Current price is at or below the target price.");
  if (value === "within max") reasons.push("Current price is within Brian's ceiling, but not a bargain.");
  if (value === "over target") reasons.push("Current price is above the target/ceiling; keep watching.");
  if (refreshReason !== "none") reasons.push(`Refresh needed: ${refreshReason}.`);
  if (!reasons.length) reasons.push("Keep on the acquisition board until better evidence arrives.");
  return reasons;
}

function buildItem(target: AcquisitionTarget, observations: AcquisitionPriceObservation[], asOf: string): AcquisitionCommandItem {
  const best = bestObservation(target.id, observations, asOf);
  const value = valueLabel(target, best?.observedPriceCents ?? null);
  const refresh = refreshState(target, best, asOf);
  const quantity = Math.max(1, target.desiredQuantity ?? 1);
  const projectedSpendCents = best?.observedPriceCents != null ? best.observedPriceCents * quantity : null;
  const decision = decisionFor(target, best);
  return {
    ...target,
    decision,
    bestObservation: best,
    bestPriceLabel: formatCurrency(best?.observedPriceCents),
    targetPriceLabel: formatCurrency(target.targetPriceCents ?? target.maxPriceCents),
    sourceLabel: best?.sourceName ?? "No source yet",
    valueLabel: value,
    confidenceLabel: confidenceLabel(best?.confidence),
    quantity,
    projectedSpendCents,
    refreshDue: refresh.refreshDue,
    refreshReason: refresh.refreshReason,
    reasons: reasonsFor(target, best, value, refresh.refreshReason),
  };
}

function sortItems(a: AcquisitionCommandItem, b: AcquisitionCommandItem) {
  const priorityDelta = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (priorityDelta) return priorityDelta;
  return (a.bestObservation?.observedPriceCents ?? Number.MAX_SAFE_INTEGER) - (b.bestObservation?.observedPriceCents ?? Number.MAX_SAFE_INTEGER);
}

export function buildAcquisitionEngine(input: AcquisitionEngineInput): AcquisitionEngine {
  const asOf = input.asOf ?? new Date().toISOString();
  const items = input.targets.map((target) => buildItem(target, input.priceObservations, asOf));
  const lanes = {
    buyNow: items.filter((item) => item.decision === "buy_now").sort(sortItems),
    watch: items.filter((item) => item.decision === "watch").sort(sortItems),
    ordered: items.filter((item) => item.decision === "ordered").sort(sortItems),
    acquired: items.filter((item) => item.decision === "acquired").sort(sortItems),
    passed: items.filter((item) => item.decision === "passed").sort(sortItems),
  };
  const refreshQueue = items.filter((item) => item.refreshDue).sort(sortItems);
  return {
    lanes,
    refreshQueue,
    summary: {
      totalTargets: items.length,
      buyNowCount: lanes.buyNow.length,
      watchCount: lanes.watch.length,
      orderedCount: lanes.ordered.length,
      acquiredCount: lanes.acquired.length,
      passedCount: lanes.passed.length,
      refreshDueCount: refreshQueue.length,
      estimatedBuyNowSpendCents: lanes.buyNow.reduce((sum, item) => sum + (item.projectedSpendCents ?? 0), 0),
    },
  };
}

export function nextAcquisitionStatus(current: AcquisitionStatus, action: AcquisitionAction): AcquisitionStatus {
  if (action === "watch") return "watching";
  if (action === "mark_buy_now") return "buy_now";
  if (action === "mark_ordered") return "ordered";
  if (action === "mark_acquired") return "acquired";
  if (action === "pass") return "passed";
  if (action === "reopen") return "watching";
  return current;
}

export { formatCurrency as formatAcquisitionCurrency };
