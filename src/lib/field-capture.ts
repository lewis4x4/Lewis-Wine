export type FieldCaptureSaveMode = "memory_only" | "add_to_cellar" | "link_existing_inventory";

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
  hint?: string | null;
};

export type CaptureWineResponse = {
  candidate: CaptureWineCandidate;
  matched_wine_id: string | null;
  needs_follow_up: boolean;
  follow_up_question: string | null;
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
  evidence_data_url?: string | null;
  save_mode?: FieldCaptureSaveMode;
  inventory_id?: string | null;
  cellar_id?: string | null;
  quantity?: number | null;
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
  evidence_data_url?: string | null;
  save_mode: FieldCaptureSaveMode;
  inventory_id?: string | null;
  cellar_id?: string | null;
  quantity?: number | null;
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

export type FieldCaptureCellarPayload = {
  cellar_id: string;
  wine_reference_id: string | null;
  custom_name: string;
  custom_producer: string | null;
  custom_vintage: number | null;
  custom_wine_type: Exclude<WineType, "rosé">;
  custom_region: string | null;
  vintage: number | null;
  quantity: number;
  status: "in_cellar";
  notes: string | null;
  tags: string[];
  label_image_url?: string | null;
};

export type FieldCaptureRatingPayload = {
  inventory_id: string;
  wine_reference_id: string | null;
  score: number;
  tasting_notes: string | null;
  occasion: string | null;
};

export type FieldCaptureRatingSignalPayload = {
  buy_again: boolean | null;
  decision_tags: string[];
  occasion_tags: string[];
  brian_phrases: string[];
  extracted_from_text: {
    source: "field-capture";
    save_mode: FieldCaptureSaveMode;
    inventory_id?: string | null;
    candidate: CaptureWineCandidate;
    descriptors: string[];
    confidence_label: ReviewDraft["confidence_label"];
  };
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

export type EvidenceUpload = {
  bucket: "wine-evidence";
  path: string;
  contentType: CaptureWineRequest["media_type"];
  bytes: Uint8Array;
};

export type EvidenceUploadInput = {
  ownerId: string;
  wineId: string;
  dataUrl: string;
  token: string;
};

const evidenceExtensions: Record<CaptureWineRequest["media_type"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const maxEvidenceBytes = 8 * 1024 * 1024;

export const tapizDemoCandidate: CaptureWineCandidate = {
  producer: "Tapiz",
  label: "Alta Collection Cabernet Sauvignon",
  vintage: 2021,
  region: "Mendoza",
  subregion: "San Pablo Vineyard, Uco Valley",
  country: "Argentina",
  varietal: "Cabernet Sauvignon",
  wine_type: "red",
  confidence: { producer: 0.95, label: 0.9, vintage: 0.92, region: 0.86, varietal: 0.94, wine_type: 0.9 },
  ambiguous_fields: [],
};

export function buildCaptureWineRequest(dataUrl: string, hint?: string | null): CaptureWineRequest {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Provide a valid image data URL.");
  const mediaType = match[1] as CaptureWineRequest["media_type"];
  if (!allowedMediaTypes.has(mediaType)) throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  return { media_type: mediaType, image_base64: match[2], hint: compact(hint) };
}

export function shouldEnterCaptureFollowUp(response: Pick<CaptureWineResponse, "needs_follow_up" | "follow_up_question">, alreadyAsked: boolean) {
  return Boolean(response.needs_follow_up && response.follow_up_question && !alreadyAsked);
}

export function buildCaptureFollowUpHint(question: string | null | undefined, answer: string) {
  const cleanAnswer = compact(answer);
  const cleanQuestion = compact(question);
  if (!cleanAnswer || !cleanQuestion) return null;
  return `Follow-up answer: ${cleanQuestion} ${cleanAnswer}`;
}

export function canSaveFieldCaptureDraft(draft: Pick<ReviewDraft, "producer" | "label" | "vintage">) {
  if (!compact(draft.producer) && !compact(draft.label)) {
    return { ok: false, reason: "Add at least a producer or label before saving this capture." };
  }
  if (!draft.vintage && !compact(draft.label)) {
    return { ok: false, reason: "Add a label or vintage before saving this capture." };
  }
  return { ok: true, reason: null };
}

function decodeBase64Image(base64: string) {
  const normalized = base64.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error("Evidence image must contain valid base64 data.");
  }
  const bytes = Buffer.from(normalized, "base64");
  if (!bytes.byteLength) throw new Error("Evidence image must contain valid base64 data.");
  if (bytes.byteLength > maxEvidenceBytes) throw new Error("Evidence image is too large; use an image under 8 MB.");
  return bytes;
}

function sanitizePathPart(value: string, label: string) {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!cleaned) throw new Error(`Evidence ${label} is required.`);
  return cleaned;
}

export function buildEvidenceUpload(input: EvidenceUploadInput): EvidenceUpload {
  const ownerId = sanitizePathPart(input.ownerId, "owner");
  const wineId = sanitizePathPart(input.wineId, "wine");
  const token = sanitizePathPart(input.token, "token");
  const request = buildCaptureWineRequest(input.dataUrl);
  const bytes = decodeBase64Image(request.image_base64);
  return {
    bucket: "wine-evidence",
    path: `${ownerId}/bottles/${wineId}/${token}.${evidenceExtensions[request.media_type]}`,
    contentType: request.media_type,
    bytes,
  };
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

function normalizeIdentityPart(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function buildWineIdentityKey(input: Pick<CaptureWineCandidate, "producer" | "label" | "vintage">) {
  return [input.producer, input.vintage, input.label].map(normalizeIdentityPart).join("|");
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
    save_mode: draft.save_mode ?? "memory_only",
    inventory_id: compact(draft.inventory_id),
    cellar_id: compact(draft.cellar_id),
    quantity: draft.quantity ?? null,
    tasting: {
      score: draft.score,
      buy_again: draft.buy_again,
      occasion: compact(draft.occasion),
      descriptors: draft.descriptors,
      notes: compact(draft.notes),
      is_benchmark: draft.is_benchmark,
      extraction: { source: "field-capture", candidate },
    },
    evidence_data_url: compact(draft.evidence_data_url),
  };
}

function actionTags(draft: Pick<ReviewDraft, "is_benchmark" | "buy_again">, extra: string[] = []) {
  const tags = ["field-capture"];
  if (draft.is_benchmark) tags.push("benchmark");
  else tags.push("tasting-memory");
  if (draft.buy_again === "yes") tags.push("buy-again");
  tags.push(...extra);
  return tags;
}

function normalizeCellarWineType(wineType: WineType): Exclude<WineType, "rosé"> {
  return wineType === "rosé" ? "rose" : wineType;
}

export function buildFieldCaptureCellarPayload(draft: ReviewDraft, options: { cellarId: string; quantity?: number | null; labelImageUrl?: string | null }): FieldCaptureCellarPayload {
  return {
    cellar_id: options.cellarId,
    wine_reference_id: null,
    custom_name: compact(draft.label) ?? draft.title,
    custom_producer: compact(draft.producer),
    custom_vintage: draft.vintage,
    custom_wine_type: normalizeCellarWineType(draft.wine_type),
    custom_region: compact(draft.region),
    vintage: draft.vintage,
    quantity: Math.max(1, Math.trunc(options.quantity ?? draft.quantity ?? 1)),
    status: "in_cellar",
    notes: [`Field capture: ${draft.title}.`, compact(draft.occasion), compact(draft.notes)].filter(Boolean).join(" ") || null,
    tags: actionTags(draft),
    label_image_url: options.labelImageUrl ?? null,
  };
}

export function buildFieldCaptureRatingPayload(draft: ReviewDraft, options: { inventoryId: string; wineReferenceId?: string | null }): FieldCaptureRatingPayload | null {
  if (draft.score == null) return null;
  return {
    inventory_id: options.inventoryId,
    wine_reference_id: options.wineReferenceId ?? null,
    score: draft.score,
    tasting_notes: compact(draft.notes) ?? compact(draft.occasion),
    occasion: compact(draft.occasion),
  };
}

export function buildFieldCaptureRatingSignalPayload(draft: ReviewDraft, options: { saveMode: FieldCaptureSaveMode; inventoryId?: string | null }): FieldCaptureRatingSignalPayload {
  return {
    buy_again: draft.buy_again === "yes" ? true : draft.buy_again === "no" ? false : null,
    decision_tags: actionTags(draft, [options.saveMode.replace(/_/g, "-")]),
    occasion_tags: compact(draft.occasion) ? [draft.occasion] : [],
    brian_phrases: draft.descriptors,
    extracted_from_text: {
      source: "field-capture",
      save_mode: options.saveMode,
      inventory_id: options.inventoryId ?? null,
      candidate: {
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
      },
      descriptors: draft.descriptors,
      confidence_label: draft.confidence_label,
    },
  };
}

export function createPostSaveActions(result: { wine_id: string; tasting_id: string; inventory_id?: string | null; rating_id?: string | null; is_benchmark: boolean; buy_again: BuyAgain }): PostSaveAction[] {
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
  if (result.inventory_id) {
    actions.push({
      id: "view-bottle",
      label: "View bottle intelligence",
      description: "Open this cellar bottle's memory card and future recommendation signals.",
      href: `/cellar/${encodeURIComponent(result.inventory_id)}?tasting=${encodeURIComponent(result.rating_id ?? result.tasting_id)}`,
    });
  }
  actions.push({
    id: "capture-another",
    label: "Capture another",
    description: "Stay in field mode for the next bottle or menu.",
    href: "/capture",
  });
  return actions;
}
