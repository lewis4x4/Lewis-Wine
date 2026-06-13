import type { AcidityLevel, FinishLength, RatingInsert, RatingSignalInsert, TanninLevel } from "@/types/database";

export type VoiceTastingWineDoc = {
  id: string;
  wine_reference_id?: string | null;
  displayName: string;
  producer?: string | null;
  region?: string | null;
  quantity: number;
  href: string;
};

export type VoiceTastingIntent = "log_tasting" | "unknown";
export type VoiceTastingStatus = "ready_to_save" | "needs_wine_match";
export type VoiceTastingConfidence = "high" | "medium" | "low";

export type VoiceTastingMatch = VoiceTastingWineDoc & {
  matchScore: number;
  confidence: VoiceTastingConfidence;
};

export type VoiceTastingRatingDraft = Omit<RatingInsert, "user_id">;
export type VoiceTastingSignalDraft = Omit<RatingSignalInsert, "user_id" | "rating_id">;

export type VoiceTastingDraft = {
  intent: VoiceTastingIntent;
  status: VoiceTastingStatus;
  transcript: string;
  matchedWine: VoiceTastingMatch | null;
  alternatives: VoiceTastingMatch[];
  rating: VoiceTastingRatingDraft;
  ratingSignal: VoiceTastingSignalDraft;
  summary: string;
  warnings: string[];
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "wine",
  "bottle",
  "jarvis",
  "log",
  "taste",
  "tasting",
  "points",
  "point",
]);

const DESCRIPTOR_TERMS = [
  "black cherry",
  "red cherry",
  "dark fruit",
  "red fruit",
  "cassis",
  "blackberry",
  "raspberry",
  "plum",
  "cedar",
  "graphite",
  "leather",
  "tobacco",
  "earth",
  "mineral",
  "oak",
  "vanilla",
  "spice",
  "pepper",
  "floral",
  "citrus",
  "apple",
  "pear",
  "stone fruit",
  "honey",
];

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function confidenceFor(score: number): VoiceTastingConfidence {
  if (score >= 36) return "high";
  if (score >= 18) return "medium";
  return "low";
}

export function rankVoiceTastingMatches(transcript: string, docs: VoiceTastingWineDoc[], limit = 5): VoiceTastingMatch[] {
  const queryTokens = tokenize(transcript);

  return docs
    .filter((doc) => doc.quantity > 0)
    .map((doc) => {
      const docText = tokenize([doc.displayName, doc.producer, doc.region].filter(Boolean).join(" "));
      const exactNameHit = transcript.toLowerCase().includes(doc.displayName.toLowerCase().replace(/^\d{4}\s+/, ""));
      const overlap = queryTokens.filter((token) => docText.includes(token));
      const vintage = doc.displayName.match(/\b(19|20)\d{2}\b/)?.[0];
      const vintageHit = vintage ? transcript.includes(vintage) : false;
      const matchScore = overlap.length * 10 + (exactNameHit ? 22 : 0) + (vintageHit ? 8 : 0);

      return {
        ...doc,
        matchScore,
        confidence: confidenceFor(matchScore),
      };
    })
    .filter((doc) => doc.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

function extractScore(transcript: string) {
  const text = transcript.toLowerCase();
  const explicit = text.match(/\b(\d{2,3})(?:\s*\/\s*100|\s*(?:points?|pts?))\b/);
  const number = explicit ? Number.parseInt(explicit[1], 10) : null;
  if (number != null && number >= 50 && number <= 100) return number;
  if (/exceptional|profound|stunning/.test(text)) return 96;
  if (/outstanding|excellent|love|loved/.test(text)) return 94;
  if (/very good|really good|delicious/.test(text)) return 92;
  if (/good|solid|liked/.test(text)) return 90;
  if (/disappointing|flat|thin/.test(text)) return 84;
  return 90;
}

function extractDescriptors(transcript: string) {
  const text = transcript.toLowerCase();
  return DESCRIPTOR_TERMS.filter((term) => text.includes(term));
}

function extractFoodPairing(transcript: string) {
  const match = transcript.match(/\bwith\s+([^.,;]+?)(?:\s+at\s+|\s+in\s+|\s+on\s+|[.,;]|$)/i);
  return match?.[1]?.trim() || null;
}

function extractVenue(transcript: string) {
  const match = transcript.match(/\b(?:at|in)\s+(home|restaurant|club|office|cellar|kitchen|dinner|lunch)\b/i);
  return match?.[1]?.toLowerCase() || null;
}

function extractTannins(transcript: string): TanninLevel | null {
  const text = transcript.toLowerCase();
  if (/firm tannins|grippy tannins|medium-high tannins/.test(text)) return "medium-high";
  if (/high tannins|massive tannins/.test(text)) return "high";
  if (/soft tannins|silky tannins|low tannins/.test(text)) return "low";
  if (/tannin/.test(text)) return "medium";
  return null;
}

function extractAcidity(transcript: string): AcidityLevel | null {
  const text = transcript.toLowerCase();
  if (/bright acidity|fresh acidity|medium-high acidity/.test(text)) return "medium-high";
  if (/high acidity|racy acidity/.test(text)) return "high";
  if (/low acidity|soft acidity/.test(text)) return "low";
  if (/acid/.test(text)) return "medium";
  return null;
}

function extractFinish(transcript: string): FinishLength | null {
  const text = transcript.toLowerCase();
  if (/very long finish|endless finish/.test(text)) return "very-long";
  if (/long finish/.test(text)) return "long";
  if (/short finish/.test(text)) return "short";
  if (/finish/.test(text)) return "medium";
  return null;
}

function scoreSignalFromText(transcript: string, descriptors: string[]) {
  const text = transcript.toLowerCase();
  return {
    fruit_forward: descriptors.some((term) => /cherry|fruit|cassis|berry|plum|raspberry/.test(term)) ? 4 : null,
    earthiness: descriptors.some((term) => /earth|leather|tobacco|graphite|mineral/.test(term)) ? 4 : null,
    spiciness: descriptors.some((term) => /spice|pepper|cedar/.test(term)) ? 3 : null,
    tannin_strength: /firm tannins|grippy tannins|high tannins/.test(text) ? 4 : /soft tannins|low tannins/.test(text) ? 2 : null,
    acidity_level: /bright acidity|fresh acidity|high acidity/.test(text) ? 4 : /low acidity/.test(text) ? 2 : null,
    finish_length: /very long finish|endless finish/.test(text) ? 5 : /long finish/.test(text) ? 4 : /short finish/.test(text) ? 2 : null,
    richness: /rich|dense|opulent|concentrated/.test(text) ? 4 : null,
    smoothness: /silky|smooth|polished/.test(text) ? 4 : null,
    boldness: /bold|powerful|intense/.test(text) ? 4 : null,
    dryness: /dry|bone dry/.test(text) ? 4 : null,
  } satisfies Partial<VoiceTastingSignalDraft>;
}

function occasionTags(transcript: string) {
  const text = transcript.toLowerCase();
  const tags = ["voice-capture"];
  if (/dinner|steak|with/.test(text)) tags.push("dinner");
  if (/home/.test(text)) tags.push("at-home");
  if (/restaurant|club/.test(text)) tags.push("restaurant");
  return unique(tags);
}

function decisionTags(transcript: string) {
  const text = transcript.toLowerCase();
  const tags = ["voice-capture"];
  if (/buy again|would buy|rebuy|restock/.test(text)) tags.push("buy-again");
  if (/value feels strong|strong value|great value/.test(text)) tags.push("strong-value");
  if (/too much oak|over.?oaked/.test(text)) tags.push("oak-caution");
  if (/too young|needs time/.test(text)) tags.push("hold-next-bottle");
  return unique(tags);
}

function valueFeel(transcript: string): VoiceTastingSignalDraft["value_feel"] {
  const text = transcript.toLowerCase();
  if (/excellent value|exceptional value/.test(text)) return "excellent";
  if (/value feels strong|strong value|great value/.test(text)) return "strong";
  if (/good value|fair price/.test(text)) return "good";
  if (/poor value|overpriced/.test(text)) return "poor";
  return null;
}

function todayIso(asOf: Date) {
  return asOf.toISOString().slice(0, 10);
}

export function summarizeVoiceTastingDraft(draft: VoiceTastingDraft) {
  if (draft.status === "needs_wine_match") {
    return "This tasting draft needs a bottle match before saving, but the transcript has been structured for review.";
  }

  return `${draft.rating.score}-point tasting draft for ${draft.matchedWine?.displayName}. ${draft.rating.tasting_notes}`;
}

export function buildVoiceTastingDraft(
  transcript: string,
  docs: VoiceTastingWineDoc[],
  options: { asOf?: Date; selectedInventoryId?: string | null } = {},
): VoiceTastingDraft {
  const normalized = transcript.trim();
  const asOf = options.asOf ?? new Date();
  const rankedMatches = rankVoiceTastingMatches(normalized, docs);
  const selectedDoc = options.selectedInventoryId
    ? docs.find((doc) => doc.id === options.selectedInventoryId && doc.quantity > 0)
    : null;
  const selectedMatch: VoiceTastingMatch | null = selectedDoc
    ? {
        ...selectedDoc,
        matchScore: Math.max(rankedMatches.find((match) => match.id === selectedDoc.id)?.matchScore ?? 0, 100),
        confidence: "high",
      }
    : null;
  const matches = selectedMatch
    ? [selectedMatch, ...rankedMatches.filter((match) => match.id !== selectedMatch.id)]
    : rankedMatches;
  const matchedWine = selectedMatch || (matches[0]?.confidence === "high" ? matches[0] : null);
  const descriptors = extractDescriptors(normalized);
  const occasion = occasionTags(normalized);
  const decisions = decisionTags(normalized);
  const score = extractScore(normalized);

  const rating: VoiceTastingRatingDraft = {
    inventory_id: matchedWine?.id ?? null,
    wine_reference_id: matchedWine?.wine_reference_id ?? null,
    score,
    tasting_notes: normalized,
    palate_notes: descriptors.length ? `Voice descriptors: ${descriptors.join(", ")}.` : normalized,
    food_pairing: extractFoodPairing(normalized),
    venue: extractVenue(normalized),
    tasting_date: todayIso(asOf),
    tannins: extractTannins(normalized),
    acidity: extractAcidity(normalized),
    finish: extractFinish(normalized),
    occasion_tags: occasion,
  };

  const ratingSignal: VoiceTastingSignalDraft = {
    ...scoreSignalFromText(normalized, descriptors),
    buy_again: /buy again|would buy|rebuy|restock/.test(normalized.toLowerCase()) ? true : null,
    value_feel: valueFeel(normalized),
    decision_tags: decisions,
    occasion_tags: occasion,
    brian_phrases: descriptors.length ? descriptors : null,
    extracted_from_text: {
      source: "voice-tasting-capture",
      transcript: normalized,
      descriptors,
      matched_wine_id: matchedWine?.id ?? null,
      match_confidence: matchedWine?.confidence ?? "low",
      selected_inventory_id: options.selectedInventoryId ?? null,
    },
  };

  const draft: VoiceTastingDraft = {
    intent: /log|rating|taste|tasting|points?|jarvis/i.test(normalized) ? "log_tasting" : "unknown",
    status: matchedWine ? "ready_to_save" : "needs_wine_match",
    transcript: normalized,
    matchedWine,
    alternatives: matches.slice(matchedWine ? 1 : 0, matchedWine ? 4 : 3),
    rating,
    ratingSignal,
    summary: "",
    warnings: matchedWine ? [] : ["No high-confidence cellar bottle match found."],
  };

  return {
    ...draft,
    summary: summarizeVoiceTastingDraft(draft),
  };
}
