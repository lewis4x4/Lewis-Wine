import { classifyObservationKind, normalizePriceObservation, type ObservationKind, type PriceObservation, type SourceType } from "./price-observations";

export type RefreshScope = "quick" | "pricing" | "readiness" | "deep" | "replacement";
export type RefreshTarget = "identity" | "pricing" | "readiness" | "serving" | "replacement";

export type BottleSearchRecord = {
  id: string;
  custom_name?: string | null;
  custom_producer?: string | null;
  custom_region?: string | null;
  vintage?: number | null;
  custom_vintage?: number | null;
  wine_reference?: {
    name?: string | null;
    producer?: string | null;
    region?: string | null;
    country?: string | null;
  } | null;
};

export type ExistingEvidenceSignal = {
  kind: ObservationKind | "replacement_price" | "market_value" | "identity" | "readiness";
  observedAt: string;
  reviewStatus: "draft" | "accepted" | "rejected" | "superseded";
};

export type RefreshPlan = {
  scope: RefreshScope;
  identity: ReturnType<typeof buildBottleSearchIdentity>;
  targets: RefreshTarget[];
  queries: string[];
  generatedAt: string;
  skipReason?: string;
};

export type SourcePolicy = {
  domain: string;
  sourceType: SourceType;
  extractionAllowed: boolean;
  allowedUse: ObservationKind[];
  risk: "low" | "medium" | "high";
  reason: string;
};

export type AiEvidenceCandidate = {
  title: string;
  url?: string | null;
  sourceType: SourceType;
  extractedText: string;
  priceCents?: number | null;
  currency?: string | null;
  vintage?: number | null;
  bottleSizeMl?: number | null;
  confidence: number;
};

export function buildBottleSearchIdentity(record: BottleSearchRecord) {
  const ref = record.wine_reference;
  const producer = ref?.producer ?? record.custom_producer ?? null;
  const name = ref?.name ?? record.custom_name ?? "Unknown wine";
  const region = ref?.region ?? record.custom_region ?? null;
  const vintage = record.vintage ?? record.custom_vintage ?? null;
  const confidence = ref ? 94 : producer && name !== "Unknown wine" ? 72 : 38;
  const query = [vintage, producer, name, region, "750ml", "wine"].filter(Boolean).join(" ");
  return { producer, name, region, vintage, query, confidence };
}

function targetsForScope(scope: RefreshScope): RefreshTarget[] {
  switch (scope) {
    case "pricing":
      return ["pricing"];
    case "readiness":
      return ["readiness", "serving"];
    case "replacement":
      return ["replacement"];
    case "deep":
      return ["identity", "pricing", "readiness", "serving", "replacement"];
    default:
      return ["identity", "pricing"];
  }
}

export function shouldSkipRefresh(existing: ExistingEvidenceSignal[], scope: RefreshScope, asOf = new Date().toISOString()) {
  if (scope === "deep" || scope === "readiness") return false;
  const required = scope === "replacement" || scope === "pricing" ? ["replacement_price", "market_value"] : ["identity", "replacement_price", "market_value"];
  const freshCutoffMs = new Date(asOf).getTime() - 45 * 24 * 60 * 60 * 1000;
  return existing.some((signal) => required.includes(signal.kind) && signal.reviewStatus === "accepted" && new Date(signal.observedAt).getTime() >= freshCutoffMs);
}

export function buildRefreshPlan(record: BottleSearchRecord, scope: RefreshScope, existing: ExistingEvidenceSignal[] = [], asOf = new Date().toISOString()): RefreshPlan {
  const identity = buildBottleSearchIdentity(record);
  const targets = targetsForScope(scope);
  const base = identity.query;
  const queries: string[] = [];
  if (targets.includes("pricing")) queries.push(`${base} current price retailer replacement value`);
  if (targets.includes("replacement")) queries.push(`${base} buy online replacement price in stock`);
  if (targets.includes("identity")) queries.push(`${base} winery producer vintage region`);
  if (targets.includes("readiness")) queries.push(`${base} vintage notes drink window tech sheet`);
  if (targets.includes("serving")) queries.push(`${base} serving temperature food pairing tech sheet`);
  return {
    scope,
    identity,
    targets,
    queries: [...new Set(queries)],
    generatedAt: asOf,
    skipReason: shouldSkipRefresh(existing, scope, asOf) ? "Fresh accepted evidence already exists for this scope." : undefined,
  };
}

function domainFromUrl(urlOrDomain?: string | null) {
  if (!urlOrDomain) return "manual";
  try {
    return new URL(urlOrDomain).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return urlOrDomain.replace(/^www\./, "").toLowerCase();
  }
}

export function classifySourcePolicy(urlOrDomain?: string | null): SourcePolicy {
  const domain = domainFromUrl(urlOrDomain);
  if (/vivino|cellartracker|wine-searcher/.test(domain)) {
    return { domain, sourceType: "public_web", extractionAllowed: false, allowedUse: [], risk: "high", reason: "Known login-gated/licensed or scraping-sensitive source; require manual export/API permission." };
  }
  if (/winebid|acker|zachys|sothebys|christies|auction/.test(domain)) {
    return { domain, sourceType: "auction", extractionAllowed: true, allowedUse: ["auction_comp"], risk: "medium", reason: "Auction evidence can support auction comps when public and cited." };
  }
  if (/winery|estate|vineyard|cellars|producer|tech-sheet|techsheet/.test(domain)) {
    return { domain, sourceType: "winery", extractionAllowed: true, allowedUse: ["producer_fact", "drink_window", "serving_guidance", "replacement_price"], risk: "low", reason: "Producer/winery pages are suitable for durable facts and replacement listings." };
  }
  if (/shop|wine|retail|market|merchant|totalwine|wine\.com/.test(domain)) {
    return { domain, sourceType: "retailer", extractionAllowed: true, allowedUse: ["replacement_price"], risk: "medium", reason: "Retail listings are replacement-price evidence, not market value." };
  }
  return { domain, sourceType: "public_web", extractionAllowed: true, allowedUse: ["identity", "producer_fact", "estimate"], risk: "medium", reason: "Generic public web evidence requires review." };
}

export function classifyEvidenceKind(source: { domain?: string; sourceType: SourceType }, fact: { kind?: ObservationKind | string | null }): ObservationKind {
  const sourceType = source.sourceType ?? classifySourcePolicy(source.domain).sourceType;
  return classifyObservationKind(sourceType, fact.kind);
}

export function normalizeAiEvidenceCandidates(candidates: AiEvidenceCandidate[], plan: RefreshPlan) {
  const observations: PriceObservation[] = [];
  const evidence = [] as Array<{ title: string; sourceType: SourceType; truthLabel: string; confidence: number; sourceUrl: string | null; detail: string }>;
  const gaps: string[] = [];
  for (const candidate of candidates) {
    const policy = classifySourcePolicy(candidate.url ?? candidate.title);
    const sourceType = candidate.sourceType === "ai_search" || candidate.sourceType === "unknown" ? policy.sourceType : candidate.sourceType ?? policy.sourceType;
    let confidence = Math.max(0, Math.min(100, candidate.confidence));
    if (plan.identity.vintage && candidate.vintage && candidate.vintage !== plan.identity.vintage) {
      confidence -= 25;
      gaps.push(`Candidate vintage ${candidate.vintage} does not match ${plan.identity.vintage}.`);
    }
    const truthLabel = !candidate.url || sourceType === "ai_inferred" ? "ai_inferred" : policy.extractionAllowed ? "estimated" : "rejected";
    evidence.push({ title: candidate.title, sourceType, truthLabel, confidence, sourceUrl: candidate.url ?? null, detail: candidate.extractedText });
    if (candidate.priceCents && truthLabel !== "rejected") {
      observations.push(normalizePriceObservation({
        inventoryId: "draft",
        sourceType,
        sourceName: candidate.title,
        sourceUrl: candidate.url ?? null,
        observationKind: classifyObservationKind(sourceType, sourceType === "retailer" ? "replacement_price" : "estimate"),
        truthLabel: truthLabel === "ai_inferred" ? "ai_inferred" : undefined,
        reviewStatus: "draft",
        observedPriceCents: candidate.priceCents,
        currency: candidate.currency ?? "USD",
        bottleSizeMl: candidate.bottleSizeMl ?? 750,
        vintage: candidate.vintage ?? plan.identity.vintage,
        confidence,
        observedAt: plan.generatedAt,
        notes: candidate.extractedText,
      }));
    }
  }
  if (candidates.length === 0) gaps.push("No reliable current evidence candidates were found.");
  return { evidence, observations, gaps };
}
