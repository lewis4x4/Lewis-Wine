import type { TasteGenome, TasteGenomeAffinity, TasteGenomeStructurePoint } from "./taste-genome";
import type { TasteProfile } from "./pourfolio-intelligence";

export type TasteGenomeDashboardInput = {
  firstParty?: TasteGenome | null;
  activeProfile?: TasteProfile | null;
  brianFitProfile?: {
    favoriteDescriptors?: string[] | null;
    avoidDescriptors?: string[] | null;
    confidenceScore?: number | null;
    summary?: string | null;
    updatedAt?: string | null;
  } | null;
};

export type TasteGenomeSignal = {
  label: string;
  value?: string;
  support?: string;
  confidence?: string;
};

export type TasteGenomeDashboardLane = {
  name: string;
  scoreLabel: string;
  support: string;
  confidence: string;
};

export type TasteGenomeDashboard = {
  headline: string;
  profileSummary: string;
  confidence: { label: "empty" | "thin" | "developing" | "proven"; score: number; explanation: string };
  metrics: Array<{ label: string; value: string; detail: string }>;
  lanes: {
    producers: TasteGenomeDashboardLane[];
    varietals: TasteGenomeDashboardLane[];
    regions: TasteGenomeDashboardLane[];
  };
  lovedDescriptors: TasteGenomeSignal[];
  avoidSignals: TasteGenomeSignal[];
  structureFingerprint: TasteGenomeSignal[];
  priceBand: { lowLabel: string; typicalLabel: string; highLabel: string };
  benchmarkSummary: string;
  nextActions: string[];
};

function money(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function unique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const label = value?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function laneFromAffinity(affinity: TasteGenomeAffinity): TasteGenomeDashboardLane {
  return {
    name: affinity.name,
    scoreLabel: `${affinity.averageRating.toFixed(1)} avg`,
    support: `${affinity.count} rating${affinity.count === 1 ? "" : "s"} · ${affinity.lift >= 0 ? "+" : ""}${affinity.lift.toFixed(1)} vs baseline`,
    confidence: affinity.confidence,
  };
}

function laneFromProfile(name: string): TasteGenomeDashboardLane {
  return {
    name,
    scoreLabel: "profile signal",
    support: "Latest active taste profile",
    confidence: "developing",
  };
}

function structureSignal(point: TasteGenomeStructurePoint): TasteGenomeSignal {
  return {
    label: point.label,
    value: `${point.average.toFixed(1)}/5`,
    support: `${point.signalCount} signal${point.signalCount === 1 ? "" : "s"}`,
    confidence: point.confidence,
  };
}

function metric(label: string, value: string | number, detail: string) {
  return { label, value: String(value), detail };
}

function benchmarkSummary(count: number) {
  if (count === 0) return "No benchmark bottles yet";
  if (count === 1) return "1 benchmark bottle anchoring the profile";
  return `${count} benchmark bottles anchoring the profile`;
}

function confidenceScore(input: TasteGenomeDashboardInput, level: TasteGenomeDashboard["confidence"]["label"]) {
  const explicit = input.brianFitProfile?.confidenceScore;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(0, Math.min(100, Math.round(explicit)));
  const defaults = { empty: 0, thin: 25, developing: 60, proven: 85 } as const;
  return defaults[level];
}

export function buildTasteGenomeDashboard(input: TasteGenomeDashboardInput): TasteGenomeDashboard {
  const firstParty = input.firstParty ?? null;
  const activeProfile = input.activeProfile ?? null;
  const level = firstParty?.confidence.level ?? (activeProfile ? "developing" : "empty");
  const benchmarkCount = activeProfile?.benchmarkWineIds.length ?? 0;
  const lovedDescriptors = unique([...(activeProfile?.lovedDescriptors ?? []), ...(input.brianFitProfile?.favoriteDescriptors ?? [])]);
  const avoidSignals = unique([...(activeProfile?.avoidList ?? []), ...(input.brianFitProfile?.avoidDescriptors ?? [])]);
  const headline = firstParty?.headline
    ?? input.brianFitProfile?.summary
    ?? "Taste Genome needs ratings before it can make a serious claim.";

  const producers = firstParty?.affinities.producers.length
    ? firstParty.affinities.producers.slice(0, 5).map(laneFromAffinity)
    : (activeProfile?.preferredProducers ?? []).slice(0, 5).map(laneFromProfile);
  const varietals = firstParty?.affinities.types.length
    ? firstParty.affinities.types.slice(0, 5).map(laneFromAffinity)
    : (activeProfile?.preferredVarietals ?? []).slice(0, 5).map(laneFromProfile);
  const regions = firstParty?.affinities.regions.length
    ? firstParty.affinities.regions.slice(0, 5).map(laneFromAffinity)
    : (activeProfile?.preferredRegions ?? []).slice(0, 5).map(laneFromProfile);

  const nextActions: string[] = [];
  if (!firstParty || firstParty.sampleSize === 0) nextActions.push("Rate three bottles to give the genome a first-party baseline.");
  if (!activeProfile) nextActions.push("Capture or refresh a taste profile from benchmark tastings.");
  if ((activeProfile?.benchmarkWineIds.length ?? 0) < 3) nextActions.push("Capture more 94+ benchmark bottles to strengthen the reference set.");
  if (!lovedDescriptors.length) nextActions.push("Capture tasting descriptors so recommendations can explain why a bottle fits.");
  if (!nextActions.length) nextActions.push("Use the genome to drive Buy Again and Restaurant Mode decisions.");

  return {
    headline,
    profileSummary: input.brianFitProfile?.summary ?? firstParty?.insights[0] ?? "The palate model is still forming from first-party ratings and benchmark captures.",
    confidence: {
      label: level,
      score: confidenceScore(input, level),
      explanation: firstParty?.confidence.explanation ?? (activeProfile ? "Active taste profile exists; first-party rating depth determines final confidence." : "No active taste profile is available yet."),
    },
    metrics: [
      metric("Rated bottles", firstParty?.sampleSize ?? 0, firstParty?.averageRating != null ? `${firstParty.averageRating.toFixed(1)} avg score` : "No rating baseline yet"),
      metric("Benchmarks", benchmarkCount, benchmarkSummary(benchmarkCount)),
      metric("Loved descriptors", lovedDescriptors.length, lovedDescriptors.length ? lovedDescriptors.slice(0, 3).join(", ") : "Awaiting descriptors"),
      metric("Avoid signals", avoidSignals.length, avoidSignals.length ? avoidSignals.slice(0, 3).join(", ") : "No strong avoid pattern"),
    ],
    lanes: { producers, varietals, regions },
    lovedDescriptors: lovedDescriptors.slice(0, 12).map((label) => ({ label })),
    avoidSignals: avoidSignals.slice(0, 8).map((label) => ({ label })),
    structureFingerprint: (firstParty?.structureProfile ?? []).slice(0, 8).map(structureSignal),
    priceBand: {
      lowLabel: money(activeProfile?.priceBand.low),
      typicalLabel: money(activeProfile?.priceBand.typical),
      highLabel: money(activeProfile?.priceBand.high),
    },
    benchmarkSummary: benchmarkSummary(benchmarkCount),
    nextActions,
  };
}
