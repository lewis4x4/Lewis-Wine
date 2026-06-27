import { buildAcquisitionReceipt, type AcquisitionReceiptInput } from "./acquisition-receipt";
import {
  buildAcquisitionEngine,
  type AcquisitionCommandItem,
  type AcquisitionPriceObservation,
  type AcquisitionTarget,
} from "./acquisition-engine";
import type { CellarCommandWine } from "./cellar-command-center";
import { isPriceObservationStale, type PriceObservation, type SourceType } from "./current-intelligence/price-observations";
import { buildReadinessInputWithDrinkWindowEvidence, type DrinkWindowObservation } from "./drink-window-evidence";
import {
  buildReplenishmentAutomation,
  type ReplenishmentAutomationInput,
  type ReplenishmentPrompt,
} from "./replenishment-automation";
import {
  getWineReadinessProfile,
  isWineApproachingPeak,
  type WineReadinessProfile,
} from "./wine-readiness";

export type PortfolioRadarActionType =
  | "drink_now"
  | "at_risk_past_peak"
  | "missing_drink_window"
  | "review_price_evidence"
  | "refresh_valuation"
  | "replenish"
  | "acquisition_buy"
  | "acquisition_watch"
  | "close_receipt"
  | "capture_tasting_memory"
  | "investigate_missing_evidence";

export type PortfolioRadarSeverity = "critical" | "high" | "medium" | "low";

export type PortfolioRadarSourceSurface =
  | "cellar_command_center"
  | "portfolio_truth"
  | "replenishment_automation"
  | "acquisition_engine"
  | "acquisition_receipt"
  | "tasting_memory";

export type PortfolioRadarTargetKind = "cellar_item" | "acquisition_target" | "receipt" | "tasting_memory";

export type PortfolioRadarTargetMetadata = Record<string, string | number | boolean | null>;

export type PortfolioRadarTarget = {
  kind: PortfolioRadarTargetKind;
  id: string;
  href: string;
  label: string;
  metadata: PortfolioRadarTargetMetadata;
};

export type PortfolioRadarCta = {
  label: string;
  href: string;
  action: string;
};

export type PortfolioRadarAffordance = {
  snooze: {
    enabled: true;
    state: "available" | "snoozed";
    until: string | null;
    suggestedUntil: string | null;
  };
  dismiss: {
    enabled: true;
    state: "available" | "dismissed";
    dismissedAt: string | null;
  };
};

export type PortfolioRadarAction = {
  id: string;
  dedupeKey: string;
  type: PortfolioRadarActionType;
  subjectType: PortfolioRadarTargetKind;
  subjectId: string;
  priority: number;
  severity: PortfolioRadarSeverity;
  verb: string;
  label: string;
  reason: string;
  confidence: number;
  sourceSurface: PortfolioRadarSourceSurface;
  cta: PortfolioRadarCta;
  target: PortfolioRadarTarget;
  affordance: PortfolioRadarAffordance;
};

export type PortfolioRadarCellarItem = CellarCommandWine & {
  wine_reference_id?: string | null;
  market_value_source?: string | null;
  market_value_updated_at?: string | null;
  peak_start?: string | null;
  peak_end?: string | null;
  reference_drink_after?: string | null;
  reference_drink_before?: string | null;
  reference_peak_start?: string | null;
  reference_peak_end?: string | null;
  wine_reference_drink_window_start?: string | null;
  wine_reference_drink_window_end?: string | null;
  wine_reference_peak_start?: string | null;
  wine_reference_peak_end?: string | null;
  drink_window_start?: string | null;
  drink_window_end?: string | null;
  drink_window_observations?: DrinkWindowObservation[];
};

export type PortfolioRadarReceiptInput = AcquisitionReceiptInput & {
  id?: string | null;
};

export type PortfolioRadarTastingMemoryDraft = {
  id: string;
  inventoryId?: string | null;
  wineTitle: string;
  status: "draft" | "needs_review" | "captured" | "dismissed";
  capturedAt?: string | null;
  confidence?: number | null;
};

export type PortfolioRadarInput = {
  asOf: string | Date;
  cellar?: PortfolioRadarCellarItem[];
  priceObservations?: PriceObservation[];
  acquisition?: {
    targets: AcquisitionTarget[];
    priceObservations?: AcquisitionPriceObservation[];
  };
  replenishment?: ReplenishmentAutomationInput;
  receipts?: PortfolioRadarReceiptInput[];
  tastingMemoryDrafts?: PortfolioRadarTastingMemoryDraft[];
  actionLimit?: number;
};

export type PortfolioRadarSummary = {
  totalActions: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  byType: Record<PortfolioRadarActionType, number>;
};

export type PortfolioRadar = {
  asOf: string;
  actions: PortfolioRadarAction[];
  summary: PortfolioRadarSummary;
};

type PriceEvidenceSummary = {
  observations: PriceObservation[];
  reviewCount: number;
  staleCount: number;
  trustedMarketObservation: PriceObservation | null;
  trustedReplacementObservation: PriceObservation | null;
  marketValueCents: number | null;
  replacementPriceCents: number | null;
  aiInferredObservedPriceCents: number | null;
};

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

const AI_STORED_MARKET_VALUE_SOURCES = new Set([
  "ai_inferred",
  "ai_search",
]);

const ACTION_TYPES: PortfolioRadarActionType[] = [
  "drink_now",
  "at_risk_past_peak",
  "missing_drink_window",
  "review_price_evidence",
  "refresh_valuation",
  "replenish",
  "acquisition_buy",
  "acquisition_watch",
  "close_receipt",
  "capture_tasting_memory",
  "investigate_missing_evidence",
];

function asIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function asDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Portfolio Radar asOf timestamp: ${value}`);
  }
  return date;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function displayName(wine: PortfolioRadarCellarItem) {
  const name = wine.name || wine.custom_name || "Unknown wine";
  const vintage = wine.vintage ?? wine.custom_vintage ?? null;
  return vintage ? `${vintage} ${name}` : name;
}

function producerName(wine: PortfolioRadarCellarItem) {
  return wine.producer || wine.custom_producer || null;
}

function targetForCellar(
  wine: PortfolioRadarCellarItem,
  metadata: PortfolioRadarTargetMetadata = {}
): PortfolioRadarTarget {
  return {
    kind: "cellar_item",
    id: wine.id,
    href: `/cellar/${wine.id}`,
    label: displayName(wine),
    metadata: {
      quantity: Math.max(0, wine.quantity),
      producer: producerName(wine),
      vintage: wine.vintage ?? wine.custom_vintage ?? null,
      drinkAfter: wine.drink_after ?? null,
      drinkBefore: wine.drink_before ?? null,
      purchasePriceCents: wine.purchase_price_cents ?? null,
      currentMarketValueCents: wine.current_market_value_cents ?? null,
      ...metadata,
    },
  };
}

function readinessMetadata(profile: WineReadinessProfile): PortfolioRadarTargetMetadata {
  return {
    readiness: profile.legacyState,
    readinessPhase: profile.phase,
    readinessSource: profile.source,
    readinessConfidence: profile.confidence,
    normalizedDrinkAfter: profile.normalizedDrinkAfter,
    normalizedDrinkBefore: profile.normalizedDrinkBefore,
    peakStart: profile.peakStart,
    peakEnd: profile.peakEnd,
    daysToStart: profile.daysToStart,
    daysToPeak: profile.daysToPeak,
    daysToEnd: profile.daysToEnd,
    readinessNextAction: profile.nextAction,
  };
}

function affordance(): PortfolioRadarAffordance {
  return {
    snooze: {
      enabled: true,
      state: "available",
      until: null,
      suggestedUntil: null,
    },
    dismiss: {
      enabled: true,
      state: "available",
      dismissedAt: null,
    },
  };
}

function action(params: Omit<PortfolioRadarAction, "id" | "dedupeKey" | "subjectType" | "subjectId" | "affordance">): PortfolioRadarAction {
  const dedupeKey = `${params.type}:${params.target.kind}:${params.target.id}`;
  return {
    id: `radar:${dedupeKey}`,
    dedupeKey,
    subjectType: params.target.kind,
    subjectId: params.target.id,
    ...params,
    affordance: affordance(),
  };
}

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function groupPriceObservations(observations: PriceObservation[]) {
  const byInventoryId = new Map<string, PriceObservation[]>();
  for (const observation of observations) {
    const current = byInventoryId.get(observation.inventoryId) ?? [];
    current.push(observation);
    byInventoryId.set(observation.inventoryId, current);
  }
  return byInventoryId;
}

function isAiInferredPrice(observation: PriceObservation) {
  return observation.sourceType === "ai_inferred" ||
    observation.sourceType === "ai_search" ||
    observation.truthLabel === "ai_inferred" ||
    observation.observationKind === "estimate";
}

function isAcceptedPricedNonAiObservation(observation: PriceObservation) {
  return observation.reviewStatus === "accepted" &&
    observation.observedPriceCents != null &&
    observation.observedPriceCents > 0 &&
    !isAiInferredPrice(observation) &&
    observation.truthLabel !== "unknown" &&
    observation.truthLabel !== "rejected";
}

function isTrustedMarketObservation(observation: PriceObservation) {
  return isAcceptedPricedNonAiObservation(observation) &&
    TRUSTED_MARKET_SOURCE_TYPES.has(observation.sourceType) &&
    ["market_value", "auction_comp"].includes(observation.observationKind);
}

function isTrustedReplacementObservation(observation: PriceObservation) {
  return isAcceptedPricedNonAiObservation(observation) &&
    TRUSTED_REPLACEMENT_SOURCE_TYPES.has(observation.sourceType) &&
    observation.observationKind === "replacement_price";
}

function marketKindWeight(observation: PriceObservation) {
  if (observation.observationKind === "market_value") return 3;
  if (observation.observationKind === "auction_comp") return 2;
  return 1;
}

function bestObservation(
  observations: PriceObservation[],
  asOf: string,
  predicate: (observation: PriceObservation) => boolean,
  kindWeight: (observation: PriceObservation) => number = () => 1
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

function storedMarketValueSource(wine: PortfolioRadarCellarItem) {
  return wine.market_value_source?.trim().toLowerCase() ?? null;
}

function positiveStoredMarketValue(wine: PortfolioRadarCellarItem) {
  return wine.current_market_value_cents != null && wine.current_market_value_cents > 0
    ? wine.current_market_value_cents
    : null;
}

function trustedStoredMarketValueCents(wine: PortfolioRadarCellarItem) {
  const value = positiveStoredMarketValue(wine);
  if (value == null) return null;
  const source = storedMarketValueSource(wine);
  return source && TRUSTED_STORED_MARKET_VALUE_SOURCES.has(source) ? value : null;
}

function aiInferredStoredMarketValueCents(wine: PortfolioRadarCellarItem) {
  const value = positiveStoredMarketValue(wine);
  if (value == null) return null;
  const source = storedMarketValueSource(wine);
  return source && AI_STORED_MARKET_VALUE_SOURCES.has(source) ? value : null;
}

function priceEvidenceSummary(
  wine: PortfolioRadarCellarItem,
  observations: PriceObservation[],
  asOf: string
): PriceEvidenceSummary {
  const trustedMarket = observations.filter(isTrustedMarketObservation);
  const trustedReplacement = observations.filter(isTrustedReplacementObservation);
  const trustedMarketObservation = bestObservation(observations, asOf, isTrustedMarketObservation, marketKindWeight);
  const trustedReplacementObservation = bestObservation(observations, asOf, isTrustedReplacementObservation);
  const trustedStoredMarket = trustedStoredMarketValueCents(wine);
  const aiInferredStoredMarket = aiInferredStoredMarketValueCents(wine);
  const reviewCount = Math.max(
    Math.max(wine.evidence_awaiting_review_count ?? 0, 0),
    observations.filter((observation) => observation.reviewStatus === "draft").length
  );
  const staleCount = Math.max(
    Math.max(wine.stale_price_evidence_count ?? 0, 0),
    [...trustedMarket, ...trustedReplacement].filter((observation) => isPriceObservationStale(observation, asOf)).length
  );
  const aiInferredObservedPriceCents = observations
    .filter(isAiInferredPrice)
    .filter((observation) => observation.observedPriceCents != null && observation.observedPriceCents > 0)
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))[0]?.observedPriceCents ?? aiInferredStoredMarket;
  return {
    observations,
    reviewCount,
    staleCount,
    trustedMarketObservation,
    trustedReplacementObservation,
    marketValueCents: trustedMarketObservation?.observedPriceCents ?? trustedStoredMarket,
    replacementPriceCents: trustedReplacementObservation?.observedPriceCents ?? null,
    aiInferredObservedPriceCents,
  };
}

function severityForPriority(priority: number): PortfolioRadarSeverity {
  if (priority >= 950) return "critical";
  if (priority >= 800) return "high";
  if (priority >= 600) return "medium";
  return "low";
}

function buildDrinkNowAction(wine: PortfolioRadarCellarItem, readinessProfile: WineReadinessProfile): PortfolioRadarAction {
  const readiness = readinessProfile.legacyState;
  const name = displayName(wine);
  const bottleText = plural(Math.max(0, wine.quantity), "bottle");
  const fitClause = wine.brian_fit_score != null && wine.brian_fit_score >= 92
    ? ` Brian-Fit is ${wine.brian_fit_score}, but readiness is the reason this belongs in the queue.`
    : "";
  const atPeak = readinessProfile.phase === "at_peak";
  return action({
    type: "drink_now",
    priority: atPeak ? 820 : readiness === "drink_soon" ? 790 : 760,
    severity: atPeak ? "high" : "medium",
    verb: "Open",
    label: `Open ${name}`,
    reason: atPeak
      ? `At peak with ${bottleText} on hand; use it while maturity, not preference alone, says the bottle is at its best.${fitClause}`
      : `Inside its drinking window with ${bottleText} on hand; use it while readiness is actionable.${fitClause}`,
    confidence: atPeak ? 91 : 88,
    sourceSurface: "cellar_command_center",
    cta: {
      label: "Choose bottle",
      href: `/cellar/${wine.id}`,
      action: "open_cellar_item",
    },
    target: targetForCellar(wine, readinessMetadata(readinessProfile)),
  });
}

function buildAtRiskAction(
  wine: PortfolioRadarCellarItem,
  readinessProfile: WineReadinessProfile,
  approachingPeak: boolean
): PortfolioRadarAction {
  const readiness = readinessProfile.legacyState;
  const name = displayName(wine);
  const pastPeak = readiness === "past_peak";
  const priority = pastPeak ? 1000 : 880;
  return action({
    type: "at_risk_past_peak",
    priority,
    severity: severityForPriority(priority),
    verb: pastPeak ? "Decide" : "Prioritize",
    label: pastPeak ? `Decide on ${name}` : `Prioritize ${name}`,
    reason: pastPeak
      ? "Past its stated drinking window; open, gift, or correct the window before it becomes dead inventory."
      : "Near the end of its drinking window; prioritize before the cellar value turns into risk.",
    confidence: pastPeak ? 94 : 86,
    sourceSurface: "cellar_command_center",
    cta: {
      label: pastPeak ? "Review bottle" : "Plan opening",
      href: `/cellar/${wine.id}`,
      action: pastPeak ? "resolve_past_peak" : "prioritize_at_risk_bottle",
    },
    target: targetForCellar(wine, { ...readinessMetadata(readinessProfile), approachingPeak }),
  });
}

function buildMissingWindowAction(wine: PortfolioRadarCellarItem, readinessProfile: WineReadinessProfile): PortfolioRadarAction {
  const name = displayName(wine);
  return action({
    type: "missing_drink_window",
    priority: 650,
    severity: "medium",
    verb: "Set window",
    label: `Set drink window for ${name}`,
    reason: "No drink window is stored, so Portfolio Radar cannot safely classify readiness or at-risk status.",
    confidence: 82,
    sourceSurface: "cellar_command_center",
    cta: {
      label: "Set window",
      href: `/cellar/${wine.id}?focus=drink-window`,
      action: "set_drink_window",
    },
    target: targetForCellar(wine, readinessMetadata(readinessProfile)),
  });
}

function buildReviewPriceEvidenceAction(
  wine: PortfolioRadarCellarItem,
  evidence: PriceEvidenceSummary
): PortfolioRadarAction {
  const name = displayName(wine);
  return action({
    type: "review_price_evidence",
    priority: 940,
    severity: "high",
    verb: "Review",
    label: `Review price evidence for ${name}`,
    reason: `${plural(evidence.reviewCount, "price evidence item")} await review; accept, reject, or supersede before portfolio truth uses them.`,
    confidence: 90,
    sourceSurface: "portfolio_truth",
    cta: {
      label: "Review evidence",
      href: `/cellar/${wine.id}?focus=price-evidence`,
      action: "review_price_evidence",
    },
    target: targetForCellar(wine, {
      evidenceAwaitingReview: evidence.reviewCount,
      stalePriceEvidenceCount: evidence.staleCount,
      marketValueCents: evidence.marketValueCents,
      replacementPriceCents: evidence.replacementPriceCents,
      aiInferredObservedPriceCents: evidence.aiInferredObservedPriceCents,
    }),
  });
}

function buildRefreshValuationAction(
  wine: PortfolioRadarCellarItem,
  evidence: PriceEvidenceSummary,
  stale: boolean
): PortfolioRadarAction {
  const name = displayName(wine);
  const priority = stale ? 920 : 780;
  return action({
    type: "refresh_valuation",
    priority,
    severity: severityForPriority(priority),
    verb: "Refresh",
    label: `Refresh valuation for ${name}`,
    reason: stale
      ? "Trusted market or replacement evidence is stale; refresh before treating the displayed value as decision-grade."
      : "No trusted market value is available; refresh valuation before relying on portfolio truth.",
    confidence: stale ? 88 : 76,
    sourceSurface: "portfolio_truth",
    cta: {
      label: "Refresh valuation",
      href: `/cellar/${wine.id}?focus=valuation-refresh`,
      action: "refresh_valuation",
    },
    target: targetForCellar(wine, {
      evidenceAwaitingReview: evidence.reviewCount,
      stalePriceEvidenceCount: evidence.staleCount,
      marketValueCents: evidence.marketValueCents,
      replacementPriceCents: evidence.replacementPriceCents,
      trustedMarketObservationId: evidence.trustedMarketObservation?.id ?? null,
      trustedReplacementObservationId: evidence.trustedReplacementObservation?.id ?? null,
      aiInferredObservedPriceCents: evidence.aiInferredObservedPriceCents,
    }),
  });
}

function buildInvestigateMissingEvidenceAction(
  wine: PortfolioRadarCellarItem,
  evidence: PriceEvidenceSummary
): PortfolioRadarAction {
  const name = displayName(wine);
  const aiClause = evidence.aiInferredObservedPriceCents != null
    ? " AI-inferred estimate exists without trusted source-backed evidence; investigate missing evidence before treating it as value."
    : " Missing source-backed evidence prevents Portfolio Radar from trusting identity, value, or replacement context.";
  return action({
    type: "investigate_missing_evidence",
    priority: 610,
    severity: "medium",
    verb: "Investigate",
    label: `Investigate evidence for ${name}`,
    reason: aiClause.trim(),
    confidence: 70,
    sourceSurface: "portfolio_truth",
    cta: {
      label: "Investigate evidence",
      href: `/cellar/${wine.id}?focus=evidence`,
      action: "investigate_missing_evidence",
    },
    target: targetForCellar(wine, {
      evidenceAwaitingReview: evidence.reviewCount,
      stalePriceEvidenceCount: evidence.staleCount,
      marketValueCents: evidence.marketValueCents,
      replacementPriceCents: evidence.replacementPriceCents,
      aiInferredObservedPriceCents: evidence.aiInferredObservedPriceCents,
    }),
  });
}

function buildCellarReplenishAction(wine: PortfolioRadarCellarItem): PortfolioRadarAction {
  const name = displayName(wine);
  return action({
    type: "replenish",
    priority: 810,
    severity: "high",
    verb: "Replenish",
    label: `Replenish ${name}`,
    reason: "Low-stock alert threshold has been reached on an owned bottle.",
    confidence: 78,
    sourceSurface: "cellar_command_center",
    cta: {
      label: "Create acquisition target",
      href: `/cellar/${wine.id}?focus=replenish`,
      action: "create_replenishment_target",
    },
    target: targetForCellar(wine, {
      lowStockThreshold: wine.low_stock_threshold ?? null,
      desiredQuantity: Math.max(1, wine.low_stock_threshold ?? 2),
    }),
  });
}

function buildCellarCaptureMemoryAction(wine: PortfolioRadarCellarItem): PortfolioRadarAction {
  const name = displayName(wine);
  return action({
    type: "capture_tasting_memory",
    priority: 620,
    severity: "medium",
    verb: "Capture",
    label: `Capture tasting memory for ${name}`,
    reason: "This owned bottle has no first-party tasting memory, so Brian-Fit and future replacement confidence stay capped.",
    confidence: 72,
    sourceSurface: "tasting_memory",
    cta: {
      label: "Capture tasting",
      href: `/capture?inventoryId=${encodeURIComponent(wine.id)}&intent=tasting`,
      action: "capture_tasting_memory",
    },
    target: targetForCellar(wine, {
      ratingsCount: wine.ratings_count ?? 0,
      ratingSignalCount: wine.rating_signal_count ?? 0,
    }),
  });
}

function isLowStock(wine: PortfolioRadarCellarItem) {
  return wine.quantity > 0 &&
    Boolean(wine.low_stock_alert_enabled) &&
    wine.low_stock_threshold != null &&
    wine.quantity <= wine.low_stock_threshold;
}

function shouldRefreshMissingValuation(wine: PortfolioRadarCellarItem, evidence: PriceEvidenceSummary) {
  if (evidence.marketValueCents != null) return false;
  if (evidence.aiInferredObservedPriceCents != null && evidence.replacementPriceCents == null) return false;
  return wine.purchase_price_cents != null || evidence.replacementPriceCents != null || (wine.accepted_price_evidence_count ?? 0) === 0;
}

function shouldInvestigateMissingEvidence(wine: PortfolioRadarCellarItem, evidence: PriceEvidenceSummary) {
  if (evidence.marketValueCents != null || evidence.replacementPriceCents != null) return false;
  if (evidence.aiInferredObservedPriceCents != null) return true;
  return wine.purchase_price_cents == null && (wine.accepted_price_evidence_count ?? 0) === 0;
}

function buildCellarActions(
  input: PortfolioRadarInput,
  asOf: string,
  date: Date,
  tastingDraftInventoryIds: Set<string>
) {
  const observationsByInventory = groupPriceObservations(input.priceObservations ?? []);
  const actions: PortfolioRadarAction[] = [];

  for (const wine of (input.cellar ?? []).filter((candidate) => candidate.quantity > 0)) {
    const readinessBridge = buildReadinessInputWithDrinkWindowEvidence(wine, wine.drink_window_observations ?? [], { asOf });
    const readinessProfile = getWineReadinessProfile(readinessBridge.wine, { asOf: date });
    const readiness = readinessProfile.legacyState;
    const approachingPeak = isWineApproachingPeak(readinessBridge.wine, { asOf: date, withinDays: 180 });
    const evidence = priceEvidenceSummary(wine, observationsByInventory.get(wine.id) ?? [], asOf);

    if (readiness === "past_peak" || approachingPeak) {
      actions.push(buildAtRiskAction(wine, readinessProfile, approachingPeak));
    } else if (readiness === "ready" || readiness === "drink_soon") {
      actions.push(buildDrinkNowAction(wine, readinessProfile));
    }

    if (readinessProfile.phase === "missing_window") {
      actions.push(buildMissingWindowAction(wine, readinessProfile));
    }

    if (evidence.reviewCount > 0) {
      actions.push(buildReviewPriceEvidenceAction(wine, evidence));
    }
    if (evidence.staleCount > 0) {
      actions.push(buildRefreshValuationAction(wine, evidence, true));
    } else if (shouldRefreshMissingValuation(wine, evidence)) {
      actions.push(buildRefreshValuationAction(wine, evidence, false));
    } else if (shouldInvestigateMissingEvidence(wine, evidence)) {
      actions.push(buildInvestigateMissingEvidenceAction(wine, evidence));
    }

    if (isLowStock(wine)) {
      actions.push(buildCellarReplenishAction(wine));
    }

    if ((wine.ratings_count ?? 0) === 0 && !tastingDraftInventoryIds.has(wine.id)) {
      actions.push(buildCellarCaptureMemoryAction(wine));
    }
  }

  return actions;
}

function targetForReplenishment(prompt: ReplenishmentPrompt): PortfolioRadarTarget {
  const id = prompt.inventoryId ?? prompt.wineReferenceId ?? prompt.id;
  return {
    kind: "cellar_item",
    id,
    href: prompt.inventoryId ? `/cellar/${prompt.inventoryId}` : `/intelligence?focus=replenishment&prompt=${encodeURIComponent(prompt.id)}`,
    label: [prompt.vintage, prompt.wineTitle].filter(Boolean).join(" "),
    metadata: {
      promptId: prompt.id,
      inventoryId: prompt.inventoryId ?? null,
      wineReferenceId: prompt.wineReferenceId ?? null,
      urgency: prompt.urgency,
      quantityOnHand: prompt.quantityOnHand,
      lowStockThreshold: prompt.lowStockThreshold ?? null,
      desiredQuantity: prompt.desiredQuantity,
      score: prompt.score ?? null,
      targetPriceCents: prompt.targetPriceCents ?? null,
    },
  };
}

function buildReplenishmentAction(prompt: ReplenishmentPrompt): PortfolioRadarAction {
  const target = targetForReplenishment(prompt);
  const priority = prompt.urgency === "now" ? 830 : prompt.urgency === "soon" ? 760 : 600;
  return action({
    type: "replenish",
    priority,
    severity: severityForPriority(priority),
    verb: "Replenish",
    label: `Replenish ${target.label}`,
    reason: prompt.reasons.join(" ") || "Replenishment Automation found a restock pressure signal.",
    confidence: clampConfidence(76 + (prompt.score ?? 0) / 5),
    sourceSurface: "replenishment_automation",
    cta: {
      label: "Create acquisition target",
      href: `/intelligence?focus=replenishment&prompt=${encodeURIComponent(prompt.id)}`,
      action: "create_replenishment_target",
    },
    target,
  });
}

function buildReplenishmentActions(input: PortfolioRadarInput) {
  if (!input.replenishment) return [];
  const automation = buildReplenishmentAutomation(input.replenishment);
  const actionable = [
    ...automation.lanes.buyAgainNow,
    ...automation.lanes.refillPrompts,
    ...automation.lanes.watch,
  ];
  return actionable.map(buildReplenishmentAction);
}

function targetForAcquisition(item: AcquisitionCommandItem): PortfolioRadarTarget {
  return {
    kind: "acquisition_target",
    id: item.id,
    href: `/intelligence?focus=acquisition&target=${encodeURIComponent(item.id)}`,
    label: item.wineTitle,
    metadata: {
      decision: item.decision,
      priority: item.priority,
      sourceKind: item.sourceKind,
      quantity: item.quantity,
      projectedSpendCents: item.projectedSpendCents,
      targetPriceCents: item.targetPriceCents ?? null,
      maxPriceCents: item.maxPriceCents ?? null,
      observedPriceCents: item.bestObservation?.observedPriceCents ?? null,
      refreshDue: item.refreshDue,
      refreshReason: item.refreshReason,
      confidenceLabel: item.confidenceLabel,
      valueLabel: item.valueLabel,
    },
  };
}

function buildAcquisitionBuyAction(item: AcquisitionCommandItem): PortfolioRadarAction {
  const target = targetForAcquisition(item);
  return action({
    type: "acquisition_buy",
    priority: 860,
    severity: "high",
    verb: "Buy",
    label: `Buy ${item.wineTitle}`,
    reason: item.reasons.join(" "),
    confidence: clampConfidence(item.bestObservation?.confidence ?? 68),
    sourceSurface: "acquisition_engine",
    cta: {
      label: "Mark ordered",
      href: target.href,
      action: "mark_acquisition_ordered",
    },
    target,
  });
}

function buildAcquisitionWatchAction(item: AcquisitionCommandItem): PortfolioRadarAction {
  const target = targetForAcquisition(item);
  return action({
    type: "acquisition_watch",
    priority: item.refreshDue ? 540 : 500,
    severity: "low",
    verb: "Watch",
    label: `Watch ${item.wineTitle}`,
    reason: item.reasons.join(" "),
    confidence: clampConfidence(item.bestObservation?.confidence ?? 58),
    sourceSurface: "acquisition_engine",
    cta: {
      label: item.refreshDue ? "Refresh price" : "Review target",
      href: target.href,
      action: item.refreshDue ? "refresh_acquisition_price" : "review_acquisition_target",
    },
    target,
  });
}

function buildAcquisitionActions(input: PortfolioRadarInput, asOf: string) {
  if (!input.acquisition) return [];
  const engine = buildAcquisitionEngine({
    asOf,
    targets: input.acquisition.targets,
    priceObservations: input.acquisition.priceObservations ?? [],
  });
  return [
    ...engine.lanes.buyNow.map(buildAcquisitionBuyAction),
    ...engine.lanes.watch.map(buildAcquisitionWatchAction),
  ];
}

function receiptId(receipt: PortfolioRadarReceiptInput, index: number) {
  return receipt.id ?? `${receipt.vendor ?? "receipt"}:${receipt.purchaseDate ?? index}`;
}

function buildReceiptActions(input: PortfolioRadarInput, asOf: string) {
  return (input.receipts ?? []).flatMap((receiptInput, index) => {
    const deterministicReceiptInput = {
      ...receiptInput,
      purchaseDate: receiptInput.purchaseDate ?? asOf.slice(0, 10),
    };
    const receipt = buildAcquisitionReceipt(deterministicReceiptInput);
    if (receipt.summary.closeoutCount <= 0) return [];
    const id = receiptId(deterministicReceiptInput, index);
    const href = `/intelligence?focus=acquisition-receipt&receipt=${encodeURIComponent(id)}`;
    return [action({
      type: "close_receipt",
      priority: 890,
      severity: "high",
      verb: "Close receipt",
      label: `Close ${receipt.vendor ?? "receipt"}`,
      reason: `${plural(receipt.summary.closeoutCount, "acquisition target")} can be closed from this receipt; add selected bottles and update acquisition truth together.`,
      confidence: 90,
      sourceSurface: "acquisition_receipt",
      cta: {
        label: "Close receipt",
        href,
        action: "close_acquisition_receipt",
      },
      target: {
        kind: "receipt",
        id,
        href,
        label: `${receipt.vendor ?? "Receipt"} ${receipt.purchaseDate}`,
        metadata: {
          closeoutCount: receipt.summary.closeoutCount,
          cellarIntakeCount: receipt.summary.cellarIntakeCount,
          selectedItems: receipt.summary.selectedItems,
          totalBottles: receipt.summary.totalBottles,
          totalWineSpendCents: receipt.summary.totalWineSpendCents,
        },
      },
    })];
  });
}

function buildTastingMemoryActions(input: PortfolioRadarInput) {
  return (input.tastingMemoryDrafts ?? [])
    .filter((draft) => draft.status === "draft" || draft.status === "needs_review")
    .map((draft) => {
      const href = draft.inventoryId
        ? `/capture?inventoryId=${encodeURIComponent(draft.inventoryId)}&intent=tasting&draft=${encodeURIComponent(draft.id)}`
        : `/capture?intent=tasting&draft=${encodeURIComponent(draft.id)}`;
      return action({
        type: "capture_tasting_memory",
        priority: draft.status === "needs_review" ? 700 : 640,
        severity: "medium",
        verb: "Capture",
        label: `Capture tasting memory for ${draft.wineTitle}`,
        reason: draft.status === "needs_review"
          ? "A tasting memory draft needs review before it can teach Brian-Fit."
          : "A tasting memory draft exists but has not been committed to first-party taste history.",
        confidence: clampConfidence(draft.confidence ?? 70),
        sourceSurface: "tasting_memory",
        cta: {
          label: "Capture tasting",
          href,
          action: "capture_tasting_memory",
        },
        target: {
          kind: "tasting_memory",
          id: draft.id,
          href,
          label: draft.wineTitle,
          metadata: {
            inventoryId: draft.inventoryId ?? null,
            status: draft.status,
            capturedAt: draft.capturedAt ?? null,
            confidence: draft.confidence ?? null,
          },
        },
      });
    });
}

function compareActions(a: PortfolioRadarAction, b: PortfolioRadarAction) {
  return b.priority - a.priority ||
    b.confidence - a.confidence ||
    a.type.localeCompare(b.type) ||
    a.target.label.localeCompare(b.target.label) ||
    a.id.localeCompare(b.id);
}

function dedupeActions(actions: PortfolioRadarAction[]) {
  const byKey = new Map<string, PortfolioRadarAction>();
  for (const candidate of actions) {
    const key = `${candidate.type}:${candidate.target.kind}:${candidate.target.id}`;
    const current = byKey.get(key);
    if (!current || compareActions(candidate, current) < 0) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()];
}

function summarize(actions: PortfolioRadarAction[]): PortfolioRadarSummary {
  const byType = Object.fromEntries(ACTION_TYPES.map((type) => [type, 0])) as Record<PortfolioRadarActionType, number>;
  for (const item of actions) byType[item.type] += 1;
  return {
    totalActions: actions.length,
    criticalCount: actions.filter((item) => item.severity === "critical").length,
    highCount: actions.filter((item) => item.severity === "high").length,
    mediumCount: actions.filter((item) => item.severity === "medium").length,
    lowCount: actions.filter((item) => item.severity === "low").length,
    byType,
  };
}

export function buildPortfolioRadar(input: PortfolioRadarInput): PortfolioRadar {
  const asOf = asIso(input.asOf);
  const date = asDate(asOf);
  const tastingDraftInventoryIds = new Set(
    (input.tastingMemoryDrafts ?? [])
      .map((draft) => draft.inventoryId)
      .filter((id): id is string => Boolean(id))
  );

  const actions = dedupeActions([
    ...buildCellarActions(input, asOf, date, tastingDraftInventoryIds),
    ...buildReplenishmentActions(input),
    ...buildAcquisitionActions(input, asOf),
    ...buildReceiptActions(input, asOf),
    ...buildTastingMemoryActions(input),
  ]).sort(compareActions).slice(0, input.actionLimit ?? Number.POSITIVE_INFINITY);

  return {
    asOf,
    actions,
    summary: summarize(actions),
  };
}
