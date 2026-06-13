export type TasteGenomeRatingSignal = {
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
  buy_again?: boolean | null;
  value_feel?: "poor" | "fair" | "good" | "strong" | "excellent" | null;
};

export type TasteGenomeRating = {
  id: string;
  score: number;
  wine_type?: string | null;
  region?: string | null;
  producer?: string | null;
  vintage?: number | null;
  purchase_price_cents?: number | null;
  rating_signal?: TasteGenomeRatingSignal | null;
};

export type TasteGenomeConfidence = "empty" | "thin" | "developing" | "proven";

export type TasteGenomeAffinity = {
  name: string;
  averageRating: number;
  count: number;
  lift: number;
  confidence: Exclude<TasteGenomeConfidence, "empty">;
};

export type TasteGenomeStructurePoint = {
  dimension: keyof Omit<TasteGenomeRatingSignal, "buy_again" | "value_feel">;
  label: string;
  average: number;
  signalCount: number;
  confidence: Exclude<TasteGenomeConfidence, "empty">;
};

export type TasteGenomeBottlePattern = {
  id: string;
  label: string;
  score: number;
  priceCents: number | null;
  valueIndex: number;
};

export type TasteGenome = {
  sampleSize: number;
  averageRating: number | null;
  headline: string;
  confidence: {
    level: TasteGenomeConfidence;
    explanation: string;
  };
  affinities: {
    regions: TasteGenomeAffinity[];
    types: TasteGenomeAffinity[];
    producers: TasteGenomeAffinity[];
  };
  structureProfile: TasteGenomeStructurePoint[];
  valuePattern: {
    bestValue: TasteGenomeBottlePattern | null;
    underperformers: TasteGenomeBottlePattern[];
    summary: string;
  };
  insights: string[];
};

const STRUCTURE_DIMENSIONS: TasteGenomeStructurePoint["dimension"][] = [
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

const STRUCTURE_LABELS: Record<TasteGenomeStructurePoint["dimension"], string> = {
  smoothness: "Smoothness",
  boldness: "Boldness",
  earthiness: "Earthiness",
  spiciness: "Spice",
  fruit_forward: "Fruit",
  dryness: "Dryness",
  tannin_strength: "Tannin",
  acidity_level: "Acidity",
  finish_length: "Finish",
  richness: "Richness",
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function confidenceForCount(count: number): Exclude<TasteGenomeConfidence, "empty"> {
  if (count >= 3) return "proven";
  if (count >= 2) return "developing";
  return "thin";
}

function confidenceForSample(sampleSize: number): TasteGenomeConfidence {
  if (sampleSize === 0) return "empty";
  if (sampleSize < 4) return "thin";
  if (sampleSize < 10) return "developing";
  return "proven";
}

function groupAffinity(
  ratings: TasteGenomeRating[],
  getName: (rating: TasteGenomeRating) => string | null | undefined,
  baseline: number
): TasteGenomeAffinity[] {
  const groups = new Map<string, number[]>();
  for (const rating of ratings) {
    const name = getName(rating)?.trim();
    if (!name) continue;
    groups.set(name, [...(groups.get(name) ?? []), rating.score]);
  }

  return [...groups.entries()]
    .map(([name, scores]) => {
      const averageRating = round1(average(scores));
      return {
        name,
        averageRating,
        count: scores.length,
        lift: round1(averageRating - baseline),
        confidence: confidenceForCount(scores.length),
      };
    })
    .sort((a, b) => {
      const confidenceWeight = { proven: 3, developing: 2, thin: 1 } as const;
      return confidenceWeight[b.confidence] - confidenceWeight[a.confidence] || b.averageRating - a.averageRating || b.count - a.count || a.name.localeCompare(b.name);
    });
}

function buildStructureProfile(ratings: TasteGenomeRating[]): TasteGenomeStructurePoint[] {
  return STRUCTURE_DIMENSIONS.map((dimension) => {
    const values = ratings
      .map((rating) => rating.rating_signal?.[dimension])
      .filter((value): value is number => typeof value === "number");

    if (!values.length) return null;

    return {
      dimension,
      label: STRUCTURE_LABELS[dimension],
      average: round1(average(values)),
      signalCount: values.length,
      confidence: confidenceForCount(values.length),
    };
  })
    .filter((point): point is TasteGenomeStructurePoint => Boolean(point))
    .sort((a, b) => b.average - a.average || b.signalCount - a.signalCount || STRUCTURE_DIMENSIONS.indexOf(a.dimension) - STRUCTURE_DIMENSIONS.indexOf(b.dimension));
}

function labelFor(rating: TasteGenomeRating) {
  return [rating.vintage, rating.producer, rating.region || rating.wine_type]
    .filter(Boolean)
    .join(" ") || rating.id;
}

function toBottlePattern(rating: TasteGenomeRating): TasteGenomeBottlePattern | null {
  if (!rating.purchase_price_cents || rating.purchase_price_cents <= 0) return null;
  const priceDollars = rating.purchase_price_cents / 100;
  const valueIndex = round1((rating.score - 80) / Math.max(priceDollars / 50, 0.5));
  return {
    id: rating.id,
    label: labelFor(rating),
    score: rating.score,
    priceCents: rating.purchase_price_cents,
    valueIndex,
  };
}

function buildValuePattern(ratings: TasteGenomeRating[]) {
  const priced = ratings
    .map(toBottlePattern)
    .filter((pattern): pattern is TasteGenomeBottlePattern => Boolean(pattern));
  const bestValue = [...priced]
    .filter((pattern) => pattern.score >= 90)
    .sort((a, b) => b.valueIndex - a.valueIndex || b.score - a.score)[0] ?? null;
  const underperformers = [...priced]
    .filter((pattern) => pattern.score < 88 && (pattern.priceCents ?? 0) >= 10000)
    .sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0) || a.score - b.score)
    .slice(0, 3);

  return {
    bestValue,
    underperformers,
    summary: bestValue
      ? `${bestValue.label} is the strongest value signal so far: ${bestValue.score} points against a relatively efficient price.`
      : "Value pattern is still thin; add purchase prices and ratings to identify overperformers honestly.",
  };
}

function buildHeadline(genome: Pick<TasteGenome, "sampleSize" | "affinities" | "structureProfile">) {
  if (genome.sampleSize === 0) return "Taste Genome needs ratings before it can make a serious claim.";
  const region = genome.affinities.regions[0];
  const structure = genome.structureProfile[0];
  if (region && structure) return `${region.name} and ${structure.label.toLowerCase()} are the clearest taste signals so far.`;
  if (region) return `${region.name} is the clearest regional taste signal so far.`;
  if (structure) return `${structure.label} is the clearest structural taste signal so far.`;
  return "Taste Genome is forming, but the current signal is still too sparse for a sharp claim.";
}

function buildInsights(genome: Pick<TasteGenome, "affinities" | "structureProfile" | "valuePattern" | "confidence">) {
  const insights: string[] = [];
  const topRegion = genome.affinities.regions[0];
  const topType = genome.affinities.types[0];
  const topStructure = genome.structureProfile[0];

  if (topStructure) {
    insights.push(`${topStructure.label} is the most visible structural preference (${topStructure.average.toFixed(1)}/5 across ${topStructure.signalCount} signal${topStructure.signalCount === 1 ? "" : "s"}).`);
  }
  if (topRegion) {
    insights.push(`${topRegion.name} is leading with a ${topRegion.averageRating.toFixed(1)} average across ${topRegion.count} rating${topRegion.count === 1 ? "" : "s"} (${topRegion.confidence} signal).`);
  }
  if (topType) {
    insights.push(`${topType.name} is the strongest style lane so far, sitting ${topType.lift >= 0 ? "+" : ""}${topType.lift.toFixed(1)} points versus your baseline.`);
  }
  if (genome.valuePattern.bestValue) {
    insights.push(genome.valuePattern.summary);
  }
  if (genome.confidence.level === "thin") {
    insights.push("Confidence is thin: treat this as a directional read until more rated bottles and rating signals exist.");
  }

  return insights;
}

export function buildTasteGenome(ratings: TasteGenomeRating[]): TasteGenome {
  const sampleSize = ratings.length;
  const averageRating = sampleSize ? round1(average(ratings.map((rating) => rating.score))) : null;
  const confidenceLevel = confidenceForSample(sampleSize);
  const confidence = {
    level: confidenceLevel,
    explanation: sampleSize === 0
      ? "No ratings are available yet."
      : `${sampleSize} ratings available; ${confidenceLevel === "proven" ? "enough for durable patterns" : confidenceLevel === "developing" ? "enough for directional patterns, not final claims" : "too few for hard claims"}.`,
  };

  const baseline = averageRating ?? 0;
  const affinities = {
    regions: groupAffinity(ratings, (rating) => rating.region, baseline),
    types: groupAffinity(ratings, (rating) => rating.wine_type, baseline),
    producers: groupAffinity(ratings, (rating) => rating.producer, baseline),
  };
  const structureProfile = buildStructureProfile(ratings);
  const valuePattern = buildValuePattern(ratings);
  const headline = buildHeadline({ sampleSize, affinities, structureProfile });
  const insights = buildInsights({ affinities, structureProfile, valuePattern, confidence });

  return {
    sampleSize,
    averageRating,
    headline,
    confidence,
    affinities,
    structureProfile,
    valuePattern,
    insights,
  };
}
