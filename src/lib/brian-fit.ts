import type { BrianTasteProfile, RatingSignal } from "@/types/database";

export type PalateVector = {
  smoothness?: number | null;
  boldness?: number | null;
  earthiness?: number | null;
  spiciness?: number | null;
  fruit_forward?: number | null;
  dryness?: number | null;
  tannin_strength?: number | null;
  acidity_level?: number | null;
  finish_length?: number | null;
  richness?: number | null;
};

export type BrianFitSummary = {
  score: number;
  confidence: number;
  reason: string;
  profileSummary: string | null;
};

const DIMENSIONS: (keyof PalateVector)[] = [
  "smoothness",
  "boldness",
  "earthiness",
  "spiciness",
  "fruit_forward",
  "dryness",
  "tannin_strength",
  "acidity_level",
  "finish_length",
  "richness",
];

export function inferSignalFromNotes(notes: string | null | undefined): PalateVector {
  const text = (notes || "").toLowerCase();
  return {
    smoothness: text.includes("smooth") ? 5 : undefined,
    boldness: text.includes("bold") ? 4 : text.includes("easy") || text.includes("casual") ? 2 : undefined,
    earthiness: text.includes("earth") ? 4 : undefined,
    spiciness: text.includes("spicy") || text.includes("pepper") ? 4 : undefined,
    fruit_forward: text.includes("fruit") || text.includes("jammy") ? 4 : undefined,
    dryness: text.includes("dry") ? 4 : undefined,
    tannin_strength: text.includes("tannin") || text.includes("structured") ? 4 : undefined,
    acidity_level: text.includes("bright") || text.includes("acid") ? 4 : undefined,
    finish_length: text.includes("long finish") ? 4 : undefined,
    richness: text.includes("rich") || text.includes("full") ? 4 : undefined,
  };
}

export function deriveBrianFit(params: {
  profile: BrianTasteProfile | null;
  ratingSignal?: RatingSignal | null;
  tastingNotes?: string | null;
  score?: number | null;
}): BrianFitSummary {
  const { profile, ratingSignal, tastingNotes, score } = params;
  const inferred = inferSignalFromNotes(tastingNotes);
  const candidate: PalateVector = {
    ...inferred,
    smoothness: ratingSignal?.smoothness ?? inferred.smoothness,
    boldness: ratingSignal?.boldness ?? inferred.boldness,
    earthiness: ratingSignal?.earthiness ?? inferred.earthiness,
    spiciness: ratingSignal?.spiciness ?? inferred.spiciness,
    fruit_forward: ratingSignal?.fruit_forward ?? inferred.fruit_forward,
    dryness: ratingSignal?.dryness ?? inferred.dryness,
    tannin_strength: ratingSignal?.tannin_strength ?? inferred.tannin_strength,
    acidity_level: ratingSignal?.acidity_level ?? inferred.acidity_level,
    finish_length: ratingSignal?.finish_length ?? inferred.finish_length,
    richness: ratingSignal?.richness ?? inferred.richness,
  };

  let matched = 0;
  let totalDistance = 0;
  for (const dimension of DIMENSIONS) {
    const preferred = profile?.[`preferred_${dimension}` as keyof BrianTasteProfile] as number | null | undefined;
    const observed = candidate[dimension];
    if (preferred != null && observed != null) {
      matched += 1;
      totalDistance += Math.abs(preferred - observed);
    }
  }

  const baseline = score ?? 88;
  const closenessBoost = matched > 0 ? Math.round((1 - totalDistance / (matched * 4)) * 8) : 0;
  const profileConfidence = profile?.confidence_score ?? 0;
  const fitScore = Math.max(75, Math.min(99, baseline + closenessBoost));
  const confidence = Math.max(55, Math.min(97, 55 + matched * 4 + Math.round(profileConfidence / 5)));

  const reasons: string[] = [];
  if (candidate.smoothness && (profile?.preferred_smoothness ?? 0) >= 4 && candidate.smoothness >= 4) {
    reasons.push("it stays in your smooth, polished lane");
  }
  if ((profile?.preferred_boldness ?? 0) >= 4 && (candidate.boldness ?? 0) < 3) {
    reasons.push("it may land a little softer than your favorite bold bottles");
  }
  if ((profile?.preferred_earthiness ?? 0) >= 4 && (candidate.earthiness ?? 0) < 3) {
    reasons.push("it does not fully hit your earthy sweet spot");
  }
  if ((profile?.preferred_spiciness ?? 0) >= 4 && (candidate.spiciness ?? 0) < 3) {
    reasons.push("the spice profile looks lighter than your top-tier preference");
  }
  if (reasons.length === 0) {
    reasons.push(
      matched > 0
        ? "it aligns reasonably well with your current taste profile"
        : "this is a provisional read until you capture tasting signal for this bottle"
    );
  }

  return {
    score: fitScore,
    confidence,
    reason: reasons.join(", "),
    profileSummary: profile?.profile_summary ?? null,
  };
}
