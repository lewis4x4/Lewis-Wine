import { getWineReadiness } from "./wine-readiness";

export type BottleBrainIntent = "drink_now" | "learn" | "risk" | "replace" | "value" | "brian_fit" | "general";

export type BottleBrainDecisionMode =
  | "tonight"
  | "guest"
  | "cellar_risk"
  | "buying"
  | "learning"
  | "occasion"
  | "audit"
  | "general";

export type BottleBrainWineDoc = {
  id: string;
  displayName: string;
  producer?: string | null;
  region?: string | null;
  wineType?: string | null;
  quantity: number;
  drink_after?: string | null;
  drink_before?: string | null;
  brian_fit_score?: number | null;
  brian_fit_reason?: string | null;
  ratings_count?: number | null;
  latest_rating_score?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  href: string;
};

export type BottleBrainReadinessState = "past_peak" | "hold" | "ready" | "unknown";
export type BottleBrainEvidenceStrength = "strong" | "medium" | "weak";
export type BottleBrainRecommendedAction = "open" | "hold" | "taste" | "replace" | "update_window" | "add_value";
export type BottleBrainClaimSource = "cellar" | "brian_fit" | "tasting_memory" | "drink_window" | "inventory" | "value";

export type BottleBrainEvidenceClaim = {
  citationId: string;
  source: BottleBrainClaimSource;
  text: string;
};

export type BottleBrainNextSignal = {
  citationId: string;
  text: string;
};

export type BottleBrainEvidencePacket = {
  id: string;
  displayName: string;
  href: string;
  retrievalScore: number;
  whyRetrieved: string;
  readiness: {
    state: BottleBrainReadinessState;
    label: string;
  };
  recommendedAction: BottleBrainRecommendedAction;
  evidenceStrength: BottleBrainEvidenceStrength;
  knownFromCellar: BottleBrainEvidenceClaim[];
  inferredFromBrianFit: BottleBrainEvidenceClaim[];
  needsMoreSignal: BottleBrainEvidenceClaim[];
  nextSignal: BottleBrainNextSignal;
};

export type BottleBrainCitation = BottleBrainWineDoc & {
  retrievalScore: number;
  whyRetrieved: string;
  readinessState: BottleBrainReadinessState;
  evidenceStrength: BottleBrainEvidenceStrength;
  recommendedAction: BottleBrainRecommendedAction;
};

export type BottleBrainRetrieval = {
  question: string;
  intent: BottleBrainIntent;
  decisionMode: BottleBrainDecisionMode;
  citations: BottleBrainCitation[];
  evidencePackets: BottleBrainEvidencePacket[];
  searchedRecords: number;
};

export type BottleBrainAnswer = {
  answer: string;
  confidenceNote: string;
  citations: BottleBrainCitation[];
  decisionMode: BottleBrainDecisionMode;
  evidencePackets: BottleBrainEvidencePacket[];
  groundedClaims: BottleBrainEvidenceClaim[];
  knownFromCellar: BottleBrainEvidenceClaim[];
  inferredFromBrianFit: BottleBrainEvidenceClaim[];
  needsMoreSignal: BottleBrainEvidenceClaim[];
  nextSignals: BottleBrainNextSignal[];
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "and",
  "are",
  "do",
  "for",
  "i",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "should",
  "the",
  "to",
  "what",
  "which",
  "with",
  "give",
  "tell",
]);

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function getDecisionMode(question: string): BottleBrainDecisionMode {
  const text = question.toLowerCase();
  if (/audit|what.*knows|where.*guessing|system knowledge|confidence/.test(text)) return "audit";
  if (/guest|serve|people|safe pick|crowd|company/.test(text)) return "guest";
  if (/past|risk|peak|old|urgent|too late|drift/.test(text)) return "cellar_risk";
  if (/replace|restock|buy again|low stock|replenish|buy|buying/.test(text)) return "buying";
  if (/learn|memory|rating|taste|note|signal|unknown/.test(text)) return "learning";
  if (/dinner|occasion|steak|salmon|celebration|gift|pair|pairing/.test(text)) return "occasion";
  if (/open|drink|tonight|now/.test(text)) return "tonight";
  return "general";
}

function getIntent(question: string): BottleBrainIntent {
  const text = question.toLowerCase();
  if (/past|risk|peak|old|urgent|too late|drift/.test(text)) return "risk";
  if (/learn|memory|rating|taste|note|signal|unknown/.test(text)) return "learn";
  if (/replace|restock|buy again|low stock|replenish/.test(text)) return "replace";
  if (/value|price|market|expensive|portfolio|cost/.test(text)) return "value";
  if (/open|drink|tonight|dinner|now|guest|serve|pair|safe pick/.test(text)) return "drink_now";
  if (/brian|fit|profile|like|favorite|favourite/.test(text)) return "brian_fit";
  return "general";
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function readiness(doc: BottleBrainWineDoc, asOf: Date): BottleBrainReadinessState {
  const state = getWineReadiness(doc, { asOf });
  if (state === "past_peak") return "past_peak";
  if (state === "hold") return "hold";
  if (state === "ready" || state === "drink_soon") return "ready";
  return "unknown";
}

function readinessLabel(state: BottleBrainReadinessState) {
  if (state === "past_peak") return "Past stated drinking window";
  if (state === "hold") return "Hold for later";
  if (state === "ready") return "Inside drinking window";
  return "Drink window unknown";
}

function docSearchText(doc: BottleBrainWineDoc) {
  return [
    doc.displayName,
    doc.producer,
    doc.region,
    doc.wineType,
    doc.brian_fit_reason,
    doc.notes,
    ...(doc.tags || []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function reasonFor(doc: BottleBrainWineDoc, intent: BottleBrainIntent, readyState: BottleBrainReadinessState) {
  if (intent === "risk" && readyState === "past_peak") return "past its stated drinking window";
  if (intent === "learn" && (doc.ratings_count ?? 0) === 0) return "no first-party tasting memory yet";
  if (intent === "replace" && doc.quantity <= 1 && (doc.brian_fit_score ?? 0) >= 92) return "only one high Brian-Fit bottle remains";
  if ((intent === "brian_fit" || intent === "drink_now") && (doc.brian_fit_score ?? 0) >= 92) return `${doc.brian_fit_score} Brian-Fit read`;
  if (readyState === "ready") return "inside its drinking window";
  if (doc.notes?.trim()) return "matching cellar notes and capture context";
  return "closest match in the current cellar records";
}

function scoreDoc(
  doc: BottleBrainWineDoc,
  intent: BottleBrainIntent,
  decisionMode: BottleBrainDecisionMode,
  queryTokens: string[],
  asOf: Date
) {
  const text = docSearchText(doc);
  const readyState = readiness(doc, asOf);
  let score = 0;

  for (const token of queryTokens) {
    if (text.includes(token)) score += 8;
  }

  if (intent === "drink_now") {
    if (readyState === "ready") score += 42;
    if ((doc.brian_fit_score ?? 0) >= 92) score += 24;
    if ((doc.ratings_count ?? 0) > 0) score += 8;
  }
  if (intent === "risk") {
    if (readyState === "past_peak") score += 65;
    if (readyState === "ready") score += 10;
  }
  if (intent === "learn") {
    if ((doc.ratings_count ?? 0) === 0) score += 65;
    if (doc.notes?.toLowerCase().includes("capture intelligence")) score += 10;
  }
  if (intent === "replace") {
    if (doc.quantity <= 1) score += 24;
    if ((doc.brian_fit_score ?? 0) >= 92) score += 35;
  }
  if (intent === "brian_fit") {
    score += Math.max(0, (doc.brian_fit_score ?? 0) - 75);
  }
  if (intent === "value") {
    if (text.includes("market") || text.includes("value")) score += 18;
    if ((doc.latest_rating_score ?? 0) >= 92) score += 8;
  }
  if (intent === "general") {
    if ((doc.brian_fit_score ?? 0) >= 92) score += 14;
    if (readyState === "ready") score += 14;
    if ((doc.ratings_count ?? 0) === 0) score += 6;
  }
  if (decisionMode === "audit") score += 40;
  if (decisionMode === "guest") {
    if ((doc.brian_fit_score ?? 0) >= 90) score += 18;
    if ((doc.ratings_count ?? 0) > 0) score += 10;
    if (readyState === "ready") score += 10;
  }
  if (decisionMode === "occasion" && readyState === "ready") score += 16;

  score += Math.min(doc.quantity, 4);
  return { score, readyState };
}

function chooseAction(
  doc: BottleBrainWineDoc,
  intent: BottleBrainIntent,
  decisionMode: BottleBrainDecisionMode,
  readyState: BottleBrainReadinessState
): BottleBrainRecommendedAction {
  if (readyState === "past_peak") return "update_window";
  if (intent === "replace" || decisionMode === "buying") return "replace";
  if (intent === "value") return "add_value";
  if (intent === "learn" || decisionMode === "learning" || (doc.ratings_count ?? 0) === 0) return "taste";
  if (readyState === "hold") return "hold";
  if (readyState === "ready") return "open";
  return "taste";
}

function evidenceStrength(doc: BottleBrainWineDoc, readyState: BottleBrainReadinessState): BottleBrainEvidenceStrength {
  let points = 0;
  if (readyState !== "unknown") points += 1;
  if ((doc.brian_fit_score ?? 0) > 0) points += 1;
  if ((doc.ratings_count ?? 0) > 0) points += 1;
  if (doc.notes?.trim()) points += 1;
  if ((doc.tags ?? []).length > 0) points += 1;
  if (points >= 4) return "strong";
  if (points >= 2) return "medium";
  return "weak";
}

function buildKnownClaims(doc: BottleBrainCitation): BottleBrainEvidenceClaim[] {
  const claims: BottleBrainEvidenceClaim[] = [
    {
      citationId: doc.id,
      source: "inventory",
      text: `${doc.displayName} has ${plural(doc.quantity, "bottle")} in the cellar.`,
    },
    {
      citationId: doc.id,
      source: "drink_window",
      text: `${doc.displayName} is ${readinessLabel(doc.readinessState).toLowerCase()}.`,
    },
  ];

  if (doc.latest_rating_score != null) {
    claims.push({
      citationId: doc.id,
      source: "tasting_memory",
      text: `${doc.displayName} has a latest first-party rating signal of ${doc.latest_rating_score}/100.`,
    });
  }
  if ((doc.ratings_count ?? 0) > 0) {
    claims.push({
      citationId: doc.id,
      source: "tasting_memory",
      text: `${doc.displayName} has ${plural(doc.ratings_count ?? 0, "tasting memory", "tasting memories")}.`,
    });
  }
  if (doc.notes?.trim()) {
    claims.push({
      citationId: doc.id,
      source: doc.notes.toLowerCase().includes("market") ? "value" : "cellar",
      text: `${doc.displayName} has cellar notes: ${doc.notes.trim().split("\n")[0]}.`,
    });
  }

  return claims;
}

function buildBrianFitClaims(doc: BottleBrainCitation): BottleBrainEvidenceClaim[] {
  if (doc.brian_fit_score == null) return [];
  const reason = doc.brian_fit_reason ? ` because ${doc.brian_fit_reason}` : " from available taste signals";
  return [
    {
      citationId: doc.id,
      source: "brian_fit",
      text: `${doc.displayName} carries a ${doc.brian_fit_score} Brian-Fit read${reason}.`,
    },
  ];
}

function buildSignalGaps(doc: BottleBrainCitation): BottleBrainEvidenceClaim[] {
  const gaps: BottleBrainEvidenceClaim[] = [];
  if ((doc.ratings_count ?? 0) === 0) {
    gaps.push({
      citationId: doc.id,
      source: "tasting_memory",
      text: `${doc.displayName} needs a first tasting note before Bottle Brain can trust personal preference claims.`,
    });
  }
  if (doc.brian_fit_score == null) {
    gaps.push({
      citationId: doc.id,
      source: "brian_fit",
      text: `${doc.displayName} has no Brian-Fit score yet.`,
    });
  }
  if (doc.readinessState === "unknown") {
    gaps.push({
      citationId: doc.id,
      source: "drink_window",
      text: `${doc.displayName} needs a drink window before readiness advice is dependable.`,
    });
  }
  if (!doc.notes?.trim()) {
    gaps.push({
      citationId: doc.id,
      source: "cellar",
      text: `${doc.displayName} has no cellar note context.`,
    });
  }
  if (gaps.length === 0) {
    gaps.push({
      citationId: doc.id,
      source: "tasting_memory",
      text: `${doc.displayName} would still benefit from a fresh occasion note after the next opening.`,
    });
  }
  return gaps;
}

function nextSignalFor(doc: BottleBrainCitation, action: BottleBrainRecommendedAction): BottleBrainNextSignal {
  if ((doc.ratings_count ?? 0) === 0) {
    return { citationId: doc.id, text: `Capture one tasting note for ${doc.displayName}; it will materially improve Brian-Fit confidence.` };
  }
  if (doc.readinessState === "past_peak") {
    return { citationId: doc.id, text: `Open, gift, or correct the drink window for ${doc.displayName} so it stops creating stale risk.` };
  }
  if (doc.brian_fit_score == null) {
    return { citationId: doc.id, text: `Add a rating or descriptor note for ${doc.displayName} to generate a Brian-Fit read.` };
  }
  if (action === "open") {
    return { citationId: doc.id, text: `Capture finish, tannin, and food context when opening ${doc.displayName}.` };
  }
  if (action === "replace") {
    return { citationId: doc.id, text: `After the next bottle, decide whether ${doc.displayName} deserves a replacement slot.` };
  }
  return { citationId: doc.id, text: `Add one fresh note to sharpen future recommendations for ${doc.displayName}.` };
}

function toEvidencePacket(doc: BottleBrainCitation): BottleBrainEvidencePacket {
  return {
    id: doc.id,
    displayName: doc.displayName,
    href: doc.href,
    retrievalScore: doc.retrievalScore,
    whyRetrieved: doc.whyRetrieved,
    readiness: {
      state: doc.readinessState,
      label: readinessLabel(doc.readinessState),
    },
    recommendedAction: doc.recommendedAction,
    evidenceStrength: doc.evidenceStrength,
    knownFromCellar: buildKnownClaims(doc),
    inferredFromBrianFit: buildBrianFitClaims(doc),
    needsMoreSignal: buildSignalGaps(doc),
    nextSignal: nextSignalFor(doc, doc.recommendedAction),
  };
}

export function retrieveBottleBrainContext(
  question: string,
  docs: BottleBrainWineDoc[],
  options: { asOf?: Date; limit?: number } = {}
): BottleBrainRetrieval {
  const asOf = options.asOf ?? new Date();
  const limit = options.limit ?? 5;
  const intent = getIntent(question);
  const decisionMode = getDecisionMode(question);
  const queryTokens = tokenize(question);

  const citations = docs
    .filter((doc) => doc.quantity > 0)
    .map((doc) => {
      const scored = scoreDoc(doc, intent, decisionMode, queryTokens, asOf);
      const base = {
        ...doc,
        retrievalScore: scored.score,
        readinessState: scored.readyState,
      };
      const recommendedAction = chooseAction(doc, intent, decisionMode, scored.readyState);
      return {
        ...base,
        whyRetrieved: reasonFor(doc, intent, scored.readyState),
        evidenceStrength: evidenceStrength(doc, scored.readyState),
        recommendedAction,
      };
    })
    .filter((doc) => doc.retrievalScore >= 30 || intent === "general" || decisionMode === "audit")
    .sort((a, b) => b.retrievalScore - a.retrievalScore || (b.brian_fit_score ?? 0) - (a.brian_fit_score ?? 0))
    .slice(0, limit);

  return {
    question,
    intent,
    decisionMode,
    citations,
    evidencePackets: citations.map(toEvidencePacket),
    searchedRecords: docs.length,
  };
}

function formatCitation(doc: BottleBrainCitation) {
  const parts = [doc.displayName];
  if (doc.producer) parts.push(doc.producer);
  if (doc.region) parts.push(doc.region);
  return parts.join(" · ");
}

function primaryLine(question: string, retrieval: BottleBrainRetrieval, primary: BottleBrainCitation, secondary?: BottleBrainCitation) {
  const brianFit = primary.brian_fit_score != null ? ` It carries a ${primary.brian_fit_score} Brian-Fit read` : "";
  const rating = primary.latest_rating_score != null ? ` and your latest rating signal is ${primary.latest_rating_score}/100` : "";
  const support = secondary ? ` Tradeoff: ${formatCitation(secondary)} is the credible alternate because it is ${secondary.whyRetrieved}.` : "";

  if (retrieval.decisionMode === "audit") {
    const strong = retrieval.evidencePackets.filter((packet) => packet.evidenceStrength === "strong").length;
    const thin = retrieval.evidencePackets.filter((packet) => packet.needsMoreSignal.length > 0).length;
    return `I can prove ${plural(retrieval.citations.length, "active bottle record")} from the cellar. ${plural(strong, "record")} has strong evidence; ${plural(thin, "record")} still has thin or missing signal.`;
  }
  if (retrieval.decisionMode === "guest") {
    return `The safe pick is ${formatCitation(primary)}. It is ${primary.whyRetrieved}.${brianFit}${rating}.${support}`;
  }

  const leadByIntent: Record<BottleBrainIntent, string> = {
    drink_now: `Open ${formatCitation(primary)} first. It is ${primary.whyRetrieved}.${brianFit}${rating}.`,
    learn: `Start with ${formatCitation(primary)}. It has ${primary.whyRetrieved}, so one tasting note would materially improve the taste model.`,
    risk: `Deal with ${formatCitation(primary)} first. It is ${primary.whyRetrieved}, so the decision is open, gift, or correct the window rather than ignore it.`,
    replace: `Put ${formatCitation(primary)} on the replacement radar. It is ${primary.whyRetrieved}, which means the cellar may miss it once the last bottle is gone.`,
    value: `Use ${formatCitation(primary)} as the first value conversation. It is ${primary.whyRetrieved}; add or confirm market value if the portfolio read feels incomplete.`,
    brian_fit: `${formatCitation(primary)} is the strongest Brian-Fit answer in the retrieved set.${brianFit}${rating}.`,
    general: `${formatCitation(primary)} is the best-grounded answer I can retrieve for: “${question}”. It is ${primary.whyRetrieved}.`,
  };
  return `${leadByIntent[retrieval.intent]}${support}`;
}

function formatEvidenceSummary(packets: BottleBrainEvidencePacket[]) {
  const known = packets.flatMap((packet) => packet.knownFromCellar).slice(0, 3);
  const inferred = packets.flatMap((packet) => packet.inferredFromBrianFit).slice(0, 2);
  const gaps = packets.flatMap((packet) => packet.needsMoreSignal).slice(0, 2);

  const sections = [
    known.length ? `Known from cellar: ${known.map((claim) => claim.text).join(" ")}` : "",
    inferred.length ? `Inferred from Brian-Fit: ${inferred.map((claim) => claim.text).join(" ")}` : "",
    gaps.length ? `Still thin: ${gaps.map((claim) => claim.text).join(" ")}` : "",
  ].filter(Boolean);

  return sections.length ? ` ${sections.join(" ")}` : "";
}

export function buildBottleBrainAnswer(question: string, retrieval: BottleBrainRetrieval): BottleBrainAnswer {
  const [primary, secondary] = retrieval.citations;
  if (!primary) {
    return {
      answer: "I do not have enough cellar context to answer that yet. Add bottles, drink windows, ratings, or capture notes and Bottle Brain will have something real to retrieve.",
      confidenceNote: `No matching cellar records found across ${plural(retrieval.searchedRecords, "record")}.`,
      citations: [],
      decisionMode: retrieval.decisionMode,
      evidencePackets: [],
      groundedClaims: [],
      knownFromCellar: [],
      inferredFromBrianFit: [],
      needsMoreSignal: [],
      nextSignals: [],
    };
  }

  const evidencePackets = retrieval.evidencePackets;
  const knownFromCellar = evidencePackets.flatMap((packet) => packet.knownFromCellar);
  const inferredFromBrianFit = evidencePackets.flatMap((packet) => packet.inferredFromBrianFit);
  const needsMoreSignal = evidencePackets.flatMap((packet) => packet.needsMoreSignal);
  const nextSignals = evidencePackets.map((packet) => packet.nextSignal);
  const groundedClaims = [...knownFromCellar, ...inferredFromBrianFit];
  const evidenceSummary = formatEvidenceSummary(evidencePackets);
  const nextSignal = nextSignals[0] ? ` Next signal: ${nextSignals[0].text}` : "";

  return {
    answer: `${primaryLine(question, retrieval, primary, secondary)}${evidenceSummary}${nextSignal}`,
    confidenceNote: `Answer grounded in ${plural(retrieval.citations.length, "cellar record")} retrieved from ${plural(retrieval.searchedRecords, "active bottle record")}. Evidence strength: ${evidencePackets.map((packet) => `${packet.displayName} is ${packet.evidenceStrength}`).join("; ")}.`,
    citations: retrieval.citations,
    decisionMode: retrieval.decisionMode,
    evidencePackets,
    groundedClaims,
    knownFromCellar,
    inferredFromBrianFit,
    needsMoreSignal,
    nextSignals,
  };
}
