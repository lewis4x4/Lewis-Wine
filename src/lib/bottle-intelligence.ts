import { summarizePricePosture, type ObservationKind, type PriceObservation, type SourceType, type TruthLabel } from "./current-intelligence/price-observations";
import type { ReviewStatus } from "./current-intelligence/types";
import { getWineReadiness, getWineWindowDisplay, type WineReadinessState } from "./wine-readiness";

export type BottleStructureProfileSource = "tasting_memory" | "reference_default" | "unknown";
export type BottleMemoryDensityState = "thin" | "emerging" | "trusted";
export type BottleBrainBottleRole = "safe_pick" | "interesting_pick" | "learning_pick" | "triage_now" | "hold_pick" | "value_pick";
export type BottleLocationStatus = "set" | "missing";
export type BottleValueStatus = "tracked" | "purchase_only" | "missing";
export type BottleNextSignalKind =
  | "capture_tasting_memory"
  | "set_location"
  | "confirm_drink_window"
  | "add_value_signal"
  | "open_or_review"
  | "confirm_structure";

export type BottleRatingInput = {
  score: number;
  tastingDate?: string | null;
  tastingNotes?: string | null;
  noseNotes?: string | null;
  palateNotes?: string | null;
  body?: string | null;
  tannins?: string | null;
  acidity?: string | null;
  sweetness?: string | null;
  finish?: string | null;
};

export type BottleBrianFitInput = {
  score: number;
  confidence: number;
  reason: string;
} | null;

export type BottleBenchmarkInput = {
  id: string;
  label: string;
  producer?: string | null;
  varietal?: string | null;
  region?: string | null;
  score: number;
};

export type BottlePriceEvidenceInput = {
  acceptedCount: number;
  staleCount: number;
  bestMarketValueCents?: number | null;
  bestReplacementPriceCents?: number | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  confidence?: number | null;
};

export type BottlePriceObservationRow = {
  id?: string | null;
  review_status?: string | null;
  truth_label?: string | null;
  observed_at?: string | null;
  observation_kind?: string | null;
  observed_price_cents?: number | null;
  source_type?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  confidence?: number | null;
};

export type BottleDossierAction = {
  id: "find-more" | "capture-tasting" | "add-location" | "set-readiness" | "add-price-evidence" | "view-intelligence";
  label: string;
  href: string;
  reason: string;
  primary?: boolean;
};

export type BottleIntelligenceInput = {
  id: string;
  name: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  country?: string | null;
  wineType?: string | null;
  grapeVarieties?: string[] | null;
  alcoholPercentage?: number | null;
  quantity: number;
  bottleSizeMl?: number | null;
  drinkAfter?: string | null;
  drinkBefore?: string | null;
  purchasePriceCents?: number | null;
  currentMarketValueCents?: number | null;
  marketValueSource?: string | null;
  simpleLocation?: string | null;
  structuredLocation?: string | null;
  brianFit?: BottleBrianFitInput;
  ratings?: BottleRatingInput[];
  criticScores?: unknown;
  isOpened?: boolean | null;
  benchmarkWines?: BottleBenchmarkInput[];
  priceEvidence?: BottlePriceEvidenceInput;
};

export type BottleStructureTrait = {
  key: "body" | "tannin" | "acidity" | "sweetness" | "abv" | "finish";
  label: string;
  value: string;
  source: BottleStructureProfileSource;
};

export type BottleNextSignal = {
  kind: BottleNextSignalKind;
  label: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type BottleCriticScore = {
  source: string;
  score: number;
  label: string;
};

export type BottleIntelligence = {
  identity: {
    title: string;
    subtitle: string;
    meta: string[];
    visualType: string;
  };
  structure: {
    profileSource: BottleStructureProfileSource;
    summary: string;
    traits: BottleStructureTrait[];
  };
  readiness: {
    state: WineReadinessState;
    label: string;
    windowLabel: string;
    confidence: "source-backed" | "partial" | "unknown";
    progress: number | null;
  };
  memoryDensity: {
    state: BottleMemoryDensityState;
    label: string;
    ratingCount: number;
    latestMemory: string | null;
    averageScore: number | null;
  };
  brianFit: BottleBrianFitInput;
  bottleBrainRole: {
    role: BottleBrainBottleRole;
    label: string;
    reason: string;
  };
  value: {
    status: BottleValueStatus;
    label: string;
    marketValueCents: number | null;
    purchasePriceCents: number | null;
    gainLossCents: number | null;
    sourceLabel: string | null;
  };
  location: {
    status: BottleLocationStatus;
    label: string;
  };
  criticScores: BottleCriticScore[];
  nextSignals: BottleNextSignal[];
  dossier: {
    headline: string;
    benchmark: {
      status: "matches_benchmark" | "self_benchmark" | "adjacent" | "no_signal";
      label: string;
      reason: string;
      score: number | null;
    };
    priceEvidence: {
      status: "source_backed" | "thin" | "missing" | "stale";
      label: string;
      bestAvailableCents: number | null;
      sourceLabel: string | null;
      sourceUrl: string | null;
      confidence: number | null;
    };
    drinkPlan: {
      primaryAction: string;
      timing: string;
      reason: string;
    };
    actions: BottleDossierAction[];
  };
};

const REFERENCE_PROFILES: Record<string, Partial<Record<BottleStructureTrait["key"], string>>> = {
  cabernet: { body: "Full", tannin: "High", acidity: "Medium+", sweetness: "Dry", finish: "Long" },
  bordeaux: { body: "Full", tannin: "High", acidity: "Medium+", sweetness: "Dry", finish: "Long" },
  pinot: { body: "Medium", tannin: "Low", acidity: "Medium+", sweetness: "Dry", finish: "Medium+" },
  chardonnay: { body: "Medium+", tannin: "Very low", acidity: "Medium", sweetness: "Dry", finish: "Medium" },
  sauvignon: { body: "Light", tannin: "Very low", acidity: "High", sweetness: "Dry", finish: "Medium" },
  riesling: { body: "Light", tannin: "Very low", acidity: "High", sweetness: "Off dry", finish: "Long" },
  syrah: { body: "Full", tannin: "Medium+", acidity: "Medium", sweetness: "Dry", finish: "Long" },
  merlot: { body: "Medium+", tannin: "Medium", acidity: "Medium", sweetness: "Dry", finish: "Medium+" },
};

const TRAIT_LABELS: Record<BottleStructureTrait["key"], string> = {
  body: "Body",
  tannin: "Tannin",
  acidity: "Acidity",
  sweetness: "Sweetness",
  abv: "ABV",
  finish: "Finish",
};

function humanize(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/plus/gi, "+")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeSourceName(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function latestRating(ratings: BottleRatingInput[]) {
  return [...ratings].sort((a, b) => {
    const bTime = b.tastingDate ? new Date(b.tastingDate).getTime() : 0;
    const aTime = a.tastingDate ? new Date(a.tastingDate).getTime() : 0;
    return bTime - aTime;
  })[0] ?? null;
}

function referenceProfileFor(input: BottleIntelligenceInput) {
  const text = [input.wineType, ...(input.grapeVarieties ?? []), input.name].join(" ").toLowerCase();
  const key = Object.keys(REFERENCE_PROFILES).find((candidate) => text.includes(candidate));
  return key ? REFERENCE_PROFILES[key] : null;
}

function buildStructure(input: BottleIntelligenceInput, ratings: BottleRatingInput[]) {
  const latest = latestRating(ratings);
  const tastingTraits: Partial<Record<BottleStructureTrait["key"], string | null | undefined>> = latest
    ? {
        body: latest.body,
        tannin: latest.tannins,
        acidity: latest.acidity,
        sweetness: latest.sweetness,
        finish: latest.finish,
      }
    : {};
  const hasTastingTraits = Object.values(tastingTraits).some(Boolean);
  const referenceTraits = referenceProfileFor(input);
  const profileSource: BottleStructureProfileSource = hasTastingTraits ? "tasting_memory" : referenceTraits ? "reference_default" : "unknown";
  const sourceTraits = hasTastingTraits ? tastingTraits : referenceTraits ?? {};

  const keys: BottleStructureTrait["key"][] = ["body", "tannin", "acidity", "sweetness", "abv", "finish"];
  const traits = keys.flatMap((key) => {
    const rawValue = key === "abv" ? (input.alcoholPercentage != null ? `${input.alcoholPercentage}%` : null) : sourceTraits[key];
    const value = key === "abv" ? rawValue : humanize(rawValue ?? null);
    if (!value) return [];
    return [{ key, label: TRAIT_LABELS[key], value, source: key === "abv" ? (input.alcoholPercentage != null ? "tasting_memory" : profileSource) : profileSource }];
  });

  return {
    profileSource,
    summary: profileSource === "tasting_memory"
      ? "Structure is grounded in Brian's captured tasting memory."
      : profileSource === "reference_default"
        ? "Structure is reference-derived until a tasting confirms it."
        : "Structure is unknown until this bottle gets reference data or a tasting note.",
    traits,
  };
}

function readinessLabel(state: WineReadinessState) {
  switch (state) {
    case "hold": return "Hold";
    case "ready": return "Ready now";
    case "drink_soon": return "Drink soon";
    case "past_peak": return "Past peak";
    case "unknown": return "Window unknown";
  }
}

function memoryState(ratingCount: number): BottleMemoryDensityState {
  if (ratingCount >= 3) return "trusted";
  if (ratingCount >= 1) return "emerging";
  return "thin";
}

function valueSourceLabel(source: string | null | undefined) {
  if (!source) return null;
  if (source === "wine_searcher") return "Wine-Searcher";
  return normalizeSourceName(source);
}

function parseCriticScores(criticScores: unknown): BottleCriticScore[] {
  if (!criticScores || typeof criticScores !== "object" || Array.isArray(criticScores)) return [];
  return Object.entries(criticScores as Record<string, unknown>)
    .flatMap(([source, raw]) => {
      const score = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseFloat(raw) : Number.NaN;
      if (!Number.isFinite(score)) return [];
      const sourceLabel = normalizeSourceName(source);
      return [{ source: sourceLabel, score, label: `${sourceLabel} ${score}` }];
    })
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source));
}

function chooseRole(input: BottleIntelligenceInput, readiness: WineReadinessState, memory: BottleMemoryDensityState): BottleIntelligence["bottleBrainRole"] {
  if (readiness === "past_peak") {
    return { role: "triage_now", label: "Triage now", reason: "The drink window suggests this bottle needs review before it quietly becomes a missed opportunity." };
  }
  if (readiness === "hold") {
    return { role: "hold_pick", label: "Hold pick", reason: "The readiness window says patience is more valuable than opening it now." };
  }
  if (memory === "thin") {
    return { role: "learning_pick", label: "Learning pick", reason: "This bottle can teach Pourfolio more once Brian captures a first tasting memory." };
  }
  if ((input.brianFit?.score ?? 0) >= 90 && (readiness === "ready" || readiness === "drink_soon")) {
    return { role: "safe_pick", label: "Safe pick", reason: "It combines readiness, Brian-Fit, and tasting memory strongly enough to serve with confidence." };
  }
  if (input.currentMarketValueCents != null && input.currentMarketValueCents >= 10000) {
    return { role: "value_pick", label: "Value pick", reason: "This bottle has enough value signal to deserve intentional timing." };
  }
  return { role: "interesting_pick", label: "Interesting pick", reason: "It has enough context to consider, but the choice should stay tied to the occasion." };
}

function buildNextSignals(input: BottleIntelligenceInput, readiness: WineReadinessState, memory: BottleMemoryDensityState, hasLocation: boolean, hasValue: boolean, structureSource: BottleStructureProfileSource): BottleNextSignal[] {
  const signals: BottleNextSignal[] = [];
  if (readiness === "past_peak") {
    signals.push({ kind: "open_or_review", label: "Open or review", reason: "The window has passed; either open it soon or correct the drink window.", priority: "high" });
  }
  if (memory === "thin") {
    signals.push({ kind: "capture_tasting_memory", label: "Capture first tasting memory", reason: "Brian-Fit cannot become trustworthy without a real tasting signal.", priority: "high" });
  }
  if (!hasLocation) {
    signals.push({ kind: "set_location", label: "Set storage location", reason: "A world-class cellar record should say exactly where the bottle lives.", priority: "medium" });
  }
  if (readiness === "unknown") {
    signals.push({ kind: "confirm_drink_window", label: "Confirm drink window", reason: "Bottle Brain should not guess opening timing without at least partial window evidence.", priority: "high" });
  } else if (readiness === "ready" || readiness === "drink_soon") {
    signals.push({ kind: "confirm_drink_window", label: "Confirm readiness after next tasting", reason: "A current tasting can validate whether the drink window is accurate.", priority: "low" });
  }
  if (!hasValue) {
    signals.push({ kind: "add_value_signal", label: "Add value signal", reason: "Purchase or market value makes portfolio decisions more honest.", priority: input.purchasePriceCents != null ? "medium" : "low" });
  }
  if (structureSource === "reference_default") {
    signals.push({ kind: "confirm_structure", label: "Confirm structure", reason: "Reference structure should be replaced by Brian's actual palate notes when available.", priority: "low" });
  }
  return signals;
}

function textIncludes(haystack: string | null | undefined, needle: string | null | undefined) {
  return !!haystack && !!needle && haystack.toLowerCase().includes(needle.toLowerCase());
}

function chooseBenchmark(input: BottleIntelligenceInput, averageScore: number | null) {
  const benchmarks = input.benchmarkWines ?? [];
  const exact = benchmarks.find((benchmark) =>
    textIncludes(input.producer, benchmark.producer) ||
    textIncludes(input.grapeVarieties?.join(" "), benchmark.varietal) ||
    textIncludes(input.region, benchmark.region)
  );
  if (exact) {
    return {
      status: "matches_benchmark" as const,
      label: exact.label,
      reason: `Tracks against Brian's ${exact.score}-point ${exact.label} benchmark${exact.producer ? ` in the ${exact.producer} lane` : ""}.`,
      score: exact.score,
    };
  }
  if ((averageScore ?? 0) >= 94) {
    return {
      status: "self_benchmark" as const,
      label: "Self benchmark",
      reason: "Brian scored this bottle 94+, so it becomes a reference point for future decisions.",
      score: averageScore,
    };
  }
  if (benchmarks.length) {
    const adjacent = [...benchmarks].sort((a, b) => b.score - a.score)[0];
    return {
      status: "adjacent" as const,
      label: adjacent.label,
      reason: `Closest available reference is ${adjacent.label}; use it as context, not certainty.`,
      score: adjacent.score,
    };
  }
  return {
    status: "no_signal" as const,
    label: "No benchmark yet",
    reason: "No benchmark bottle is close enough yet; capture tasting memory before claiming a lane.",
    score: null,
  };
}

const VALID_SOURCE_TYPES = new Set<SourceType>(["manual", "cellartracker", "wine_market_journal", "provider", "wine_searcher_trial", "auction", "retailer", "winery", "public_web", "ai_search", "ai_inferred", "unknown"]);
const VALID_OBSERVATION_KINDS = new Set<ObservationKind>(["purchase_price", "market_value", "replacement_price", "auction_comp", "estimate"]);
const VALID_TRUTH_LABELS = new Set<TruthLabel>(["verified", "estimated", "ai_inferred", "unknown", "stale", "rejected"]);
const VALID_REVIEW_STATUSES = new Set<ReviewStatus>(["draft", "accepted", "rejected", "superseded"]);

function normalizeObservationRow(row: BottlePriceObservationRow): PriceObservation {
  return {
    id: row.id ?? `dossier:${row.source_name ?? "source"}:${row.observed_at ?? "unknown"}`,
    inventoryId: "dossier",
    wineReferenceId: null,
    sourceType: VALID_SOURCE_TYPES.has(row.source_type as SourceType) ? row.source_type as SourceType : "unknown",
    sourceName: row.source_name ?? null,
    sourceUrl: row.source_url ?? null,
    observationKind: VALID_OBSERVATION_KINDS.has(row.observation_kind as ObservationKind) ? row.observation_kind as ObservationKind : "estimate",
    truthLabel: VALID_TRUTH_LABELS.has(row.truth_label as TruthLabel) ? row.truth_label as TruthLabel : "unknown",
    reviewStatus: VALID_REVIEW_STATUSES.has(row.review_status as ReviewStatus) ? row.review_status as ReviewStatus : "draft",
    observedPriceCents: row.observed_price_cents ?? null,
    currency: "USD",
    bottleSizeMl: null,
    vintage: null,
    confidence: row.confidence ?? 0,
    observedAt: row.observed_at ?? new Date(0).toISOString(),
    notes: null,
    rawPayload: null,
  };
}

export function buildBottlePriceEvidenceFromObservations(rows: BottlePriceObservationRow[], asOf = new Date().toISOString()): BottlePriceEvidenceInput | undefined {
  const observations = rows.map(normalizeObservationRow);
  const posture = summarizePricePosture(observations, asOf);
  if (posture.acceptedCount === 0) return undefined;
  const preferred = posture.replacement.observation ?? posture.market.observation;
  return {
    acceptedCount: posture.acceptedCount,
    staleCount: posture.staleCount,
    bestMarketValueCents: posture.market.valueCents,
    bestReplacementPriceCents: posture.replacement.valueCents,
    sourceLabel: preferred?.sourceName ?? null,
    sourceUrl: preferred?.sourceUrl ?? null,
    confidence: preferred?.confidence ?? null,
  };
}

function buildPriceEvidence(input: BottleIntelligenceInput) {
  const evidence = input.priceEvidence;
  const bestAvailableCents = evidence?.bestReplacementPriceCents ?? evidence?.bestMarketValueCents ?? input.currentMarketValueCents ?? input.purchasePriceCents ?? null;
  if (!evidence && bestAvailableCents == null) {
    return {
      status: "missing" as const,
      label: "No source-backed price evidence",
      bestAvailableCents: null,
      sourceLabel: null,
      sourceUrl: null,
      confidence: null,
    };
  }
  if (evidence && evidence.acceptedCount > 0) {
    return {
      status: evidence.staleCount >= evidence.acceptedCount ? "stale" as const : "source_backed" as const,
      label: `${evidence.acceptedCount} accepted source${evidence.acceptedCount === 1 ? "" : "s"}`,
      bestAvailableCents,
      sourceLabel: evidence.sourceLabel ?? valueSourceLabel(input.marketValueSource) ?? "Accepted evidence",
      sourceUrl: evidence.sourceUrl ?? null,
      confidence: evidence.confidence ?? null,
    };
  }
  return {
    status: "thin" as const,
    label: input.currentMarketValueCents != null ? "Cellar value tracked, source evidence thin" : "Purchase value only",
    bestAvailableCents,
    sourceLabel: valueSourceLabel(input.marketValueSource),
    sourceUrl: null,
    confidence: null,
  };
}

function buildDrinkPlan(readiness: WineReadinessState, benchmark: ReturnType<typeof chooseBenchmark>, brianFit: BottleBrianFitInput) {
  if (readiness === "hold") {
    return { primaryAction: "Do not open yet", timing: "Hold", reason: "The readiness window says patience beats preference right now." };
  }
  if (readiness === "past_peak") {
    return { primaryAction: "Open or audit now", timing: "Triage", reason: "The bottle may be past peak; decide now rather than letting it disappear in the rack." };
  }
  if (readiness === "ready" || readiness === "drink_soon") {
    if (benchmark.status === "matches_benchmark" || benchmark.status === "self_benchmark") {
      return { primaryAction: "Open with intent", timing: readiness === "drink_soon" ? "Soon" : "Ready now", reason: "Readiness and benchmark context are aligned; make it an intentional pour, not a random opening." };
    }
    if ((brianFit?.score ?? 0) >= 90) {
      return { primaryAction: "Strong candidate", timing: readiness === "drink_soon" ? "Soon" : "Ready now", reason: "Readiness and Brian-Fit are strong enough to consider for the right meal or occasion." };
    }
    return { primaryAction: "Consider with context", timing: readiness === "drink_soon" ? "Soon" : "Ready now", reason: "The wine is ready, but the palate evidence should drive the final call." };
  }
  return { primaryAction: "Confirm window", timing: "Unknown", reason: "Readiness is unknown; add a drink window before turning this into a confident recommendation." };
}

function dossierHeadline(readiness: WineReadinessState, memory: BottleMemoryDensityState, benchmark: ReturnType<typeof chooseBenchmark>) {
  if (readiness === "hold") return "Hold intentionally";
  if (readiness === "past_peak") return "Triage now";
  if (readiness === "ready" || readiness === "drink_soon") {
    if (benchmark.status === "matches_benchmark" || benchmark.status === "self_benchmark") return "Pour with confidence";
    return "Ready with context";
  }
  if (memory === "thin") return "Build the dossier";
  return "Dossier needs a window";
}

function buildDossierActions(input: BottleIntelligenceInput, memory: BottleMemoryDensityState, hasLocation: boolean, hasValue: boolean, readiness: WineReadinessState, benchmark: ReturnType<typeof chooseBenchmark>): BottleDossierAction[] {
  const actions: BottleDossierAction[] = [];
  if (benchmark.status === "matches_benchmark" || benchmark.status === "self_benchmark" || (input.brianFit?.score ?? 0) >= 90) {
    actions.push({ id: "find-more", label: "Find more like this", href: `/intelligence?inventory_id=${encodeURIComponent(input.id)}&action=find-more`, reason: "High-fit or benchmark-linked bottles should feed Buy Again intelligence.", primary: true });
  }
  if (memory === "thin") {
    actions.push({ id: "capture-tasting", label: "Capture first tasting", href: `/capture?inventory_id=${encodeURIComponent(input.id)}`, reason: "Turn cellar inventory into memory before making a recommendation." });
  } else {
    actions.push({ id: "capture-tasting", label: "Add tasting memory", href: `/capture?inventory_id=${encodeURIComponent(input.id)}`, reason: "Refresh Brian's actual palate signal." });
  }
  if (!hasLocation) actions.push({ id: "add-location", label: "Set location", href: `#location`, reason: "Findability matters at the moment of use." });
  if (!hasValue) actions.push({ id: "add-price-evidence", label: "Add price evidence", href: `#current-intelligence`, reason: "Price evidence makes buy-again and portfolio decisions honest." });
  if (readiness === "unknown") actions.push({ id: "set-readiness", label: "Set drink window", href: `#readiness`, reason: "Unknown readiness blocks confident recommendations." });
  actions.push({ id: "view-intelligence", label: "Open intelligence workbench", href: `/intelligence?inventory_id=${encodeURIComponent(input.id)}`, reason: "Use the active intelligence layer for deeper comparisons and list decisions." });
  return actions;
}

export function buildBottleIntelligence(input: BottleIntelligenceInput, options: { asOf?: Date } = {}): BottleIntelligence {
  const ratings = input.ratings ?? [];
  const latest = latestRating(ratings);
  const averageScore = ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length) : null;
  const readinessState = getWineReadiness({ drink_after: input.drinkAfter, drink_before: input.drinkBefore }, { asOf: options.asOf });
  const windowDisplay = getWineWindowDisplay({ drink_after: input.drinkAfter, drink_before: input.drinkBefore }, { asOf: options.asOf });
  const memoryDensityState = memoryState(ratings.length);
  const locationLabel = input.structuredLocation || input.simpleLocation || null;
  const hasLocation = !!locationLabel;
  const hasValue = input.currentMarketValueCents != null || input.purchasePriceCents != null;
  const gainLossCents = input.purchasePriceCents != null && input.currentMarketValueCents != null
    ? input.currentMarketValueCents - input.purchasePriceCents
    : null;
  const structure = buildStructure(input, ratings);
  const subtitleParts = [input.producer, [input.region, input.country].filter(Boolean).join(", ")].filter(Boolean);
  const meta = [
    input.wineType ? humanize(input.wineType) : null,
    input.grapeVarieties?.length ? input.grapeVarieties.join(", ") : null,
    input.bottleSizeMl ? `${input.bottleSizeMl}ml` : null,
    input.quantity != null ? `${input.quantity} bottle${input.quantity === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];
  const role = chooseRole(input, readinessState, memoryDensityState);
  const nextSignals = buildNextSignals(input, readinessState, memoryDensityState, hasLocation, hasValue, structure.profileSource);
  const benchmark = chooseBenchmark(input, averageScore);
  const priceEvidence = buildPriceEvidence(input);
  const drinkPlan = buildDrinkPlan(readinessState, benchmark, input.brianFit ?? null);
  const actions = buildDossierActions(input, memoryDensityState, hasLocation, hasValue, readinessState, benchmark);

  return {
    identity: {
      title: `${input.vintage ? `${input.vintage} ` : ""}${input.name}`,
      subtitle: subtitleParts.join(" • ") || "Cellar bottle",
      meta,
      visualType: input.wineType ?? "unknown",
    },
    structure,
    readiness: {
      state: readinessState,
      label: readinessLabel(readinessState),
      windowLabel: windowDisplay?.label ?? "No drink window",
      confidence: input.drinkAfter && input.drinkBefore ? "source-backed" : input.drinkAfter || input.drinkBefore ? "partial" : "unknown",
      progress: windowDisplay?.progress ?? null,
    },
    memoryDensity: {
      state: memoryDensityState,
      label: memoryDensityState === "trusted" ? "Trusted memory" : memoryDensityState === "emerging" ? "Emerging memory" : "Thin memory",
      ratingCount: ratings.length,
      latestMemory: latest?.tastingNotes || latest?.palateNotes || latest?.noseNotes || null,
      averageScore,
    },
    brianFit: input.brianFit ?? null,
    bottleBrainRole: role,
    value: {
      status: input.currentMarketValueCents != null ? "tracked" : input.purchasePriceCents != null ? "purchase_only" : "missing",
      label: input.currentMarketValueCents != null ? "Market value tracked" : input.purchasePriceCents != null ? "Purchase price only" : "Value unknown",
      marketValueCents: input.currentMarketValueCents ?? null,
      purchasePriceCents: input.purchasePriceCents ?? null,
      gainLossCents,
      sourceLabel: valueSourceLabel(input.marketValueSource),
    },
    location: {
      status: hasLocation ? "set" : "missing",
      label: locationLabel ?? "Location missing",
    },
    criticScores: parseCriticScores(input.criticScores),
    nextSignals,
    dossier: {
      headline: dossierHeadline(readinessState, memoryDensityState, benchmark),
      benchmark,
      priceEvidence,
      drinkPlan,
      actions,
    },
  };
}
