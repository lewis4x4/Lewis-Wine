export type CellarCommandWine = {
  id: string;
  name?: string | null;
  custom_name?: string | null;
  producer?: string | null;
  custom_producer?: string | null;
  region?: string | null;
  custom_region?: string | null;
  vintage?: number | null;
  custom_vintage?: number | null;
  quantity: number;
  drink_after?: string | null;
  drink_before?: string | null;
  purchase_price_cents?: number | null;
  current_market_value_cents?: number | null;
  low_stock_threshold?: number | null;
  low_stock_alert_enabled?: boolean | null;
  ratings_count?: number | null;
  brian_fit_score?: number | null;
  brian_fit_confidence?: number | null;
  brian_fit_reason?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
};

export type CellarCommandItem = CellarCommandWine & {
  displayName: string;
  producerName: string | null;
  regionName: string | null;
  readiness: "ready" | "drink_soon" | "past_peak" | "hold" | "unknown";
  urgency: number;
  action: string;
  reason: string;
  href: string;
  estimatedValueCents: number | null;
};

export type CellarCommandCenter = {
  metrics: {
    totalBottles: number;
    uniqueWines: number;
    readyNow: number;
    drinkSoon: number;
    pastPeak: number;
    replace: number;
    needsSignal: number;
    highBrianFit: number;
    estimatedValueCents: number;
  };
  lanes: {
    drinkNow: CellarCommandItem[];
    atRisk: CellarCommandItem[];
    replace: CellarCommandItem[];
    learn: CellarCommandItem[];
    hold: CellarCommandItem[];
  };
  executiveBrief: string;
  bestNextMove: string;
};

const HIGH_BRIAN_FIT = 92;
const DRINK_SOON_YEARS = 2;

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function parseCellarYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const yearMatch = value.match(/\d{4}/);
  if (!yearMatch) return null;
  const year = Number.parseInt(yearMatch[0], 10);
  return Number.isFinite(year) ? year : null;
}

function getCurrentYear(asOf: Date) {
  return asOf.getFullYear();
}

export function getCellarCommandWineName(wine: Pick<CellarCommandWine, "name" | "custom_name" | "vintage" | "custom_vintage">) {
  const name = wine.name || wine.custom_name || "Unknown wine";
  const vintage = wine.vintage || wine.custom_vintage;
  return vintage ? `${vintage} ${name}` : name;
}

function getProducerName(wine: CellarCommandWine) {
  return wine.producer || wine.custom_producer || null;
}

function getRegionName(wine: CellarCommandWine) {
  return wine.region || wine.custom_region || null;
}

function getEstimatedValueCents(wine: CellarCommandWine) {
  const unitValue = wine.current_market_value_cents ?? wine.purchase_price_cents ?? null;
  return unitValue == null ? null : unitValue * Math.max(wine.quantity, 0);
}

function getReadiness(wine: CellarCommandWine, asOf: Date): CellarCommandItem["readiness"] {
  const currentYear = getCurrentYear(asOf);
  const drinkAfterYear = parseCellarYear(wine.drink_after);
  const drinkBeforeYear = parseCellarYear(wine.drink_before);

  if (drinkBeforeYear != null && currentYear > drinkBeforeYear) return "past_peak";
  if (drinkBeforeYear != null && currentYear <= drinkBeforeYear && drinkBeforeYear - currentYear <= DRINK_SOON_YEARS) {
    return "drink_soon";
  }
  if (drinkAfterYear != null && currentYear < drinkAfterYear) return "hold";
  if (drinkAfterYear != null || drinkBeforeYear != null) return "ready";
  return "unknown";
}

function getUrgency(wine: CellarCommandWine, readiness: CellarCommandItem["readiness"], asOf: Date) {
  const currentYear = getCurrentYear(asOf);
  const fitScore = wine.brian_fit_score ?? 0;
  const drinkBeforeYear = parseCellarYear(wine.drink_before);
  const ratingsCount = wine.ratings_count ?? 0;
  const lowStock = isReplaceCandidate(wine);

  let urgency = 0;
  if (readiness === "past_peak") urgency += 100;
  if (readiness === "drink_soon") urgency += 80;
  if (readiness === "ready") urgency += 55;
  if (lowStock) urgency += 45;
  if (ratingsCount === 0) urgency += 20;
  if (fitScore >= HIGH_BRIAN_FIT) urgency += 16;
  if (drinkBeforeYear != null) urgency += Math.max(0, 12 - Math.abs(drinkBeforeYear - currentYear));
  urgency += Math.min(wine.quantity, 6);
  return urgency;
}

function isReplaceCandidate(wine: CellarCommandWine) {
  if (wine.quantity <= 0) return false;
  if (wine.low_stock_alert_enabled && wine.low_stock_threshold != null && wine.quantity <= wine.low_stock_threshold) {
    return true;
  }
  return wine.quantity === 1 && (wine.brian_fit_score ?? 0) >= HIGH_BRIAN_FIT;
}

function getActionAndReason(wine: CellarCommandWine, readiness: CellarCommandItem["readiness"]) {
  const name = getCellarCommandWineName(wine);
  const fitScore = wine.brian_fit_score;
  const hasSignal = (wine.ratings_count ?? 0) > 0;

  if (readiness === "past_peak") {
    return {
      action: `Decide on ${name}`,
      reason: "Past its stated window; open, gift, or update the window before it becomes dead inventory.",
    };
  }

  if (readiness === "drink_soon") {
    return {
      action: `Prioritize ${name}`,
      reason: "Inside the short end of its drinking window, so tonight value is higher than storage value.",
    };
  }

  if (readiness === "ready") {
    return {
      action: `Open ${name}`,
      reason: fitScore != null && fitScore >= HIGH_BRIAN_FIT
        ? `Ready now with a ${fitScore} Brian-Fit read.`
        : "Ready now; use dinner, mood, and tasting memory to choose confidently.",
    };
  }

  if (!hasSignal) {
    return {
      action: `Capture signal on ${name}`,
      reason: "The bottle lacks first-party tasting memory, which limits Brian-Fit confidence.",
    };
  }

  if (readiness === "hold") {
    return {
      action: `Hold ${name}`,
      reason: "Still before its drinking window; keep it out of tonight's decision set.",
    };
  }

  return {
    action: `Tighten ${name}`,
    reason: "Missing a drink window, so the system cannot yet make a strong readiness call.",
  };
}

function toCommandItem(wine: CellarCommandWine, asOf: Date): CellarCommandItem {
  const readiness = getReadiness(wine, asOf);
  const action = getActionAndReason(wine, readiness);

  return {
    ...wine,
    displayName: getCellarCommandWineName(wine),
    producerName: getProducerName(wine),
    regionName: getRegionName(wine),
    readiness,
    urgency: getUrgency(wine, readiness, asOf),
    action: action.action,
    reason: action.reason,
    href: `/cellar/${wine.id}`,
    estimatedValueCents: getEstimatedValueCents(wine),
  };
}

function byCommandPriority(a: CellarCommandItem, b: CellarCommandItem) {
  return b.urgency - a.urgency || (b.brian_fit_score ?? 0) - (a.brian_fit_score ?? 0) || a.displayName.localeCompare(b.displayName);
}

export function buildCellarCommandCenter(
  wines: CellarCommandWine[],
  options: { asOf?: Date; laneLimit?: number } = {}
): CellarCommandCenter {
  const asOf = options.asOf ?? new Date();
  const laneLimit = options.laneLimit ?? 6;
  const items = wines
    .filter((wine) => wine.quantity > 0)
    .map((wine) => toCommandItem(wine, asOf))
    .sort(byCommandPriority);

  const replaceItems = items.filter((wine) => isReplaceCandidate(wine)).sort(byCommandPriority);
  const learnItems = items
    .filter((wine) => (wine.ratings_count ?? 0) === 0)
    .sort(byCommandPriority);

  const lanes = {
    drinkNow: items
      .filter((wine) => wine.readiness === "ready" || wine.readiness === "drink_soon")
      .sort(byCommandPriority)
      .slice(0, laneLimit),
    atRisk: items
      .filter((wine) => wine.readiness === "past_peak")
      .sort(byCommandPriority)
      .slice(0, laneLimit),
    replace: replaceItems.slice(0, laneLimit),
    learn: learnItems.slice(0, laneLimit),
    hold: items
      .filter((wine) => wine.readiness === "hold")
      .sort(byCommandPriority)
      .slice(0, laneLimit),
  };

  const metrics = {
    totalBottles: items.reduce((sum, wine) => sum + wine.quantity, 0),
    uniqueWines: items.length,
    readyNow: items.filter((wine) => wine.readiness === "ready" || wine.readiness === "drink_soon").length,
    drinkSoon: items.filter((wine) => wine.readiness === "drink_soon").length,
    pastPeak: items.filter((wine) => wine.readiness === "past_peak").length,
    replace: replaceItems.length,
    needsSignal: learnItems.length,
    highBrianFit: items.filter((wine) => (wine.brian_fit_score ?? 0) >= HIGH_BRIAN_FIT).length,
    estimatedValueCents: items.reduce((sum, wine) => sum + (wine.estimatedValueCents ?? 0), 0),
  };

  const executiveBrief = metrics.totalBottles === 0
    ? "No bottles are in the cellar yet. The command center will come alive after the first capture."
    : [
        metrics.pastPeak > 0 ? `${plural(metrics.pastPeak, "bottle")} needs a decision before it drifts further` : null,
        metrics.readyNow > 0 ? `${plural(metrics.readyNow, "bottle")} can be opened with confidence now` : null,
        metrics.replace > 0 ? `${plural(metrics.replace, "bottle")} should be considered for replacement` : null,
        metrics.needsSignal > 0 ? `${plural(metrics.needsSignal, "bottle")} still needs first-party taste signal` : null,
      ].filter(Boolean).join(". ") || "The cellar is stable; the best move is tightening windows and taste signal.";

  const firstPriority = lanes.atRisk[0] ?? lanes.drinkNow[0] ?? lanes.replace[0] ?? lanes.learn[0] ?? lanes.hold[0] ?? null;
  const bestNextMove = firstPriority
    ? `${firstPriority.action}: ${firstPriority.reason}`
    : "Add a bottle or scan a label to give the system something useful to command.";

  return {
    metrics,
    lanes,
    executiveBrief,
    bestNextMove,
  };
}
