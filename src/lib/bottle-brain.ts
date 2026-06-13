import { getWineReadiness } from "./wine-readiness";

export type BottleBrainIntent = "drink_now" | "learn" | "risk" | "replace" | "value" | "brian_fit" | "general";

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

export type BottleBrainCitation = BottleBrainWineDoc & {
  retrievalScore: number;
  whyRetrieved: string;
};

export type BottleBrainRetrieval = {
  question: string;
  intent: BottleBrainIntent;
  citations: BottleBrainCitation[];
  searchedRecords: number;
};

export type BottleBrainAnswer = {
  answer: string;
  confidenceNote: string;
  citations: BottleBrainCitation[];
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
]);

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function getIntent(question: string): BottleBrainIntent {
  const text = question.toLowerCase();
  if (/past|risk|peak|old|urgent|too late|drift/.test(text)) return "risk";
  if (/learn|memory|rating|taste|note|signal|unknown/.test(text)) return "learn";
  if (/replace|restock|buy again|low stock|replenish/.test(text)) return "replace";
  if (/value|price|market|expensive|portfolio|cost/.test(text)) return "value";
  if (/open|drink|tonight|dinner|now/.test(text)) return "drink_now";
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

type BottleBrainReadyState = "past" | "hold" | "ready" | "unknown";

function readiness(doc: BottleBrainWineDoc, asOf: Date): BottleBrainReadyState {
  const state = getWineReadiness(doc, { asOf });
  if (state === "past_peak") return "past";
  if (state === "hold") return "hold";
  if (state === "ready" || state === "drink_soon") return "ready";
  return "unknown";
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

function reasonFor(doc: BottleBrainWineDoc, intent: BottleBrainIntent, readyState: string) {
  if (intent === "risk" && readyState === "past") return "past its stated drinking window";
  if (intent === "learn" && (doc.ratings_count ?? 0) === 0) return "no first-party tasting memory yet";
  if (intent === "replace" && doc.quantity <= 1 && (doc.brian_fit_score ?? 0) >= 92) return "only one high Brian-Fit bottle remains";
  if ((intent === "brian_fit" || intent === "drink_now") && (doc.brian_fit_score ?? 0) >= 92) return `${doc.brian_fit_score} Brian-Fit read`;
  if (readyState === "ready") return "inside its drinking window";
  if (doc.notes?.trim()) return "matching cellar notes and capture context";
  return "closest match in the current cellar records";
}

function scoreDoc(doc: BottleBrainWineDoc, intent: BottleBrainIntent, queryTokens: string[], asOf: Date) {
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
    if (readyState === "past") score += 65;
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

  score += Math.min(doc.quantity, 4);
  return { score, readyState };
}

export function retrieveBottleBrainContext(
  question: string,
  docs: BottleBrainWineDoc[],
  options: { asOf?: Date; limit?: number } = {}
): BottleBrainRetrieval {
  const asOf = options.asOf ?? new Date();
  const limit = options.limit ?? 5;
  const intent = getIntent(question);
  const queryTokens = tokenize(question);

  const citations = docs
    .filter((doc) => doc.quantity > 0)
    .map((doc) => {
      const scored = scoreDoc(doc, intent, queryTokens, asOf);
      return {
        ...doc,
        retrievalScore: scored.score,
        whyRetrieved: reasonFor(doc, intent, scored.readyState),
      };
    })
    .filter((doc) => doc.retrievalScore >= 30 || intent === "general")
    .sort((a, b) => b.retrievalScore - a.retrievalScore || (b.brian_fit_score ?? 0) - (a.brian_fit_score ?? 0))
    .slice(0, limit);

  return {
    question,
    intent,
    citations,
    searchedRecords: docs.length,
  };
}

function formatCitation(doc: BottleBrainCitation) {
  const parts = [doc.displayName];
  if (doc.producer) parts.push(doc.producer);
  if (doc.region) parts.push(doc.region);
  return parts.join(" · ");
}

export function buildBottleBrainAnswer(question: string, retrieval: BottleBrainRetrieval): BottleBrainAnswer {
  const [primary, secondary] = retrieval.citations;
  if (!primary) {
    return {
      answer: "I do not have enough cellar context to answer that yet. Add bottles, drink windows, ratings, or capture notes and Bottle Brain will have something real to retrieve.",
      confidenceNote: `No matching cellar records found across ${plural(retrieval.searchedRecords, "record")}.`,
      citations: [],
    };
  }

  const brianFit = primary.brian_fit_score != null ? ` It carries a ${primary.brian_fit_score} Brian-Fit read` : "";
  const rating = primary.latest_rating_score != null ? ` and your latest rating signal is ${primary.latest_rating_score}/100` : "";
  const support = secondary ? ` A credible second look is ${formatCitation(secondary)}, mainly because it is ${secondary.whyRetrieved}.` : "";

  const leadByIntent: Record<BottleBrainIntent, string> = {
    drink_now: `Open ${formatCitation(primary)} first. It is ${primary.whyRetrieved}.${brianFit}${rating}.`,
    learn: `Start with ${formatCitation(primary)}. It has ${primary.whyRetrieved}, so one tasting note would materially improve the taste model.`,
    risk: `Deal with ${formatCitation(primary)} first. It is ${primary.whyRetrieved}, so the decision is open, gift, or correct the window rather than ignore it.`,
    replace: `Put ${formatCitation(primary)} on the replacement radar. It is ${primary.whyRetrieved}, which means the cellar may miss it once the last bottle is gone.`,
    value: `Use ${formatCitation(primary)} as the first value conversation. It is ${primary.whyRetrieved}; add or confirm market value if the portfolio read feels incomplete.`,
    brian_fit: `${formatCitation(primary)} is the strongest Brian-Fit answer in the retrieved set.${brianFit}${rating}.`,
    general: `${formatCitation(primary)} is the best-grounded answer I can retrieve for: “${question}”. It is ${primary.whyRetrieved}.`,
  };

  return {
    answer: `${leadByIntent[retrieval.intent]}${support}`,
    confidenceNote: `Answer grounded in ${plural(retrieval.citations.length, "cellar record")} retrieved from ${plural(retrieval.searchedRecords, "active bottle record")}.`,
    citations: retrieval.citations,
  };
}
