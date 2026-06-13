export type CaptureSource = "label_scan" | "receipt_scan" | "manual";
export type CaptureQuality = "strong" | "useful" | "thin";

export type CaptureSignalInput = {
  source: CaptureSource;
  rawText?: string | null;
  confidence?: number | null;
  descriptors?: string[] | null;
  brianFitHint?: string | null;
  suggestedTastingNote?: string | null;
};

export function normalizeDescriptorList(descriptors: Array<string | null | undefined> | null | undefined) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const descriptor of descriptors ?? []) {
    const value = descriptor?.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function deriveCaptureQuality({
  confidence,
  descriptorCount,
}: {
  confidence?: number | null;
  descriptorCount: number;
}): CaptureQuality {
  const score = confidence ?? 0;

  if (score >= 85 && descriptorCount >= 2) return "strong";
  if (score >= 60 || (score >= 50 && descriptorCount >= 1)) return "useful";
  return "thin";
}

export function formatCaptureSource(source: CaptureSource) {
  switch (source) {
    case "label_scan":
      return "Label scan";
    case "receipt_scan":
      return "Receipt scan";
    case "manual":
      return "Manual intake";
  }
}

function formatCaptureQuality(quality: CaptureQuality) {
  switch (quality) {
    case "strong":
      return "Strong";
    case "useful":
      return "Useful";
    case "thin":
      return "Thin";
  }
}

export function buildCaptureIntelligenceNotes(input: CaptureSignalInput) {
  const descriptors = normalizeDescriptorList(input.descriptors);
  const quality = deriveCaptureQuality({
    confidence: input.confidence,
    descriptorCount: descriptors.length,
  });
  const sections = [
    "Capture Intelligence",
    `Source: ${formatCaptureSource(input.source)}`,
    `Capture quality: ${formatCaptureQuality(quality)}${typeof input.confidence === "number" ? ` (${input.confidence}% confidence)` : ""}`,
  ];

  if (descriptors.length > 0) {
    sections.push(`Descriptors: ${descriptors.join(", ")}`);
  }

  if (input.suggestedTastingNote?.trim()) {
    sections.push(`Suggested tasting note: ${input.suggestedTastingNote.trim()}`);
  }

  if (input.brianFitHint?.trim()) {
    sections.push(`Brian-Fit hint: ${input.brianFitHint.trim()}`);
  }

  if (input.rawText?.trim()) {
    sections.push(`Raw capture: ${input.rawText.trim()}`);
  }

  return sections.join("\n");
}

function parseConfidence(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function parseCaptureSignalParams(params: URLSearchParams): CaptureSignalInput | null {
  const source = params.get("capture_source") as CaptureSource | null;
  if (!source || !["label_scan", "receipt_scan", "manual"].includes(source)) return null;

  const descriptors = normalizeDescriptorList((params.get("capture_descriptors") ?? "").split(","));

  return {
    source,
    confidence: parseConfidence(params.get("capture_confidence")),
    descriptors,
    brianFitHint: params.get("capture_brian_fit_hint") || null,
    suggestedTastingNote: params.get("capture_tasting_note") || null,
    rawText: params.get("notes") || null,
  };
}
