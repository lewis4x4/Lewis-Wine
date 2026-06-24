export type BuyAgainStatus = "active" | "watch" | "acquired" | "dismissed";
export type BuyAgainAction = "buy-now" | "watch" | "acquired" | "dismissed";
export type Availability = "in_stock" | "limited" | "unknown" | "oos";

export type BuyAgainWine = {
  producer?: string | null;
  label?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
};

export type BuyAgainObservation = {
  id: string;
  source_name: string;
  source_url: string | null;
  price: number;
  currency: string;
  availability: Availability;
  confidence: number;
  observed_at: string;
};

export type BuyAgainQueueRow = {
  id: string;
  wine_id: string;
  status: BuyAgainStatus;
  target_price?: number | null;
  updated_at?: string | null;
  added_at?: string | null;
  acquired_at?: string | null;
  dismissed_at?: string | null;
  snoozed_until?: string | null;
  note?: string | null;
  wine: BuyAgainWine;
  best_observation: BuyAgainObservation | null;
  observations: BuyAgainObservation[];
};

export type BuyAgainCommandItem = {
  id: string;
  wineId: string;
  title: string;
  subtitle: string;
  status: BuyAgainStatus;
  lane: "buyNow" | "watch" | "acquired" | "dismissed";
  targetPriceLabel: string;
  bestPriceLabel: string;
  sourceLabel: string;
  sourceUrl: string | null;
  availabilityLabel: string;
  confidenceLabel: string;
  priceHistory: Array<{ id: string; priceLabel: string; sourceLabel: string; observedAtLabel: string; confidenceLabel: string }>;
  reasons: string[];
  cta: { label: string; action: BuyAgainAction };
};

export type BuyAgainCommandCenter = {
  summary: {
    totalActive: number;
    buyNowCount: number;
    watchCount: number;
    acquiredCount: number;
    dismissedCount: number;
    bestBuyNowPrice: number | null;
  };
  lanes: {
    buyNow: BuyAgainCommandItem[];
    watch: BuyAgainCommandItem[];
    acquired: BuyAgainCommandItem[];
    dismissed: BuyAgainCommandItem[];
  };
};

function money(value?: number | null, currency = "USD") {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function confidenceLabel(confidence?: number | null) {
  if (confidence == null) return "unknown confidence";
  if (confidence >= 0.8) return "high confidence";
  if (confidence >= 0.6) return "medium confidence";
  return "low confidence";
}

function availabilityLabel(value?: Availability | null) {
  return (value ?? "unknown").replace(/_/g, " ");
}

function titleFor(wine: BuyAgainWine) {
  return [wine.vintage, wine.producer, wine.label ?? wine.varietal].filter(Boolean).join(" ") || "Unnamed wine";
}

function subtitleFor(wine: BuyAgainWine) {
  return [wine.region, wine.varietal].filter(Boolean).join(" · ") || "Buy Again candidate";
}

function observationSort(a: BuyAgainObservation, b: BuyAgainObservation) {
  const availabilityWeight: Record<Availability, number> = { in_stock: 0, limited: 1, unknown: 2, oos: 3 };
  return availabilityWeight[a.availability] - availabilityWeight[b.availability]
    || a.price - b.price
    || b.confidence - a.confidence
    || new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime();
}

function bestObservation(row: BuyAgainQueueRow) {
  const candidates = [row.best_observation, ...row.observations].filter(Boolean) as BuyAgainObservation[];
  const buyable = candidates.filter((observation) => observation.availability === "in_stock" || observation.availability === "limited");
  return [...(buyable.length ? buyable : candidates)].sort(observationSort)[0] ?? null;
}

function chooseLane(row: BuyAgainQueueRow, best: BuyAgainObservation | null, asOf: Date): BuyAgainCommandItem["lane"] {
  if (row.status === "acquired") return "acquired";
  if (row.status === "dismissed") return "dismissed";
  if (row.status === "watch") return "watch";
  if (row.snoozed_until && new Date(row.snoozed_until).getTime() > asOf.getTime()) return "watch";
  if (!best) return "watch";
  const buyable = best.availability === "in_stock" || best.availability === "limited";
  const underTarget = row.target_price == null || best.price <= row.target_price;
  const trustedEnough = best.confidence >= 0.6;
  return buyable && underTarget && trustedEnough ? "buyNow" : "watch";
}

function ctaFor(lane: BuyAgainCommandItem["lane"]): BuyAgainCommandItem["cta"] {
  if (lane === "buyNow") return { label: "Buy now", action: "buy-now" };
  if (lane === "watch") return { label: "Keep watching", action: "watch" };
  if (lane === "acquired") return { label: "Acquired", action: "acquired" };
  return { label: "Dismissed", action: "dismissed" };
}

function reasonsFor(row: BuyAgainQueueRow, lane: BuyAgainCommandItem["lane"], best: BuyAgainObservation | null) {
  const reasons: string[] = [];
  if (!best) return ["No price evidence has been accepted yet."];
  if (row.target_price != null && best.price <= row.target_price) reasons.push(`${money(best.price, best.currency)} is below target ${money(row.target_price, best.currency)}.`);
  if (best.availability === "in_stock" || best.availability === "limited") reasons.push(`${best.source_name} currently reports ${availabilityLabel(best.availability)}.`);
  if (best.confidence >= 0.8) reasons.push("Evidence confidence is strong enough for action.");
  if (lane === "watch" && row.target_price != null && best.price > row.target_price) reasons.push(`${money(best.price, best.currency)} is above target ${money(row.target_price, best.currency)}.`);
  if (lane === "watch" && best.confidence < 0.6) reasons.push("Evidence confidence is too thin for a buy-now call.");
  return reasons;
}

function priceHistory(row: BuyAgainQueueRow) {
  return [...row.observations]
    .sort((a, b) => new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime())
    .slice(0, 6)
    .map((observation) => ({
      id: observation.id,
      priceLabel: money(observation.price, observation.currency),
      sourceLabel: observation.source_name,
      observedAtLabel: new Date(observation.observed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      confidenceLabel: confidenceLabel(observation.confidence),
    }));
}

function toItem(row: BuyAgainQueueRow, asOf: Date): BuyAgainCommandItem {
  const best = bestObservation(row);
  const lane = chooseLane(row, best, asOf);
  return {
    id: row.id,
    wineId: row.wine_id,
    title: titleFor(row.wine),
    subtitle: subtitleFor(row.wine),
    status: row.status,
    lane,
    targetPriceLabel: money(row.target_price, best?.currency ?? "USD"),
    bestPriceLabel: money(best?.price, best?.currency ?? "USD"),
    sourceLabel: best?.source_name ?? "No accepted source",
    sourceUrl: best?.source_url ?? null,
    availabilityLabel: availabilityLabel(best?.availability),
    confidenceLabel: confidenceLabel(best?.confidence),
    priceHistory: priceHistory(row),
    reasons: reasonsFor(row, lane, best),
    cta: ctaFor(lane),
  };
}

export function buildBuyAgainCommandCenter(rows: BuyAgainQueueRow[], options: { asOf?: Date } = {}): BuyAgainCommandCenter {
  const asOf = options.asOf ?? new Date();
  const items = rows.map((row) => toItem(row, asOf));
  const lanes = {
    buyNow: items.filter((item) => item.lane === "buyNow"),
    watch: items.filter((item) => item.lane === "watch"),
    acquired: items.filter((item) => item.lane === "acquired"),
    dismissed: items.filter((item) => item.lane === "dismissed"),
  };
  return {
    summary: {
      totalActive: lanes.buyNow.length + lanes.watch.length,
      buyNowCount: lanes.buyNow.length,
      watchCount: lanes.watch.length,
      acquiredCount: lanes.acquired.length,
      dismissedCount: lanes.dismissed.length,
      bestBuyNowPrice: lanes.buyNow.reduce<number | null>((best, item) => {
        const numeric = Number(item.bestPriceLabel.replace(/[^0-9.]/g, ""));
        if (!Number.isFinite(numeric)) return best;
        return best == null ? numeric : Math.min(best, numeric);
      }, null),
    },
    lanes,
  };
}

export function nextBuyAgainStatus(action: BuyAgainAction, now = new Date()): { status: BuyAgainStatus; acquired_at: string | null; dismissed_at: string | null } {
  if (action === "acquired") return { status: "acquired", acquired_at: now.toISOString(), dismissed_at: null };
  if (action === "dismissed") return { status: "dismissed", acquired_at: null, dismissed_at: now.toISOString() };
  if (action === "watch") return { status: "watch", acquired_at: null, dismissed_at: null };
  return { status: "active", acquired_at: null, dismissed_at: null };
}
