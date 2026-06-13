import { getWineReadiness, type WineReadinessState } from "./wine-readiness";

export type TonightContext = {
  meal?: string;
  occasion?: string;
  mood?: string;
  adventurous?: "safe" | "balanced" | "adventurous";
};

export type TonightWineType = "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | "unknown";

export type TonightEngineRating = {
  id: string;
  score: number;
  tasting_notes: string | null;
};

export type TonightEngineBottle = {
  id: string;
  name: string;
  producer?: string | null;
  region?: string | null;
  country?: string | null;
  wine_type: TonightWineType;
  vintage?: number | null;
  quantity: number;
  drink_after?: string | null;
  drink_before?: string | null;
  purchase_price_cents?: number | null;
  current_market_value_cents?: number | null;
  ratings: TonightEngineRating[];
  brian_fit_score?: number | null;
  brian_fit_reason?: string | null;
};

export type TonightScoreBreakdown = {
  readiness: number;
  meal_fit: number;
  occasion_fit: number;
  taste_fit: number;
  confidence: number;
  adventure_fit: number;
  cellar_practicality: number;
  value_fit: number;
};

export type TonightRecommendation = {
  id: string;
  inventory_id: string;
  name: string;
  producer: string;
  region: string;
  country: string;
  wine_type: TonightWineType;
  vintage_label: string;
  quantity: number;
  price_context: string;
  confidence: number;
  brian_fit_score?: number;
  brian_fit_reason?: string;
  reason: string;
  best_for: string;
  caution: string;
  recommendation_type: "best-now" | "alternate";
  score_breakdown: TonightScoreBreakdown;
};

export type RecommendationsResponse = {
  success: boolean;
  context: TonightContext;
  headline: string;
  summary: string;
  confidence_note: string;
  fallback_prompt: string | null;
  primary: TonightRecommendation | null;
  alternates: TonightRecommendation[];
  error?: string;
};

type ScoredBottle = TonightRecommendation & { sortScore: number; sparseSignals: number };

function averageRating(item: TonightEngineBottle): number | null {
  if (!item.ratings.length) return null;
  return item.ratings.reduce((sum, rating) => sum + rating.score, 0) / item.ratings.length;
}

function formatPriceContext(item: TonightEngineBottle): string {
  const cents = item.current_market_value_cents ?? item.purchase_price_cents;
  if (!cents) return "Value still unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function readinessPoints(state: WineReadinessState) {
  switch (state) {
    case "ready": return 16;
    case "drink_soon": return 14;
    case "hold": return -10;
    case "past_peak": return -6;
    case "unknown": return 0;
  }
}

function mealFitPoints(wineType: TonightWineType, meal: string) {
  if (!meal || meal === "anything") return { points: 2, reason: "No rigid meal constraint, so the pick can optimize for cellar fit." };
  if (/steak|beef|bbq|burger|lamb/.test(meal)) {
    return wineType === "red" || wineType === "fortified"
      ? { points: 16, reason: `The ${meal} context leans red, and this bottle fits that lane.` }
      : { points: -8, reason: `The ${meal} context may want more structure than this style naturally gives.` };
  }
  if (/seafood|fish|salad|sushi|chicken/.test(meal)) {
    return ["white", "rose", "sparkling"].includes(wineType)
      ? { points: 16, reason: `The ${meal} context leans lighter and this bottle fits that lane.` }
      : { points: -4, reason: `The ${meal} context is lighter, so this is a richer counterpoint rather than the obvious pairing.` };
  }
  if (/dessert|cake|chocolate/.test(meal)) {
    return wineType === "dessert" || wineType === "fortified"
      ? { points: 16, reason: "Dessert context makes this a natural fit." }
      : { points: -6, reason: "Dessert may call for a sweeter or fortified bottle." };
  }
  return { points: 3, reason: "The meal context is broad enough for a flexible cellar pick." };
}

function occasionPoints(item: TonightEngineBottle, occasion: string) {
  const value = item.current_market_value_cents ?? item.purchase_price_cents ?? 0;
  if (/celebration|date|dinner-party|anniversary|special/.test(occasion)) {
    return {
      points: value >= 7500 || item.quantity === 1 ? 10 : 5,
      reason: `The ${occasion || "occasion"} context supports choosing something with a little more presence.`,
    };
  }
  if (/weeknight|solo|casual/.test(occasion)) {
    return {
      points: value >= 12500 ? -2 : 6,
      reason: `The ${occasion || "occasion"} context points toward a low-friction bottle, not ceremony for its own sake.`,
    };
  }
  return { points: 3, reason: "The occasion is neutral, so cellar readiness carries more of the decision." };
}

function tastePoints(item: TonightEngineBottle) {
  const avg = averageRating(item);
  const fit = item.brian_fit_score;
  if (fit != null && avg != null) {
    return {
      points: Math.round((fit - 80) * 0.9 + (avg - 85) * 1.1),
      reason: `Brian-Fit is ${Math.round(fit)}/100 and your tasting memory averages ${Math.round(avg)}/100.`,
    };
  }
  if (fit != null) return { points: Math.round((fit - 80) * 0.9), reason: `Brian-Fit is ${Math.round(fit)}/100, but first-party tasting memory is still limited.` };
  if (avg != null) return { points: Math.round((avg - 85) * 1.1), reason: `Your tasting memory averages ${Math.round(avg)}/100.` };
  return { points: -2, reason: "This bottle would create a fresh taste memory rather than relying on one." };
}

function confidencePoints(item: TonightEngineBottle, readiness: WineReadinessState) {
  let points = 0;
  if (item.ratings.length) points += 10;
  if (item.brian_fit_score != null) points += 8;
  if (item.drink_after || item.drink_before) points += 5;
  if (item.current_market_value_cents != null || item.purchase_price_cents != null) points += 3;
  if (readiness === "hold" || readiness === "past_peak") points -= 4;
  return points;
}

function adventurePoints(item: TonightEngineBottle, adventurous: TonightContext["adventurous"]) {
  const hasMemory = item.ratings.length > 0 || item.brian_fit_score != null;
  if (adventurous === "safe") return hasMemory ? 8 : -8;
  if (adventurous === "adventurous") return hasMemory ? -1 : 10;
  return hasMemory ? 4 : 2;
}

function valuePoints(item: TonightEngineBottle, occasion: string) {
  const value = item.current_market_value_cents ?? item.purchase_price_cents ?? 0;
  if (!value) return 0;
  if (/celebration|date|dinner-party|anniversary|special/.test(occasion)) return value >= 7500 ? 5 : 1;
  if (/weeknight|solo|casual/.test(occasion)) return value >= 15000 ? -4 : 3;
  return value >= 10000 ? 2 : 1;
}

function cellarPracticalityPoints(item: TonightEngineBottle) {
  if (item.quantity > 3) return 4;
  if (item.quantity === 1) return 3;
  return 2;
}

function sparseSignalCount(item: TonightEngineBottle) {
  return [
    !item.producer,
    !item.region,
    !item.ratings.length,
    item.brian_fit_score == null,
    item.current_market_value_cents == null && item.purchase_price_cents == null,
    !item.drink_after && !item.drink_before,
  ].filter(Boolean).length;
}

function buildCaution(item: TonightEngineBottle, readiness: WineReadinessState) {
  if (readiness === "hold") return "Drink-window evidence says this may still reward patience.";
  if (readiness === "past_peak") return "Drink-window evidence says this may need triage rather than blind confidence.";
  if (!item.ratings.length) return "There is no first-party taste memory yet, so confidence stays deliberately modest.";
  if (item.current_market_value_cents == null && item.purchase_price_cents == null) return "Value is unknown, so this is a taste-led pick rather than a portfolio-led one.";
  if (item.vintage != null && (item.vintage < 1000 || item.vintage > new Date().getFullYear() + 1)) return "Vintage data looks malformed, so age-based confidence is reduced.";
  return "Low structural risk based on the current context.";
}

function scoreBottle(item: TonightEngineBottle, context: TonightContext, asOf: Date): ScoredBottle {
  const meal = normalizeText(context.meal || "anything");
  const occasion = normalizeText(context.occasion || "weeknight");
  const mood = normalizeText(context.mood || "cozy");
  const readiness = getWineReadiness({ drink_after: item.drink_after, drink_before: item.drink_before }, { asOf });
  const mealFit = mealFitPoints(item.wine_type, meal);
  const occasionFit = occasionPoints(item, occasion);
  const tasteFit = tastePoints(item);
  const breakdown: TonightScoreBreakdown = {
    readiness: readinessPoints(readiness),
    meal_fit: mealFit.points,
    occasion_fit: occasionFit.points,
    taste_fit: tasteFit.points,
    confidence: confidencePoints(item, readiness),
    adventure_fit: adventurePoints(item, context.adventurous ?? "balanced"),
    cellar_practicality: cellarPracticalityPoints(item),
    value_fit: valuePoints(item, occasion),
  };
  if (/cozy|comfort/.test(mood) && ["red", "dessert", "fortified"].includes(item.wine_type)) breakdown.meal_fit += 3;
  if (/bright|fresh/.test(mood) && ["white", "rose", "sparkling"].includes(item.wine_type)) breakdown.meal_fit += 3;

  const sortScore = 50 + Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const sparseSignals = sparseSignalCount(item);
  const confidence = Math.max(45, Math.min(96, Math.round(sortScore - sparseSignals * 4)));
  const bestFor = occasion
    ? `Best for a ${occasion.replace(/-/g, " ")} where ${meal === "anything" ? "the wine can lead the moment" : `${meal.replace(/-/g, " ")} is on the table`}.`
    : "Best for a confident tonight pick from your real cellar.";

  return {
    id: item.id,
    inventory_id: item.id,
    name: item.name || "Unknown bottle",
    producer: item.producer || "Unknown producer",
    region: item.region || "Region unknown",
    country: item.country || "Country unknown",
    wine_type: item.wine_type,
    vintage_label: item.vintage ? String(item.vintage) : "Vintage unknown",
    quantity: item.quantity,
    price_context: formatPriceContext(item),
    confidence,
    brian_fit_score: item.brian_fit_score ?? undefined,
    brian_fit_reason: item.brian_fit_reason ?? undefined,
    reason: `${mealFit.reason} ${tasteFit.reason}`,
    best_for: bestFor,
    caution: buildCaution(item, readiness),
    recommendation_type: "alternate",
    score_breakdown: breakdown,
    sortScore,
    sparseSignals,
  };
}

export function buildTonightRecommendations(
  bottles: TonightEngineBottle[],
  context: TonightContext,
  options: { asOf?: Date } = {}
): RecommendationsResponse {
  const asOf = options.asOf ?? new Date();
  if (bottles.length === 0) {
    return {
      success: true,
      context,
      headline: "Tonight Engine",
      summary: "Your active cellar is empty right now, so there is nothing to recommend for tonight yet.",
      confidence_note: "No inventory means no recommendation confidence yet.",
      fallback_prompt: "Add your first bottle or restore a consumed bottle to give Tonight Engine something real to choose from.",
      primary: null,
      alternates: [],
    };
  }

  const ranked = bottles
    .filter((item) => item.quantity > 0)
    .map((item) => scoreBottle(item, context, asOf))
    .sort((a, b) => b.sortScore - a.sortScore || b.confidence - a.confidence || a.name.localeCompare(b.name));
  const [first, ...rest] = ranked;
  const primary = first ? { ...first, recommendation_type: "best-now" as const } : null;
  const alternates = rest.slice(0, 2).map((item) => ({ ...item, recommendation_type: "alternate" as const }));
  const displayedPicks: ScoredBottle[] = [primary, ...alternates].filter((item): item is ScoredBottle => item !== null);
  const sparseCount = ranked.filter((item) => item.sparseSignals >= 3).length;
  const hasSparseDisplayedPick = displayedPicks.some((item) => item.sparseSignals >= 3);
  const sparseThreshold = Math.max(1, Math.ceil(ranked.length * 0.5));
  const headline = primary
    ? `Tonight, open ${primary.vintage_label !== "Vintage unknown" ? `${primary.vintage_label} ` : ""}${primary.name}.`
    : "Tonight Engine";
  const summary = primary
    ? "This recommendation is based on your real cellar, tonight’s context, readiness, memory, value, and Brian-Fit signals rather than a generic wine list."
    : "Tonight Engine could not find a strong primary bottle.";
  const confidence_note = sparseCount >= sparseThreshold || (context.adventurous === "adventurous" && hasSparseDisplayedPick)
    ? "Confidence is useful but sparse: a few more tasting notes, drink windows, or value signals would sharpen future picks."
    : "Confidence is supported by live cellar detail, readiness, and enough taste memory to make a grounded tonight decision.";
  const fallback_prompt = sparseCount >= sparseThreshold || (context.adventurous === "adventurous" && hasSparseDisplayedPick)
    ? "Best next upgrade: add one tasting note, one drink window, or one missing value signal to improve the next recommendation cycle."
    : null;

  return {
    success: true,
    context,
    headline,
    summary,
    confidence_note,
    fallback_prompt,
    primary,
    alternates,
  };
}
