import { isPriceObservationStale, type PriceObservation } from "./current-intelligence/price-observations";
import { buildPortfolioValuationPosture } from "./portfolio-valuations";
import type { WineReadinessPhase } from "./wine-readiness";

export type PortfolioRefreshScope = "pricing" | "replacement" | "readiness" | "deep";

export type PortfolioRefreshReason =
  | "missing_market_value"
  | "missing_replacement_price"
  | "stale_market_value"
  | "stale_replacement_price"
  | "high_value_watch"
  | "readiness_transition"
  | "unresolved_radar_action";

export type PortfolioRefreshSkipReason =
  | "inactive_inventory"
  | "review_pending"
  | "cooldown_active"
  | "ai_inferred_only"
  | "fresh_enough"
  | "no_actionable_gap"
  | "budget_deferred";

export type PortfolioRefreshCostTier = "free" | "low" | "llm_search" | "provider_ready";

export type PortfolioRefreshSeverity = "critical" | "high" | "medium" | "low";

export type PortfolioRefreshCellarItem = {
  id: string;
  displayName?: string | null;
  quantity: number;
  purchasePriceCents?: number | null;
  currentMarketValueCents?: number | null;
  marketValueSource?: string | null;
  marketValueUpdatedAt?: string | null;
  drinkAfter?: string | null;
  drinkBefore?: string | null;
  readinessPhase?: WineReadinessPhase | null;
  readinessConfidence?: string | number | null;
  acceptedPriceEvidenceCount?: number | null;
  stalePriceEvidenceCount?: number | null;
  evidenceAwaitingReviewCount?: number | null;
  brianFitScore?: number | null;
};

export type PortfolioRefreshRecord = {
  id: string;
  inventoryId: string;
  scope: PortfolioRefreshScope | "quick" | string;
  status: "queued" | "running" | "completed" | "failed" | "skipped" | string;
  startedAt: string;
  completedAt?: string | null;
};

export type PortfolioRefreshActionHint = {
  inventoryId: string;
  actionType: string;
  priority?: number | null;
};

export type PortfolioRefreshBudget = {
  maxItems?: number;
  maxCostUnits?: number;
};

export type PortfolioRefreshQueueItem = {
  id: string;
  inventoryId: string;
  label: string;
  priority: number;
  severity: PortfolioRefreshSeverity;
  scope: PortfolioRefreshScope;
  costTier: PortfolioRefreshCostTier;
  costUnits: number;
  reasons: PortfolioRefreshReason[];
  expectedAction: "refresh_pricing" | "refresh_replacement" | "refresh_readiness" | "deep_refresh";
  nextRefreshAt: string;
  cooldownUntil: string | null;
  targetHref: string;
  metadata: {
    quantity: number;
    purchasePriceCents: number | null;
    marketValueCents: number | null;
    replacementPriceCents: number | null;
    ignoredAiEstimateCents: number | null;
    readinessPhase: WineReadinessPhase | null;
    brianFitScore: number | null;
  };
};

export type PortfolioRefreshSkippedItem = {
  inventoryId: string;
  label: string;
  skipReasons: PortfolioRefreshSkipReason[];
  candidateReasons: PortfolioRefreshReason[];
  priority: number;
  cooldownUntil: string | null;
};

export type PortfolioRefreshSummary = {
  dueCount: number;
  highPriorityCount: number;
  deferredCount: number;
  estimatedCostUnits: number;
  budget: Required<PortfolioRefreshBudget>;
  byScope: Record<PortfolioRefreshScope, number>;
  byReason: Record<PortfolioRefreshReason, number>;
  skippedByReason: Record<PortfolioRefreshSkipReason, number>;
};

export type PortfolioRefreshPlan = {
  asOf: string;
  items: PortfolioRefreshQueueItem[];
  skipped: PortfolioRefreshSkippedItem[];
  summary: PortfolioRefreshSummary;
};

export type PortfolioRefreshQueueInput = {
  asOf: string | Date;
  cellar: PortfolioRefreshCellarItem[];
  priceObservations?: PriceObservation[];
  refreshes?: PortfolioRefreshRecord[];
  actionHints?: PortfolioRefreshActionHint[];
  budget?: PortfolioRefreshBudget;
};

const DEFAULT_BUDGET: Required<PortfolioRefreshBudget> = {
  maxItems: 8,
  maxCostUnits: 18,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const HIGH_VALUE_UNIT_CENTS = 25_000;
const HIGH_VALUE_TOTAL_CENTS = 30_000;
const STALE_STORED_MARKET_DAYS = 120;

const AI_STORED_MARKET_VALUE_SOURCES = new Set(["ai_inferred", "ai_search"]);
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

const READINESS_TRANSITION_PRIORITIES: Partial<Record<WineReadinessPhase, number>> = {
  past_peak: 980,
  drink_soon: 940,
  at_peak: 920,
  entering_window: 760,
};

const REASON_PRIORITY: Record<PortfolioRefreshReason, number> = {
  readiness_transition: 760,
  high_value_watch: 900,
  stale_market_value: 920,
  missing_market_value: 780,
  stale_replacement_price: 720,
  missing_replacement_price: 620,
  unresolved_radar_action: 700,
};

const EMPTY_REASON_COUNTS: Record<PortfolioRefreshReason, number> = {
  missing_market_value: 0,
  missing_replacement_price: 0,
  stale_market_value: 0,
  stale_replacement_price: 0,
  high_value_watch: 0,
  readiness_transition: 0,
  unresolved_radar_action: 0,
};

const EMPTY_SKIP_COUNTS: Record<PortfolioRefreshSkipReason, number> = {
  inactive_inventory: 0,
  review_pending: 0,
  cooldown_active: 0,
  ai_inferred_only: 0,
  fresh_enough: 0,
  no_actionable_gap: 0,
  budget_deferred: 0,
};

function asIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function safeTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function daysBetween(earlier: string | null | undefined, later: string) {
  const start = safeTime(earlier);
  const end = safeTime(later);
  if (start == null || end == null) return null;
  return (end - start) / DAY_MS;
}

function addDays(iso: string, days: number) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

function normalizeBudget(budget?: PortfolioRefreshBudget): Required<PortfolioRefreshBudget> {
  return {
    maxItems: Math.max(0, Math.round(budget?.maxItems ?? DEFAULT_BUDGET.maxItems)),
    maxCostUnits: Math.max(0, Math.round(budget?.maxCostUnits ?? DEFAULT_BUDGET.maxCostUnits)),
  };
}

function displayName(item: PortfolioRefreshCellarItem) {
  return item.displayName?.trim() || "Unknown wine";
}

function groupPriceObservations(observations: PriceObservation[]) {
  const byInventory = new Map<string, PriceObservation[]>();
  for (const observation of observations) {
    const current = byInventory.get(observation.inventoryId) ?? [];
    current.push(observation);
    byInventory.set(observation.inventoryId, current);
  }
  return byInventory;
}

function groupRefreshes(refreshes: PortfolioRefreshRecord[]) {
  const byInventory = new Map<string, PortfolioRefreshRecord[]>();
  for (const refresh of refreshes) {
    const current = byInventory.get(refresh.inventoryId) ?? [];
    current.push(refresh);
    byInventory.set(refresh.inventoryId, current);
  }
  return byInventory;
}

function groupActionHints(hints: PortfolioRefreshActionHint[]) {
  const byInventory = new Map<string, PortfolioRefreshActionHint[]>();
  for (const hint of hints) {
    const current = byInventory.get(hint.inventoryId) ?? [];
    current.push(hint);
    byInventory.set(hint.inventoryId, current);
  }
  return byInventory;
}

function normalizedSource(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function storedMarketIsTrusted(item: PortfolioRefreshCellarItem) {
  const value = item.currentMarketValueCents;
  const source = normalizedSource(item.marketValueSource);
  return value != null && value > 0 && source != null && TRUSTED_STORED_MARKET_VALUE_SOURCES.has(source);
}

function storedMarketIsAi(item: PortfolioRefreshCellarItem) {
  const value = item.currentMarketValueCents;
  const source = normalizedSource(item.marketValueSource);
  return value != null && value > 0 && source != null && AI_STORED_MARKET_VALUE_SOURCES.has(source);
}

function storedMarketIsStale(item: PortfolioRefreshCellarItem, asOf: string) {
  if (!storedMarketIsTrusted(item) || !item.marketValueUpdatedAt) return false;
  const age = daysBetween(item.marketValueUpdatedAt, asOf);
  return age != null && age > STALE_STORED_MARKET_DAYS;
}

function draftObservationCount(observations: PriceObservation[]) {
  return observations.filter((observation) => observation.reviewStatus === "draft").length;
}

function acceptedObservationCount(observations: PriceObservation[]) {
  return observations.filter((observation) => observation.reviewStatus === "accepted").length;
}

function highValueBasisCents(item: PortfolioRefreshCellarItem, marketValueCents: number | null) {
  const unit = marketValueCents ?? item.currentMarketValueCents ?? item.purchasePriceCents ?? null;
  if (unit == null || unit <= 0) return { unit: null, total: null, highValue: false };
  const total = unit * Math.max(0, item.quantity);
  return {
    unit,
    total,
    highValue: unit >= HIGH_VALUE_UNIT_CENTS || total >= HIGH_VALUE_TOTAL_CENTS,
  };
}

function relevantScopes(scope: PortfolioRefreshScope) {
  if (scope === "readiness") return new Set(["readiness", "deep", "quick"]);
  if (scope === "replacement") return new Set(["replacement", "pricing", "deep", "quick"]);
  if (scope === "deep") return new Set(["deep", "pricing", "quick"]);
  return new Set(["pricing", "deep", "quick"]);
}

function latestCompletedRefresh(refreshes: PortfolioRefreshRecord[], scope: PortfolioRefreshScope) {
  const scopes = relevantScopes(scope);
  return refreshes
    .filter((refresh) => refresh.status === "completed" && scopes.has(refresh.scope))
    .sort((a, b) => (safeTime(b.completedAt ?? b.startedAt) ?? 0) - (safeTime(a.completedAt ?? a.startedAt) ?? 0))[0] ?? null;
}

function cooldownDays(scope: PortfolioRefreshScope) {
  if (scope === "readiness") return 3;
  if (scope === "deep") return 7;
  return 7;
}

function activeCooldown(refreshes: PortfolioRefreshRecord[], scope: PortfolioRefreshScope, asOf: string) {
  const latest = latestCompletedRefresh(refreshes, scope);
  if (!latest) return null;
  const completedAt = latest.completedAt ?? latest.startedAt;
  const age = daysBetween(completedAt, asOf);
  if (age == null || age >= cooldownDays(scope)) return null;
  return addDays(completedAt, cooldownDays(scope));
}

function severityFor(priority: number): PortfolioRefreshSeverity {
  if (priority >= 950) return "critical";
  if (priority >= 820) return "high";
  if (priority >= 650) return "medium";
  return "low";
}

function scopeFor(reasons: PortfolioRefreshReason[], highValue: boolean): PortfolioRefreshScope {
  const pricingReason = reasons.includes("missing_market_value") || reasons.includes("stale_market_value");
  if (highValue && pricingReason) return "deep";
  if (pricingReason) return "pricing";
  if (reasons.includes("stale_replacement_price") || reasons.includes("missing_replacement_price")) return "replacement";
  return "readiness";
}

function expectedAction(scope: PortfolioRefreshScope): PortfolioRefreshQueueItem["expectedAction"] {
  if (scope === "readiness") return "refresh_readiness";
  if (scope === "replacement") return "refresh_replacement";
  if (scope === "deep") return "deep_refresh";
  return "refresh_pricing";
}

function costUnits(scope: PortfolioRefreshScope) {
  if (scope === "readiness") return 1;
  if (scope === "deep") return 4;
  return 2;
}

function costTier(scope: PortfolioRefreshScope): PortfolioRefreshCostTier {
  if (scope === "readiness") return "free";
  if (scope === "deep") return "llm_search";
  return "low";
}

function uniqueReasons(reasons: PortfolioRefreshReason[]) {
  return [...new Set(reasons)];
}

function highestReasonPriority(reasons: PortfolioRefreshReason[], phase: WineReadinessPhase | null | undefined, highValue: boolean) {
  const readinessPriority = reasons.includes("readiness_transition") && phase
    ? READINESS_TRANSITION_PRIORITIES[phase] ?? REASON_PRIORITY.readiness_transition
    : 0;
  const base = reasons.reduce((max, reason) => Math.max(max, REASON_PRIORITY[reason]), readinessPriority);
  return highValue && reasons.includes("missing_market_value") ? Math.max(base, 900) : base;
}

function skipRecord(item: PortfolioRefreshCellarItem, skipReasons: PortfolioRefreshSkipReason[], candidateReasons: PortfolioRefreshReason[] = [], priority = 0, cooldownUntil: string | null = null): PortfolioRefreshSkippedItem {
  return {
    inventoryId: item.id,
    label: displayName(item),
    skipReasons: [...new Set(skipReasons)],
    candidateReasons: uniqueReasons(candidateReasons),
    priority,
    cooldownUntil,
  };
}

function buildCandidate(
  item: PortfolioRefreshCellarItem,
  observations: PriceObservation[],
  refreshes: PortfolioRefreshRecord[],
  actionHints: PortfolioRefreshActionHint[],
  asOf: string
): { item: PortfolioRefreshQueueItem | null; skipped: PortfolioRefreshSkippedItem | null } {
  if (item.quantity <= 0) {
    return { item: null, skipped: skipRecord(item, ["inactive_inventory"]) };
  }

  const valuation = buildPortfolioValuationPosture({
    inventoryId: item.id,
    displayName: displayName(item),
    quantity: item.quantity,
    purchasePriceCents: item.purchasePriceCents ?? null,
    storedMarketValueCents: item.currentMarketValueCents ?? null,
    storedMarketValueSource: item.marketValueSource ?? null,
    storedMarketValueUpdatedAt: item.marketValueUpdatedAt ?? null,
    brianFitScore: item.brianFitScore ?? null,
    readinessPhase: item.readinessPhase ?? null,
    observations,
    asOf,
  });

  const reasons: PortfolioRefreshReason[] = [];
  const phase = item.readinessPhase ?? null;
  if (phase && READINESS_TRANSITION_PRIORITIES[phase]) reasons.push("readiness_transition");

  const acceptedCount = Math.max(item.acceptedPriceEvidenceCount ?? 0, acceptedObservationCount(observations));
  const reviewCount = Math.max(item.evidenceAwaitingReviewCount ?? 0, draftObservationCount(observations));
  const hasReplacement = valuation.replacement.valueCents != null;
  const hasMarket = valuation.market.valueCents != null;
  const hasPurchaseBasis = item.purchasePriceCents != null && item.purchasePriceCents > 0;
  const hasAiOnlyContext = valuation.ignoredAiEstimateCents != null || storedMarketIsAi(item);
  const highValue = highValueBasisCents(item, valuation.market.valueCents).highValue;
  const staleMarket = valuation.market.stale || storedMarketIsStale(item, asOf) || observations.some((observation) =>
    observation.reviewStatus === "accepted" &&
    (observation.observationKind === "market_value" || observation.observationKind === "auction_comp") &&
    isPriceObservationStale(observation, asOf)
  );
  const staleReplacement = valuation.replacement.stale || observations.some((observation) =>
    observation.reviewStatus === "accepted" &&
    observation.observationKind === "replacement_price" &&
    isPriceObservationStale(observation, asOf)
  );

  if (staleMarket) reasons.push("stale_market_value");
  if (staleReplacement) reasons.push("stale_replacement_price");

  if (!hasMarket && (hasPurchaseBasis || hasReplacement || highValue)) {
    reasons.push("missing_market_value");
  }
  if (!hasReplacement && highValue && !hasAiOnlyContext) {
    reasons.push("missing_replacement_price");
  }
  if (highValue && (!hasMarket || staleMarket || staleReplacement)) {
    reasons.push("high_value_watch");
  }
  if (actionHints.some((hint) => hint.actionType === "refresh_valuation" || hint.actionType === "sell_watch")) {
    reasons.push("unresolved_radar_action");
  }

  const candidateReasons = uniqueReasons(reasons);
  const priority = highestReasonPriority(candidateReasons, phase, highValue);

  if (reviewCount > 0) {
    return { item: null, skipped: skipRecord(item, ["review_pending"], candidateReasons, priority) };
  }
  if (!candidateReasons.length) {
    const skip: PortfolioRefreshSkipReason = hasAiOnlyContext && acceptedCount > 0 ? "ai_inferred_only" : hasMarket || hasReplacement ? "fresh_enough" : "no_actionable_gap";
    return { item: null, skipped: skipRecord(item, [skip], candidateReasons, priority) };
  }
  if (hasAiOnlyContext && !hasPurchaseBasis && !hasReplacement && candidateReasons.every((reason) => reason === "missing_market_value" || reason === "high_value_watch")) {
    return { item: null, skipped: skipRecord(item, ["ai_inferred_only"], candidateReasons, priority) };
  }

  const scope = scopeFor(candidateReasons, highValue);
  const cooldownUntil = activeCooldown(refreshes, scope, asOf);
  if (cooldownUntil) {
    return { item: null, skipped: skipRecord(item, ["cooldown_active"], candidateReasons, priority, cooldownUntil) };
  }

  return {
    skipped: null,
    item: {
      id: `refresh:${scope}:${item.id}`,
      inventoryId: item.id,
      label: displayName(item),
      priority,
      severity: severityFor(priority),
      scope,
      costTier: costTier(scope),
      costUnits: costUnits(scope),
      reasons: candidateReasons,
      expectedAction: expectedAction(scope),
      nextRefreshAt: asOf,
      cooldownUntil: null,
      targetHref: `/cellar/${item.id}?focus=valuation-refresh`,
      metadata: {
        quantity: item.quantity,
        purchasePriceCents: item.purchasePriceCents ?? null,
        marketValueCents: valuation.market.valueCents,
        replacementPriceCents: valuation.replacement.valueCents,
        ignoredAiEstimateCents: valuation.ignoredAiEstimateCents,
        readinessPhase: phase,
        brianFitScore: item.brianFitScore ?? null,
      },
    },
  };
}

function compareQueueItems(a: PortfolioRefreshQueueItem, b: PortfolioRefreshQueueItem) {
  return b.priority - a.priority ||
    a.costUnits - b.costUnits ||
    a.label.localeCompare(b.label) ||
    a.inventoryId.localeCompare(b.inventoryId);
}

function summarize(items: PortfolioRefreshQueueItem[], skipped: PortfolioRefreshSkippedItem[], budget: Required<PortfolioRefreshBudget>): PortfolioRefreshSummary {
  const byScope: Record<PortfolioRefreshScope, number> = { pricing: 0, replacement: 0, readiness: 0, deep: 0 };
  const byReason = { ...EMPTY_REASON_COUNTS };
  const skippedByReason = { ...EMPTY_SKIP_COUNTS };
  for (const item of items) {
    byScope[item.scope] += 1;
    for (const reason of item.reasons) byReason[reason] += 1;
  }
  for (const item of skipped) {
    for (const reason of item.skipReasons) skippedByReason[reason] += 1;
  }
  return {
    dueCount: items.length,
    highPriorityCount: items.filter((item) => item.priority >= 820).length,
    deferredCount: skipped.filter((item) => item.skipReasons.includes("budget_deferred")).length,
    estimatedCostUnits: items.reduce((sum, item) => sum + item.costUnits, 0),
    budget,
    byScope,
    byReason,
    skippedByReason,
  };
}

export function buildPortfolioRefreshQueue(input: PortfolioRefreshQueueInput): PortfolioRefreshPlan {
  const asOf = asIso(input.asOf);
  const budget = normalizeBudget(input.budget);
  const observationsByInventory = groupPriceObservations(input.priceObservations ?? []);
  const refreshesByInventory = groupRefreshes(input.refreshes ?? []);
  const hintsByInventory = groupActionHints(input.actionHints ?? []);
  const candidates: PortfolioRefreshQueueItem[] = [];
  const skipped: PortfolioRefreshSkippedItem[] = [];

  for (const cellarItem of input.cellar) {
    const result = buildCandidate(
      cellarItem,
      observationsByInventory.get(cellarItem.id) ?? [],
      refreshesByInventory.get(cellarItem.id) ?? [],
      hintsByInventory.get(cellarItem.id) ?? [],
      asOf
    );
    if (result.item) candidates.push(result.item);
    if (result.skipped) skipped.push(result.skipped);
  }

  const items: PortfolioRefreshQueueItem[] = [];
  let spent = 0;
  for (const candidate of candidates.sort(compareQueueItems)) {
    if (items.length >= budget.maxItems || spent + candidate.costUnits > budget.maxCostUnits) {
      skipped.push({
        inventoryId: candidate.inventoryId,
        label: candidate.label,
        skipReasons: ["budget_deferred"],
        candidateReasons: candidate.reasons,
        priority: candidate.priority,
        cooldownUntil: null,
      });
      continue;
    }
    items.push(candidate);
    spent += candidate.costUnits;
  }

  return {
    asOf,
    items,
    skipped: skipped.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label) || a.inventoryId.localeCompare(b.inventoryId)),
    summary: summarize(items, skipped, budget),
  };
}
