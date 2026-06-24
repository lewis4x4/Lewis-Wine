export type WineType = "red" | "white" | "rose" | "rosé" | "sparkling" | "dessert" | "fortified" | null;
export type BuyAgain = "yes" | "no" | "maybe" | "cellar_only";

export type CaptureWineCandidate = {
  producer: string | null;
  label: string | null;
  vintage: number | null;
  region: string | null;
  subregion?: string | null;
  country: string | null;
  varietal: string | null;
  wine_type: WineType;
  confidence?: Record<string, number> | null;
  ambiguous_fields?: string[] | null;
};

export type CaptureWineRequest = {
  image_base64: string;
  media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

export type ReviewInputs = {
  score: number | null;
  buy_again: BuyAgain;
  occasion: string;
  descriptors: string;
  notes: string;
};

export type ReviewDraft = CaptureWineCandidate & {
  title: string;
  score: number | null;
  buy_again: BuyAgain;
  occasion: string;
  descriptors: string[];
  notes: string;
  is_benchmark: boolean;
  benchmark_prompt: string | null;
  confidence_label: "High confidence" | "Medium confidence" | "Low confidence";
};

export type SaveTastingPayload = {
  wine: {
    producer: string | null;
    label: string | null;
    vintage: number | null;
    region: string | null;
    subregion: string | null;
    country: string | null;
    varietal: string | null;
    wine_type: WineType;
  };
  tasting: {
    score: number | null;
    buy_again: BuyAgain;
    occasion: string | null;
    descriptors: string[];
    notes: string | null;
    is_benchmark: boolean;
    extraction: {
      source: "field-capture";
      candidate: CaptureWineCandidate;
    };
  };
};

export type PostSaveAction = {
  id: "find-more" | "buy-again" | "view-bottle" | "capture-another";
  label: string;
  description: string;
  href: string;
  primary?: boolean;
};

const allowedMediaTypes = new Set<CaptureWineRequest["media_type"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function compact(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildCaptureWineRequest(dataUrl: string): CaptureWineRequest {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Provide a valid image data URL.");
  const mediaType = match[1] as CaptureWineRequest["media_type"];
  if (!allowedMediaTypes.has(mediaType)) throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  return { media_type: mediaType, image_base64: match[2] };
}

export function normalizeDescriptorText(text: string): string[] {
  const seen = new Set<string>();
  const descriptors: string[] = [];
  for (const raw of text.split(/[;,\n]/)) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    descriptors.push(value);
  }
  return descriptors;
}

export function isBenchmarkScore(score: number | null | undefined) {
  return typeof score === "number" && Number.isFinite(score) && score >= 94;
}

function confidenceAverage(candidate: CaptureWineCandidate) {
  const values = Object.values(candidate.confidence ?? {}).filter((value) => Number.isFinite(value));
  if (!values.length) return 0.5;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidenceLabel(candidate: CaptureWineCandidate): ReviewDraft["confidence_label"] {
  const average = confidenceAverage(candidate);
  if (average >= 0.82) return "High confidence";
  if (average >= 0.62) return "Medium confidence";
  return "Low confidence";
}

function buildTitle(candidate: CaptureWineCandidate) {
  return [candidate.vintage, candidate.producer, candidate.label ?? candidate.varietal]
    .filter(Boolean)
    .join(" ") || "Captured wine";
}

function benchmarkPrompt(candidate: CaptureWineCandidate, inputs: ReviewInputs) {
  if (!isBenchmarkScore(inputs.score)) return null;
  const anchor = [candidate.producer, candidate.varietal].filter(Boolean).join(" / ") || "this wine";
  const why = compact(inputs.occasion) ?? compact(inputs.notes) ?? "why this bottle mattered";
  return `Benchmark bottle: preserve ${why} as a reference point for future ${anchor} decisions.`;
}

export function buildReviewDraft(candidate: CaptureWineCandidate, inputs: ReviewInputs): ReviewDraft {
  return {
    ...candidate,
    title: buildTitle(candidate),
    score: inputs.score,
    buy_again: inputs.buy_again,
    occasion: inputs.occasion.trim(),
    descriptors: normalizeDescriptorText(inputs.descriptors),
    notes: inputs.notes.trim(),
    is_benchmark: isBenchmarkScore(inputs.score),
    benchmark_prompt: benchmarkPrompt(candidate, inputs),
    confidence_label: confidenceLabel(candidate),
  };
}

export function buildSaveTastingPayload(draft: ReviewDraft): SaveTastingPayload {
  const candidate: CaptureWineCandidate = {
    producer: compact(draft.producer),
    label: compact(draft.label),
    vintage: draft.vintage,
    region: compact(draft.region),
    subregion: compact(draft.subregion),
    country: compact(draft.country),
    varietal: compact(draft.varietal),
    wine_type: draft.wine_type,
    confidence: draft.confidence ?? null,
    ambiguous_fields: draft.ambiguous_fields ?? [],
  };
  return {
    wine: {
      producer: candidate.producer,
      label: candidate.label,
      vintage: candidate.vintage,
      region: candidate.region,
      subregion: candidate.subregion ?? null,
      country: candidate.country,
      varietal: candidate.varietal,
      wine_type: candidate.wine_type,
    },
    tasting: {
      score: draft.score,
      buy_again: draft.buy_again,
      occasion: compact(draft.occasion),
      descriptors: draft.descriptors,
      notes: compact(draft.notes),
      is_benchmark: draft.is_benchmark,
      extraction: { source: "field-capture", candidate },
    },
  };
}

export function createPostSaveActions(result: { wine_id: string; tasting_id: string; is_benchmark: boolean; buy_again: BuyAgain }): PostSaveAction[] {
  const actions: PostSaveAction[] = [];
  if (result.is_benchmark || result.buy_again === "yes") {
    actions.push({
      id: "find-more",
      label: "Find more",
      description: "Search current sourced availability and price evidence.",
      href: `/intelligence?wine_id=${encodeURIComponent(result.wine_id)}&action=find-more`,
      primary: true,
    });
    actions.push({
      id: "buy-again",
      label: "Buy Again lane",
      description: "Review replacement evidence and acquisition status.",
      href: `/intelligence?wine_id=${encodeURIComponent(result.wine_id)}#buy-again`,
    });
  }
  actions.push({
    id: "view-bottle",
    label: "View bottle intelligence",
    description: "Open this bottle's memory card and future recommendation signals.",
    href: `/cellar/${encodeURIComponent(result.wine_id)}?tasting=${encodeURIComponent(result.tasting_id)}`,
  });
  actions.push({
    id: "capture-another",
    label: "Capture another",
    description: "Stay in field mode for the next bottle or menu.",
    href: "/capture",
  });
  return actions;
}
