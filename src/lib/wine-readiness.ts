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

function parseWindowBoundary(value: string | null | undefined, side: "start" | "end"): Date | null {
  const year = parseWineWindowYear(value);
  if (year == null) return null;

  const trimmed = value?.trim() ?? "";
  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const month = Number.parseInt(isoDate[2], 10) - 1;
    const day = Number.parseInt(isoDate[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return side === "start"
    ? new Date(Date.UTC(year, 0, 1))
    : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

function hasExactIsoDate(value: string | null | undefined) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value?.trim() ?? "");
}

function hasInvertedWindow(wine: WineWindowInput) {
  const start = parseWindowBoundary(wine.drink_after, "start");
  const end = parseWindowBoundary(wine.drink_before, "end");
  return start != null && end != null && start.getTime() > end.getTime();
}

export function getWineReadiness(
  wine: WineWindowInput,
  options: { asOf?: Date; drinkSoonYears?: number } = {}
): WineReadinessState {
  const asOf = options.asOf ?? new Date();
  const drinkSoonYears = options.drinkSoonYears ?? DEFAULT_DRINK_SOON_YEARS;
  const drinkAfter = parseWindowBoundary(wine.drink_after, "start");
  const drinkBefore = parseWindowBoundary(wine.drink_before, "end");

  if (drinkAfter == null && drinkBefore == null) return "unknown";
  if (drinkAfter != null && drinkBefore != null && drinkAfter.getTime() > drinkBefore.getTime()) return "unknown";

  if (drinkBefore != null && asOf.getTime() > drinkBefore.getTime()) return "past_peak";
  if (drinkAfter != null && asOf.getTime() < drinkAfter.getTime()) return "hold";
  if (drinkBefore != null) {
    const isExactEnd = hasExactIsoDate(wine.drink_before);
    const isDrinkSoon = isExactEnd
      ? drinkBefore.getTime() - asOf.getTime() <= drinkSoonYears * 365 * MS_PER_DAY
      : parseWineWindowYear(wine.drink_before)! - getCurrentYear(asOf) <= drinkSoonYears;
    if (isDrinkSoon) return "drink_soon";
  }
  return "ready";
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
  if (hasInvertedWindow(wine)) return null;

  const windowStart = drinkAfterYear ?? currentYear;
  const windowEnd = drinkBeforeYear ?? windowStart + (options.openEndedWindowYears ?? DEFAULT_OPEN_ENDED_WINDOW_YEARS);
  const windowLength = windowEnd - windowStart;
  const yearsIntoWindow = currentYear - windowStart;
  const progress = windowLength > 0 ? Math.min(100, Math.max(0, Math.round((yearsIntoWindow / windowLength) * 100))) : 50;

  const readiness = getWineReadiness(wine, { asOf });
  if (readiness === "hold") {
    return {
      progress,
      status: "early",
      label: `Ready from ${drinkAfterYear}`,
      windowStart,
      windowEnd,
    };
  }

  if (readiness === "past_peak") {
    return {
      progress: 100,
      status: "late",
      label: `Until ${drinkBeforeYear}`,
      windowStart,
      windowEnd,
    };
  }

  return {
    progress,
    status: "ready",
    label: drinkAfterYear != null && drinkBeforeYear != null
      ? `${drinkAfterYear}-${drinkBeforeYear}`
      : drinkBeforeYear != null
        ? `Until ${drinkBeforeYear}`
        : `From ${drinkAfterYear}`,
    windowStart,
    windowEnd,
  };
}

export function isWineApproachingPeak(
  wine: Pick<WineWindowInput, "drink_before">,
  options: { asOf?: Date; withinDays?: number } = {}
) {
  const asOf = options.asOf ?? new Date();
  const withinDays = options.withinDays ?? 180;
  const drinkBefore = parseWindowBoundary(wine.drink_before, "end");
  if (!drinkBefore) return false;

  const daysUntilPeak = (drinkBefore.getTime() - asOf.getTime()) / MS_PER_DAY;
  return daysUntilPeak >= 0 && daysUntilPeak <= withinDays;
}
