export type AcquisitionSourceKind = "buy_again" | "wishlist" | "shopping" | "restaurant_discovery" | "replenishment" | "manual";
export type AcquisitionStatus = "watching" | "buy_now" | "ordered" | "acquired" | "passed";
export type AcquisitionPriority = "must_have" | "high" | "medium" | "low";
export type AcquisitionAction = "watch" | "mark_buy_now" | "mark_ordered" | "mark_acquired" | "pass" | "reopen";
export type AcquisitionAvailability = "available" | "limited" | "unknown" | "sold_out";

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
  sourceName?: string | null;
  sourceUrl?: string | null;
  availability: AcquisitionAvailability;
  confidence: number;
  observedAt: string;
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
