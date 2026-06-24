export type WineType = "red" | "white" | "rose" | "rosé" | "sparkling" | "dessert" | "fortified";
export type BuyAgain = "yes" | "no" | "maybe" | "cellar_only";
export type AdvisorTier = "pour" | "consider" | "skip";
export type Availability = "in_stock" | "limited" | "unknown" | "oos";
export type ConfidenceLabel = "High" | "Medium" | "Low";

export type CaptureExtraction = {
  producer: string | null;
  label: string | null;
  vintage: number | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  varietal: string | null;
  wineType: Exclude<WineType, "rosé"> | null;
  confidence: Record<string, number>;
  ambiguousFields: string[];
  raw: Record<string, unknown>;
};

export type FollowUpQuestion = {
  field: "producer" | "vintage";
  question: string;
};

export type BenchmarkInput = {
  id: string;
  producer?: string | null;
  label?: string | null;
  score: number;
  region?: string | null;
  varietal?: string | null;
  descriptors?: string[] | null;
};

export type BenchmarkComparison = {
  id: string;
  displayName: string;
  score: number;
  scoreDelta: number;
  sharedDescriptors: string[];
  sharedVarietal: boolean;
  sharedRegion: boolean;
  similarity: number;
};

export type PriceObservationDraft = {
  sourceName: string;
  sourceUrl?: string | null;
  price: number;
  currency: string;
  availability: Availability;
  confidence: number;
  raw?: Record<string, unknown>;
};

export type TastingProfileInput = {
  id: string;
  wineId: string;
  producer?: string | null;
  region?: string | null;
  varietal?: string | null;
  score: number | null;
  descriptors?: string[] | null;
  buyAgain?: BuyAgain | null;
};

export type TasteProfile = {
  lovedDescriptors: string[];
  preferredRegions: string[];
  preferredVarietals: string[];
  preferredProducers: string[];
  priceBand: { low: number | null; typical: number | null; high: number | null };
  avoidList: string[];
  benchmarkWineIds: string[];
  refreshedAt: string;
};

export type AdvisorLineItem = {
  producer?: string | null;
  label: string;
  vintage?: number | null;
  varietal?: string | null;
  region?: string | null;
  price?: number | null;
  descriptors?: string[] | null;
  readiness?: "drink_now" | "hold" | "unknown";
  valueFlag?: "great" | "fair" | "overpriced";
};

export type BrianFitResult = {
  score: number;
  tier: AdvisorTier;
  reasons: string[];
  readiness: "drink_now" | "hold" | "unknown";
  valueFlag: "great" | "fair" | "overpriced";
  cuisineFit: number;
  breakdown: { descriptors: number; identity: number; producer: number; value: number };
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value > 1) return Math.max(0, Math.min(1, value / 100));
  return Math.max(0, Math.min(1, value));
}

function normalizeWineType(value: unknown): CaptureExtraction["wineType"] {
  const text = cleanText(value)?.toLowerCase();
  if (!text) return null;
  if (text === "rosé") return "rose";
  if (["red", "white", "rose", "sparkling", "dessert", "fortified"].includes(text)) return text as CaptureExtraction["wineType"];
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter((item): item is string => Boolean(item));
}

function normalizedSet(values?: string[] | null): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

export function normalizeCaptureExtraction(raw: Record<string, unknown>): CaptureExtraction {
  const rawConfidence = typeof raw.confidence === "object" && raw.confidence !== null ? raw.confidence as Record<string, unknown> : {};
  const vintageRaw = raw.vintage;
  const vintage = typeof vintageRaw === "number" ? vintageRaw : typeof vintageRaw === "string" && /^\d{4}$/.test(vintageRaw.trim()) ? Number(vintageRaw.trim()) : null;
  return {
    producer: cleanText(raw.producer),
    label: cleanText(raw.label) ?? cleanText(raw.cuvee) ?? cleanText(raw.name),
    vintage,
    region: cleanText(raw.region),
    subregion: cleanText(raw.subregion),
    country: cleanText(raw.country),
    varietal: cleanText(raw.varietal),
    wineType: normalizeWineType(raw.wine_type ?? raw.wineType),
    confidence: Object.fromEntries(Object.entries(rawConfidence).map(([key, value]) => [key, normalizeConfidence(value)])),
    ambiguousFields: asStringArray(raw.ambiguous_fields ?? raw.ambiguousFields),
    raw,
  };
}

export function chooseCaptureFollowUp(extraction: CaptureExtraction): FollowUpQuestion | null {
  const producerConfidence = extraction.confidence.producer ?? (extraction.producer ? 0.75 : 0);
  const vintageConfidence = extraction.confidence.vintage ?? (extraction.vintage ? 0.75 : 0);
  const missingProducer = !extraction.producer || producerConfidence < 0.6;
  const missingVintage = !extraction.vintage || vintageConfidence < 0.6;
  if (!missingProducer && !missingVintage) return null;
  if (missingProducer && (!missingVintage || producerConfidence <= vintageConfidence)) {
    return { field: "producer", question: "Who is the producer on this bottle?" };
  }
  return { field: "vintage", question: "What vintage year is this bottle?" };
}

export function compareBenchmarkTasting(current: { score: number; region?: string | null; varietal?: string | null; descriptors?: string[] | null }, benchmarks: BenchmarkInput[]): BenchmarkComparison[] {
  const currentDescriptors = normalizedSet(current.descriptors);
  return benchmarks
    .map((benchmark) => {
      const benchmarkDescriptors = normalizedSet(benchmark.descriptors);
      const sharedDescriptors = [...currentDescriptors].filter((descriptor) => benchmarkDescriptors.has(descriptor));
      const sharedVarietal = Boolean(current.varietal && benchmark.varietal && current.varietal.toLowerCase() === benchmark.varietal.toLowerCase());
      const sharedRegion = Boolean(current.region && benchmark.region && current.region.toLowerCase() === benchmark.region.toLowerCase());
      const similarity = sharedDescriptors.length * 10 + (sharedVarietal ? 25 : 0) + (sharedRegion ? 20 : 0) + Math.max(0, 20 - Math.abs(current.score - benchmark.score) * 4);
      return {
        id: benchmark.id,
        displayName: [benchmark.producer, benchmark.label].filter(Boolean).join(" ") || benchmark.id,
        score: benchmark.score,
        scoreDelta: current.score - benchmark.score,
        sharedDescriptors,
        sharedVarietal,
        sharedRegion,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity || b.score - a.score);
}

export function filterSourcedObservations(drafts: PriceObservationDraft[]): PriceObservationDraft[] {
  return drafts
    .filter((draft) => Boolean(draft.sourceUrl?.trim()) && typeof draft.confidence === "number" && draft.confidence >= 0 && draft.confidence <= 1)
    .map((draft) => ({ ...draft, currency: draft.currency || "USD", availability: draft.availability || "unknown" }));
}

export function pickBestObservation(observations: PriceObservationDraft[]): PriceObservationDraft | null {
  const available = observations.filter((row) => row.availability === "in_stock" || row.availability === "limited");
  const pool = available.length ? available : observations;
  return [...pool].sort((a, b) => a.price - b.price || b.confidence - a.confidence)[0] ?? null;
}

export function confidenceLabel(confidence: number): ConfidenceLabel {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

function topWeighted(values: Array<{ value?: string | null; weight: number }>, limit: number): string[] {
  const scores = new Map<string, { label: string; score: number }>();
  for (const item of values) {
    const value = cleanText(item.value);
    if (!value) continue;
    const key = value.toLowerCase();
    const current = scores.get(key) ?? { label: value, score: 0 };
    current.score += item.weight;
    scores.set(key, current);
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit).map((item) => item.label);
}

function percentile(sorted: number[], position: number): number | null {
  if (!sorted.length) return null;
  if (position === 0.5 && sorted.length % 2 === 0) {
    const upper = sorted.length / 2;
    return Math.round((sorted[upper - 1] + sorted[upper]) / 2);
  }
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * position)));
  return Math.round(sorted[index]);
}

export function computeTasteProfile(tastings: TastingProfileInput[], prices: Array<{ wineId: string; price: number }> = [], refreshedAt = new Date().toISOString()): TasteProfile {
  const loved = tastings.filter((tasting) => (tasting.score ?? 0) >= 90);
  const benchmarks = tastings.filter((tasting) => (tasting.score ?? 0) >= 94);
  const descriptorValues = loved.flatMap((tasting) => (tasting.descriptors ?? []).map((descriptor) => ({ value: descriptor, weight: (tasting.score ?? 0) - 89 })));
  const avoidList = tastings
    .filter((tasting) => tasting.buyAgain === "no" || (tasting.score ?? 100) < 82)
    .map((tasting) => [tasting.producer, tasting.varietal].filter(Boolean).join(" ").trim())
    .filter(Boolean);
  const sortedPrices = prices.map((price) => price.price).filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  return {
    lovedDescriptors: topWeighted(descriptorValues, 12),
    preferredRegions: topWeighted(loved.map((tasting) => ({ value: tasting.region, weight: tasting.score ?? 0 })), 8),
    preferredVarietals: topWeighted(loved.map((tasting) => ({ value: tasting.varietal, weight: tasting.score ?? 0 })), 8),
    preferredProducers: topWeighted(benchmarks.map((tasting) => ({ value: tasting.producer, weight: tasting.score ?? 0 })), 10),
    priceBand: { low: percentile(sortedPrices, 0.25), typical: percentile(sortedPrices, 0.5), high: percentile(sortedPrices, 0.85) },
    avoidList: [...new Set(avoidList)],
    benchmarkWineIds: benchmarks.map((tasting) => tasting.wineId),
    refreshedAt,
  };
}

function containsIgnoreCase(values: string[], candidate?: string | null): boolean {
  if (!candidate) return false;
  const normalized = candidate.toLowerCase();
  return values.some((value) => normalized.includes(value.toLowerCase()) || value.toLowerCase().includes(normalized));
}

export function brianFitScore(item: AdvisorLineItem, profile: TasteProfile, cuisine?: string | null): BrianFitResult {
  const display = [item.producer, item.label].filter(Boolean).join(" ").trim();
  const avoidHit = profile.avoidList.some((avoid) => display.toLowerCase().includes(avoid.toLowerCase()) || avoid.toLowerCase().includes(display.toLowerCase()));
  const reasons: string[] = [];
  const descriptors = normalizedSet(item.descriptors);
  const loved = normalizedSet(profile.lovedDescriptors);
  const descriptorMatches = [...descriptors].filter((descriptor) => loved.has(descriptor));
  const descriptorScore = Math.min(40, descriptorMatches.length * 20);
  if (descriptorMatches.length) reasons.push(`Matches Brian's loved descriptors: ${descriptorMatches.join(", ")}.`);

  const regionMatch = containsIgnoreCase(profile.preferredRegions, item.region);
  const varietalMatch = containsIgnoreCase(profile.preferredVarietals, item.varietal);
  const identityScore = (regionMatch ? 12 : 0) + (varietalMatch ? 13 : 0);
  if (regionMatch && item.region) reasons.push(`${item.region} is already a strong Brian region.`);
  if (varietalMatch && item.varietal) reasons.push(`${item.varietal} maps to prior high scores.`);

  const producerScore = containsIgnoreCase(profile.preferredProducers, item.producer) ? 20 : 0;
  if (producerScore && item.producer) reasons.push(`${item.producer} is tied to benchmark bottles.`);

  const typical = profile.priceBand.typical;
  const high = profile.priceBand.high;
  const price = item.price ?? null;
  let valueScore = 5;
  let valueFlag: BrianFitResult["valueFlag"] = item.valueFlag ?? "fair";
  if (price && typical && high) {
    if (price <= typical * 1.1) {
      valueScore = 15;
      valueFlag = "great";
      reasons.push(`Price sits in Brian's proven comfort band around $${typical}.`);
    } else if (price > high * 1.25) {
      valueScore = 2;
      valueFlag = "overpriced";
      reasons.push(`Price is above Brian's usual high-confidence band near $${high}.`);
    } else {
      valueScore = 9;
      valueFlag = "fair";
    }
  }
  let score = Math.round(descriptorScore + identityScore + producerScore + valueScore);
  if (avoidHit) {
    score = Math.min(score, 15);
    reasons.unshift("Skip: this matches Brian's avoid list from prior low-score or no-buy-again bottles.");
  }
  if (!reasons.length) reasons.push("Limited personal signal; treat as exploratory rather than a confident Brian pick.");
  const readiness = item.readiness ?? "unknown";
  if (readiness === "hold") reasons.push("Readiness says hold; choose only if buying for the cellar, not drinking tonight.");
  const tier: AdvisorTier = avoidHit ? "skip" : score >= 72 ? "pour" : score >= 45 ? "consider" : "skip";
  const cuisineFit = cuisine ? Math.min(100, Math.max(45, score + (/(steak|grill|beef|lamb|barbecue)/i.test(cuisine) && /cabernet|red|malbec|syrah/i.test(item.varietal ?? item.label) ? 10 : 0))) : Math.min(100, score);
  return { score, tier, reasons, readiness, valueFlag, cuisineFit, breakdown: { descriptors: descriptorScore, identity: identityScore, producer: producerScore, value: valueScore } };
}
