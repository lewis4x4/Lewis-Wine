export type WineWindowInput = {
  drink_after?: string | null;
  drink_before?: string | null;
};

export type WineReadinessState = "hold" | "ready" | "drink_soon" | "past_peak" | "unknown";
export type WineWindowDisplayStatus = "early" | "ready" | "late";

export type WineWindowDisplay = {
  progress: number;
  status: WineWindowDisplayStatus;
  label: string;
  windowStart: number;
  windowEnd: number;
};

const DEFAULT_DRINK_SOON_YEARS = 2;
const DEFAULT_OPEN_ENDED_WINDOW_YEARS = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseWineWindowYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  return Number.isFinite(year) ? year : null;
}

function getCurrentYear(asOf: Date) {
  return asOf.getFullYear();
}

export function getWineReadiness(
  wine: WineWindowInput,
  options: { asOf?: Date; drinkSoonYears?: number } = {}
): WineReadinessState {
  const asOf = options.asOf ?? new Date();
  const currentYear = getCurrentYear(asOf);
  const drinkSoonYears = options.drinkSoonYears ?? DEFAULT_DRINK_SOON_YEARS;
  const drinkAfterYear = parseWineWindowYear(wine.drink_after);
  const drinkBeforeYear = parseWineWindowYear(wine.drink_before);

  if (drinkBeforeYear != null && currentYear > drinkBeforeYear) return "past_peak";
  if (drinkAfterYear != null && currentYear < drinkAfterYear) return "hold";
  if (drinkBeforeYear != null && drinkBeforeYear - currentYear <= drinkSoonYears) return "drink_soon";
  if (drinkAfterYear != null || drinkBeforeYear != null) return "ready";
  return "unknown";
}

export function isWineReadyNow(wine: WineWindowInput, options: { asOf?: Date; drinkSoonYears?: number } = {}) {
  const readiness = getWineReadiness(wine, options);
  return readiness === "ready" || readiness === "drink_soon";
}

export function getWineWindowDisplay(
  wine: WineWindowInput,
  options: { asOf?: Date; openEndedWindowYears?: number } = {}
): WineWindowDisplay | null {
  const asOf = options.asOf ?? new Date();
  const currentYear = getCurrentYear(asOf);
  const drinkAfterYear = parseWineWindowYear(wine.drink_after);
  const drinkBeforeYear = parseWineWindowYear(wine.drink_before);

  if (drinkAfterYear == null && drinkBeforeYear == null) return null;

  const windowStart = drinkAfterYear ?? currentYear;
  const windowEnd = drinkBeforeYear ?? windowStart + (options.openEndedWindowYears ?? DEFAULT_OPEN_ENDED_WINDOW_YEARS);
  const windowLength = windowEnd - windowStart;
  const yearsIntoWindow = currentYear - windowStart;
  const progress = windowLength > 0 ? Math.min(100, Math.max(0, Math.round((yearsIntoWindow / windowLength) * 100))) : 50;

  if (drinkAfterYear != null && currentYear < drinkAfterYear) {
    return {
      progress,
      status: "early",
      label: `Ready from ${drinkAfterYear}`,
      windowStart,
      windowEnd,
    };
  }

  if (drinkBeforeYear != null && currentYear > drinkBeforeYear) {
    return {
      progress,
      status: "late",
      label: drinkAfterYear != null ? `${drinkAfterYear}-${drinkBeforeYear}` : `Until ${drinkBeforeYear}`,
      windowStart,
      windowEnd,
    };
  }

  return {
    progress,
    status: "ready",
    label: drinkAfterYear != null && drinkBeforeYear != null
      ? `${drinkAfterYear}-${drinkBeforeYear}`
      : drinkAfterYear != null
        ? `Ready from ${drinkAfterYear}`
        : `Until ${drinkBeforeYear}`,
    windowStart,
    windowEnd,
  };
}

export function isWineApproachingPeak(
  wine: Pick<WineWindowInput, "drink_before">,
  options: { asOf?: Date; withinDays?: number } = {}
) {
  if (!wine.drink_before) return false;
  const asOf = options.asOf ?? new Date();
  const withinDays = options.withinDays ?? 30;
  const drinkBefore = new Date(wine.drink_before);
  if (Number.isNaN(drinkBefore.getTime())) return false;
  const daysUntilPeak = (drinkBefore.getTime() - asOf.getTime()) / MS_PER_DAY;
  return daysUntilPeak > 0 && daysUntilPeak <= withinDays;
}
