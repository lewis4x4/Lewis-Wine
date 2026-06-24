import { brianFitScore, type AdvisorLineItem, type BrianFitResult, type TasteProfile } from "./pourfolio-intelligence";

export type RestaurantDecision = "Pour" | "Consider" | "Skip";
export type RestaurantConfidence = "High" | "Medium" | "Low";

export type RestaurantRecommendation = {
  id: string;
  item: AdvisorLineItem;
  fit: BrianFitResult;
  decision: RestaurantDecision;
  role: "best_bottle" | "best_value" | "splurge" | "skip" | "contender";
  confidence: { label: RestaurantConfidence; score: number; explanation: string };
  why: string[];
  askSomm?: string;
};

export type RestaurantModeInput = {
  restaurant?: string | null;
  cuisine?: string | null;
  context?: string | null;
  profile: TasteProfile;
  items: AdvisorLineItem[];
};

export type RestaurantModeResult = {
  restaurant?: string | null;
  headline: string;
  summary: { total: number; pour: number; consider: number; skip: number };
  picks: {
    bestBottleTonight: RestaurantRecommendation | null;
    bestValue: RestaurantRecommendation | null;
    splurgePick: RestaurantRecommendation | null;
    skip: RestaurantRecommendation | null;
  };
  sommQuestion: string;
  recommendations: RestaurantRecommendation[];
};

const PRODUCER_WORDS = new Set(["domaine", "chateau", "château", "clos", "bodega", "bodegas", "estate", "cellars", "winery", "vineyard", "vineyards"]);

function clean(value: string) {
  return value.replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
}

function priceFromLine(line: string): number | null {
  const matches = [...line.matchAll(/(?:\$\s*)?(\d{2,4})(?:\.\d{2})?(?=\s*$)/g)];
  if (!matches.length) return null;
  const value = Number(matches[matches.length - 1][1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function vintageFromLine(line: string): number | null {
  const match = line.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function inferVarietal(text: string): string | null {
  const lowered = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/cabernet|cab\b/, "Cabernet Sauvignon"],
    [/pinot noir/, "Pinot Noir"],
    [/merlot/, "Merlot"],
    [/malbec/, "Malbec"],
    [/syrah|shiraz/, "Syrah"],
    [/chardonnay/, "Chardonnay"],
    [/sauvignon blanc/, "Sauvignon Blanc"],
    [/riesling/, "Riesling"],
    [/champagne|sparkling/, "Sparkling"],
  ];
  return rules.find(([regex]) => regex.test(lowered))?.[1] ?? null;
}

function inferRegion(text: string): string | null {
  const lowered = text.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/mendoza/, "Mendoza"],
    [/napa/, "Napa Valley"],
    [/willamette/, "Willamette Valley"],
    [/bordeaux/, "Bordeaux"],
    [/burgundy|bourgogne/, "Burgundy"],
    [/barolo|piedmont|piemonte/, "Piedmont"],
    [/rioja/, "Rioja"],
    [/tuscany|toscana|chianti|brunello/, "Tuscany"],
    [/sonoma/, "Sonoma"],
  ];
  return rules.find(([regex]) => regex.test(lowered))?.[1] ?? null;
}

function descriptorsFor(varietal?: string | null, region?: string | null, raw?: string): string[] {
  const haystack = `${varietal ?? ""} ${region ?? ""} ${raw ?? ""}`.toLowerCase();
  const descriptors: string[] = [];
  if (/cabernet|malbec|mendoza|napa/.test(haystack)) descriptors.push("black fruit", "structured", "smooth", "rich");
  if (/pinot/.test(haystack)) descriptors.push("silky", "red fruit", "bright");
  if (/merlot/.test(haystack)) descriptors.push("plush");
  if (/chardonnay/.test(haystack)) descriptors.push("creamy", "citrus");
  return [...new Set(descriptors)];
}

function inferValueFlag(price: number | null): AdvisorLineItem["valueFlag"] {
  if (!price) return "fair";
  if (price >= 200) return "overpriced";
  return "fair";
}

function parseProducerAndLabel(text: string, vintage: number | null, price: number | null, region: string | null, varietal: string | null) {
  let working = text;
  if (vintage) working = working.replace(String(vintage), " ");
  if (price) working = working.replace(new RegExp(`(?:\\$\\s*)?${price}(?:\\.00)?\\s*$`), " ");
  if (region) working = working.replace(new RegExp(`\\b${region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), " ");
  working = clean(working.replace(/[,|-]/g, " "));
  const tokens = working.split(" ").filter(Boolean);
  if (!tokens.length) return { producer: null, label: text };

  let producerLength = 1;
  const first = tokens[0]?.toLowerCase();
  if (first === "lewis" && tokens[1]?.toLowerCase() === "cellars") producerLength = 2;
  else if (first === "willamette" && tokens[1]?.toLowerCase() === "fixture") producerLength = 2;
  else if (tokens[1] && PRODUCER_WORDS.has(tokens[1].toLowerCase())) producerLength = 2;
  const producer = tokens.slice(0, producerLength).join(" ");
  const label = clean(tokens.slice(producerLength).join(" ") || varietal || text);
  return { producer, label };
}

export function parseRestaurantWineText(text: string): AdvisorLineItem[] {
  return text
    .split(/\n+/)
    .map(clean)
    .filter((line) => line.length > 5 && !/^\s*(red|white|sparkling|by the glass)\s*$/i.test(line))
    .map((line) => {
      const price = priceFromLine(line);
      const vintage = vintageFromLine(line);
      const varietal = inferVarietal(line);
      const region = inferRegion(line);
      const { producer, label } = parseProducerAndLabel(line, vintage, price, region, varietal);
      return {
        producer,
        label,
        vintage,
        varietal,
        region,
        price,
        descriptors: descriptorsFor(varietal, region, line),
        readiness: vintage && vintage <= 2021 ? "drink_now" : "unknown",
        valueFlag: inferValueFlag(price),
      } satisfies AdvisorLineItem;
    });
}

function decisionFromFit(fit: BrianFitResult): RestaurantDecision {
  if (fit.tier === "pour") return "Pour";
  if (fit.tier === "consider") return "Consider";
  if (!fit.reasons.some((reason) => /^Skip:/i.test(reason))) return "Consider";
  return "Skip";
}

function confidenceFor(item: AdvisorLineItem, fit: BrianFitResult, profile: TasteProfile): RestaurantRecommendation["confidence"] {
  let score = 30;
  if (item.producer) score += 10;
  if (item.vintage) score += 8;
  if (item.region) score += 8;
  if (item.varietal) score += 8;
  if (item.price) score += 8;
  if ((item.descriptors ?? []).length) score += 8;
  if (profile.benchmarkWineIds.length) score += 10;
  if (fit.score >= 72 || fit.score <= 20) score += 10;
  score = Math.max(0, Math.min(100, score));
  const label: RestaurantConfidence = score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
  const explanation = label === "High" ? "enough identity, price, and profile signal for a confident recommendation" : label === "Medium" ? "some useful signals, but confirm details with the somm" : "thin list data; treat as directional only";
  return { label, score, explanation };
}

function recommendationId(item: AdvisorLineItem, index: number) {
  return [item.vintage, item.producer, item.label, index].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function enrichWhy(item: AdvisorLineItem, fit: BrianFitResult, profile: TasteProfile): string[] {
  const why = [...fit.reasons];
  const producerLabel = item.producer ?? "";
  const producerMatch = Boolean(producerLabel) && profile.preferredProducers.some((producer) => producerLabel.toLowerCase().includes(producer.toLowerCase()) || producer.toLowerCase().includes(producerLabel.toLowerCase()));
  if (producerMatch) why.unshift(`${producerLabel} tracks with Brian's benchmark-producer lane.`);
  const regionLabel = item.region ?? "";
  const varietalLabel = item.varietal ?? "";
  if (regionLabel && profile.preferredRegions.some((region) => regionLabel.toLowerCase().includes(region.toLowerCase()))) why.push(`${regionLabel} is already a proven region in the Taste Genome.`);
  if (varietalLabel && profile.preferredVarietals.some((varietal) => varietalLabel.toLowerCase().includes(varietal.toLowerCase()))) why.push(`${varietalLabel} matches Brian's strongest varietal signal.`);
  return [...new Set(why)].slice(0, 5);
}

function askSommFor(item: AdvisorLineItem | null, cuisine?: string | null) {
  if (!item) return "Can you send or photograph the wine list so Pourfolio can rank it against Brian's Taste Genome?";
  const name = [item.vintage, item.producer, item.label].filter(Boolean).join(" ");
  const identity = [item.region, item.varietal].filter(Boolean).join(" / ");
  const context = cuisine ? ` for ${cuisine}` : " tonight";
  return `Ask the somm: “How is the ${name} showing right now${context}, and is there anything else in the ${identity || "same lane"} lane you would pour over it?”`;
}

export function buildRestaurantMode(input: RestaurantModeInput): RestaurantModeResult {
  if (!input.items.length) {
    return {
      restaurant: input.restaurant ?? null,
      headline: "Upload or paste a wine list to get a Pourfolio read.",
      summary: { total: 0, pour: 0, consider: 0, skip: 0 },
      picks: { bestBottleTonight: null, bestValue: null, splurgePick: null, skip: null },
      sommQuestion: askSommFor(null, input.cuisine),
      recommendations: [],
    };
  }

  const recommendations = input.items
    .map((item, index) => {
      const fit = brianFitScore(item, input.profile, input.cuisine);
      const decision = decisionFromFit(fit);
      return {
        id: recommendationId(item, index),
        item,
        fit,
        decision,
        role: "contender" as const,
        confidence: confidenceFor(item, fit, input.profile),
        why: enrichWhy(item, fit, input.profile),
      };
    })
    .sort((a, b) => b.fit.score - a.fit.score || (a.item.price ?? 9999) - (b.item.price ?? 9999));

  const pourCandidates = recommendations.filter((row) => row.decision === "Pour");
  const bestBottleTonight = pourCandidates[0] ?? recommendations.find((row) => row.decision === "Consider") ?? recommendations[0] ?? null;
  const bestValue = [...recommendations]
    .filter((row) => row.decision !== "Skip" && row.item.price)
    .sort((a, b) => (b.fit.score / (b.item.price || 1)) - (a.fit.score / (a.item.price || 1)))[0] ?? null;
  const splurgePick = [...recommendations]
    .filter((row) => row.decision !== "Skip" && (row.item.price ?? 0) >= (input.profile.priceBand.typical ?? 100))
    .sort((a, b) => b.fit.score - a.fit.score || (b.item.price ?? 0) - (a.item.price ?? 0))[0] ?? null;
  const skip = recommendations.find((row) => row.decision === "Skip") ?? null;

  const withRoles = recommendations.map((row) => ({
    ...row,
    role: row.id === bestBottleTonight?.id ? "best_bottle" as const
      : row.id === bestValue?.id ? "best_value" as const
      : row.id === splurgePick?.id ? "splurge" as const
      : row.id === skip?.id ? "skip" as const
      : "contender" as const,
    askSomm: row.id === bestBottleTonight?.id ? askSommFor(row.item, input.cuisine) : undefined,
  }));

  const display = bestBottleTonight ? [bestBottleTonight.item.vintage, bestBottleTonight.item.producer, bestBottleTonight.item.label].filter(Boolean).join(" ") : null;
  const summary = {
    total: recommendations.length,
    pour: recommendations.filter((row) => row.decision === "Pour").length,
    consider: recommendations.filter((row) => row.decision === "Consider").length,
    skip: recommendations.filter((row) => row.decision === "Skip").length,
  };

  return {
    restaurant: input.restaurant ?? null,
    headline: display ? `Pour the ${display}.` : "No confident pour emerged from this list.",
    summary,
    picks: {
      bestBottleTonight: withRoles.find((row) => row.id === bestBottleTonight?.id) ?? null,
      bestValue: withRoles.find((row) => row.id === bestValue?.id) ?? null,
      splurgePick: withRoles.find((row) => row.id === splurgePick?.id) ?? null,
      skip: withRoles.find((row) => row.id === skip?.id) ?? null,
    },
    sommQuestion: askSommFor(bestBottleTonight?.item ?? null, input.cuisine),
    recommendations: withRoles,
  };
}
