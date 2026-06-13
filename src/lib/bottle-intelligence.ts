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
  };
}
