import { brianFitScore, type AdvisorLineItem, type BrianFitResult, type TasteProfile } from "./pourfolio-intelligence";
import type { AcquisitionPriority, AcquisitionSourceKind, AcquisitionStatus } from "./acquisition-engine";

export type ShoppingAvailability = "available" | "limited" | "unknown" | "sold_out";
export type ShoppingDecision = "Buy Now" | "Consider" | "Skip";

export type ShoppingLineItem = AdvisorLineItem & {
  raw: string;
  availability: ShoppingAvailability;
};

export type ShoppingRecommendation = {
  id: string;
  item: ShoppingLineItem;
  fit: BrianFitResult;
  decision: ShoppingDecision;
  role: "best_buy" | "best_value" | "splurge" | "skip" | "contender";
  acquisitionPriority: AcquisitionPriority;
  quantityToBuy: number;
  spendCents: number | null;
  why: string[];
};

export type ShoppingModeInput = {
  retailer?: string | null;
  context?: string | null;
  desiredQuantity?: number | null;
  maxBudgetCents?: number | null;
  profile: TasteProfile;
  items: ShoppingLineItem[];
};

export type ShoppingModeResult = {
  retailer?: string | null;
  headline: string;
  shoppingBrief: string;
  budgetWarning: string | null;
  summary: { total: number; buyNow: number; consider: number; skip: number; estimatedSpendCents: number };
  picks: {
    bestBuy: ShoppingRecommendation | null;
    bestValue: ShoppingRecommendation | null;
    splurge: ShoppingRecommendation | null;
    skip: ShoppingRecommendation | null;
  };
  recommendations: ShoppingRecommendation[];
};

export type AcquisitionTargetPayload = {
  wineTitle: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  varietal: string | null;
  sourceKind: AcquisitionSourceKind;
  status: AcquisitionStatus;
  priority: AcquisitionPriority;
  desiredQuantity: number;
  targetPriceCents: number | null;
  maxPriceCents: number | null;
  nextRefreshAt: string;
  notes: string | null;
};

function clean(value: string) {
  return value.replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
}

function priceFromLine(line: string): number | null {
  const matches = [...line.matchAll(/(?:\$\s*)?(\d{2,5})(?:\.\d{2})?(?=\s*(?:available|limited|in stock|sold out|$))/gi)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function vintageFromLine(line: string): number | null {
  const match = line.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function inferAvailability(line: string): ShoppingAvailability {
  const lowered = line.toLowerCase();
  if (/sold\s*out|unavailable|out\s*of\s*stock/.test(lowered)) return "sold_out";
  if (/limited|last\s*bottles?|low\s*stock/.test(lowered)) return "limited";
  if (/available|in\s*stock|ships?\s*now/.test(lowered)) return "available";
  return "unknown";
}

function inferVarietal(text: string): string | null {
  const lowered = text.toLowerCase();
  if (/cabernet|cab\b/.test(lowered)) return "Cabernet Sauvignon";
  if (/pinot noir/.test(lowered)) return "Pinot Noir";
  if (/merlot/.test(lowered)) return "Merlot";
  if (/malbec/.test(lowered)) return "Malbec";
  if (/syrah|shiraz/.test(lowered)) return "Syrah";
  if (/chardonnay/.test(lowered)) return "Chardonnay";
  if (/sauvignon blanc/.test(lowered)) return "Sauvignon Blanc";
  return null;
}

function inferRegion(text: string): string | null {
  const lowered = text.toLowerCase();
  if (/mendoza/.test(lowered)) return "Mendoza";
  if (/napa/.test(lowered)) return "Napa Valley";
  if (/willamette/.test(lowered)) return "Willamette Valley";
  if (/bordeaux/.test(lowered)) return "Bordeaux";
  if (/sonoma/.test(lowered)) return "Sonoma";
  if (/rioja/.test(lowered)) return "Rioja";
  if (/tuscany|brunello|chianti/.test(lowered)) return "Tuscany";
  return null;
}

function descriptorsFor(varietal?: string | null, region?: string | null, raw?: string): string[] {
  const haystack = `${varietal ?? ""} ${region ?? ""} ${raw ?? ""}`.toLowerCase();
  const descriptors: string[] = [];
  if (/cabernet|malbec|mendoza|napa/.test(haystack)) descriptors.push("black fruit", "structured", "smooth", "rich");
  if (/pinot/.test(haystack)) descriptors.push("silky", "red fruit", "bright");
  if (/merlot/.test(haystack)) descriptors.push("plush");
  return [...new Set(descriptors)];
}

function stripKnownText(line: string, vintage: number | null, price: number | null, region: string | null) {
  let working = line;
  if (vintage) working = working.replace(String(vintage), " ");
  if (price) working = working.replace(new RegExp(`(?:\\$\\s*)?${price}(?:\\.00)?`, "i"), " ");
  if (region) working = working.replace(new RegExp(`\\b${region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), " ");
  working = working.replace(/available|limited|in stock|sold out|ships? now/gi, " ");
  working = working.replace(/[,|-]/g, " ");
  return clean(working);
}

function parseProducerAndLabel(line: string, vintage: number | null, price: number | null, region: string | null, varietal: string | null) {
  const tokens = stripKnownText(line, vintage, price, region).split(" ").filter(Boolean);
  if (!tokens.length) return { producer: null, label: line };
  let producerLength = 1;
  if (tokens[0]?.toLowerCase() === "lewis" && tokens[1]?.toLowerCase() === "cellars") producerLength = 2;
  else if (tokens[0]?.toLowerCase() === "willamette" && tokens[1]?.toLowerCase() === "fixture") producerLength = 2;
  else if (["cellars", "estate", "winery", "vineyard", "vineyards", "domaine", "chateau", "bodega", "bodegas"].includes(tokens[1]?.toLowerCase())) producerLength = 2;
  const producer = tokens.slice(0, producerLength).join(" ");
  const label = clean(tokens.slice(producerLength).join(" ") || varietal || line);
  return { producer, label };
}

export function parseRetailerWineText(text: string): ShoppingLineItem[] {
  return text
    .split(/\n+/)
    .map(clean)
    .filter((line) => line.length > 6 && !/^(retailer|wine shop|cabernet sale|red|white|sparkling)$/i.test(line) && !/^.+\s-\s.+sale$/i.test(line))
    .map((line) => {
      const price = priceFromLine(line);
      const vintage = vintageFromLine(line);
      const region = inferRegion(line);
      const varietal = inferVarietal(line);
      const { producer, label } = parseProducerAndLabel(line, vintage, price, region, varietal);
      return {
        raw: line,
        producer,
        label,
        vintage,
        region,
        varietal,
        price,
        availability: inferAvailability(line),
        descriptors: descriptorsFor(varietal, region, line),
        readiness: vintage && vintage <= 2021 ? "drink_now" : "unknown",
        valueFlag: price && price > 220 ? "overpriced" : "fair",
      } satisfies ShoppingLineItem;
    });
}

function recommendationId(item: ShoppingLineItem, index: number) {
  return [item.vintage, item.producer, item.label, index].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function acquisitionPriority(score: number, decision: ShoppingDecision): AcquisitionPriority {
  if (decision === "Buy Now" && score >= 85) return "must_have";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function decisionFor(item: ShoppingLineItem, fit: BrianFitResult, profile: TasteProfile): ShoppingDecision {
  const name = `${item.producer ?? ""} ${item.label}`.toLowerCase();
  if (item.availability === "sold_out") return "Skip";
  if (profile.avoidList.some((avoid) => name.includes(avoid.toLowerCase()))) return "Skip";
  if (fit.score >= 80 && item.price != null && item.price <= (profile.priceBand.high ?? 200)) return "Buy Now";
  if (fit.score >= 55) return "Consider";
  return "Skip";
}

function quantityFor(decision: ShoppingDecision, desiredQuantity: number, price: number | null, maxBudgetCents: number | null) {
  if (decision !== "Buy Now") return 0;
  if (!price) return Math.max(1, desiredQuantity);
  if (!maxBudgetCents) return Math.max(1, desiredQuantity);
  return price * 100 * desiredQuantity > maxBudgetCents ? 1 : Math.max(1, desiredQuantity);
}

function whyFor(item: ShoppingLineItem, fit: BrianFitResult, decision: ShoppingDecision) {
  const why = [...fit.reasons];
  if (item.availability === "limited") why.unshift("Limited availability: decide quickly or ignore deliberately.");
  if (item.availability === "sold_out") why.unshift("Sold out in this list, so it should not become an urgent buy.");
  if (decision === "Buy Now") why.unshift("Worth converting from shopping opportunity into acquisition target.");
  return [...new Set(why)].slice(0, 5);
}

function applyRoles(recommendations: ShoppingRecommendation[]) {
  const buyable = recommendations.filter((row) => row.decision !== "Skip");
  const bestBuy = buyable[0] ?? null;
  const bestValue = [...buyable].filter((row) => row.item.price).sort((a, b) => (b.fit.score / (b.item.price || 1)) - (a.fit.score / (a.item.price || 1)))[0] ?? null;
  const splurge = [...buyable].filter((row) => (row.item.price ?? 0) >= 150).sort((a, b) => b.fit.score - a.fit.score)[0] ?? null;
  const skip = recommendations.find((row) => row.decision === "Skip") ?? null;
  return recommendations.map((row) => ({
    ...row,
    role: row.id === bestBuy?.id ? "best_buy" as const
      : row.id === bestValue?.id ? "best_value" as const
      : row.id === splurge?.id ? "splurge" as const
      : row.id === skip?.id ? "skip" as const
      : "contender" as const,
  }));
}

export function buildShoppingMode(input: ShoppingModeInput): ShoppingModeResult {
  const desiredQuantity = Math.max(1, input.desiredQuantity ?? 1);
  const recommendations = input.items
    .map((item, index) => {
      const fit = brianFitScore(item, input.profile, input.context ?? undefined);
      const decision = decisionFor(item, fit, input.profile);
      const quantityToBuy = quantityFor(decision, desiredQuantity, item.price ?? null, input.maxBudgetCents ?? null);
      return {
        id: recommendationId(item, index),
        item,
        fit,
        decision,
        role: "contender" as const,
        acquisitionPriority: acquisitionPriority(fit.score, decision),
        quantityToBuy,
        spendCents: item.price != null && quantityToBuy ? Math.round(item.price * 100) * quantityToBuy : null,
        why: whyFor(item, fit, decision),
      } satisfies ShoppingRecommendation;
    })
    .sort((a, b) => (b.decision === "Buy Now" ? 1000 : b.decision === "Consider" ? 500 : 0) + b.fit.score - ((a.decision === "Buy Now" ? 1000 : a.decision === "Consider" ? 500 : 0) + a.fit.score));

  const withRoles = applyRoles(recommendations);
  const buyable = withRoles.filter((row) => row.decision !== "Skip");
  const bestBuy = buyable[0] ?? null;
  const bestValue = [...buyable].filter((row) => row.item.price).sort((a, b) => (b.fit.score / (b.item.price || 1)) - (a.fit.score / (a.item.price || 1)))[0] ?? null;
  const splurge = [...buyable].filter((row) => (row.item.price ?? 0) >= 150).sort((a, b) => b.fit.score - a.fit.score)[0] ?? null;
  const skip = withRoles.find((row) => row.decision === "Skip") ?? null;
  const estimatedSpendCents = withRoles.filter((row) => row.decision === "Buy Now").reduce((sum, row) => sum + (row.spendCents ?? 0), 0);
  const unboundedBuyNowSpendCents = withRoles
    .filter((row) => row.decision === "Buy Now" && row.item.price != null)
    .reduce((sum, row) => sum + Math.round((row.item.price ?? 0) * 100) * desiredQuantity, 0);
  const budgetWarning = input.maxBudgetCents && unboundedBuyNowSpendCents > input.maxBudgetCents ? `Desired buy-now quantity exceeds the ${formatCents(input.maxBudgetCents)} budget; quantities were clipped.` : null;
  const shoppingBrief = bestBuy ? `Buy ${bestBuy.quantityToBuy} × ${[bestBuy.item.vintage, bestBuy.item.producer, bestBuy.item.label].filter(Boolean).join(" ")} from ${input.retailer ?? "this retailer"}.` : "No confident shopping buy emerged from this list.";
  return {
    retailer: input.retailer ?? null,
    headline: bestBuy ? `Buy the ${[bestBuy.item.vintage, bestBuy.item.producer, bestBuy.item.label].filter(Boolean).join(" ")}.` : "Keep shopping; no clean buy-now target emerged.",
    shoppingBrief,
    budgetWarning,
    summary: {
      total: withRoles.length,
      buyNow: withRoles.filter((row) => row.decision === "Buy Now").length,
      consider: withRoles.filter((row) => row.decision === "Consider").length,
      skip: withRoles.filter((row) => row.decision === "Skip").length,
      estimatedSpendCents,
    },
    picks: {
      bestBuy,
      bestValue,
      splurge,
      skip,
    },
    recommendations: withRoles,
  };
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function shoppingPickToAcquisitionTarget(recommendation: ShoppingRecommendation, retailer?: string | null): AcquisitionTargetPayload {
  const item = recommendation.item;
  const priceCents = item.price != null ? Math.round(item.price * 100) : null;
  return {
    wineTitle: [item.vintage, item.producer, item.label].filter(Boolean).join(" "),
    producer: item.producer ?? null,
    vintage: item.vintage ?? null,
    region: item.region ?? null,
    varietal: item.varietal ?? null,
    sourceKind: "shopping",
    status: recommendation.decision === "Buy Now" ? "buy_now" : "watching",
    priority: recommendation.acquisitionPriority,
    desiredQuantity: Math.max(1, recommendation.quantityToBuy || 1),
    targetPriceCents: priceCents,
    maxPriceCents: priceCents != null ? Math.round(priceCents * 1.2) : null,
    nextRefreshAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    notes: `Shopping Mode${retailer ? ` · ${retailer}` : ""}: ${recommendation.why.slice(0, 2).join(" ")}`,
  };
}
