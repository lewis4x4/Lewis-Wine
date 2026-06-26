export type WineWindowInput = {
  drink_after?: string | null;
  drink_before?: string | null;
  peak_start?: string | null;
  peak_end?: string | null;
  reference_drink_after?: string | null;
  reference_drink_before?: string | null;
  reference_peak_start?: string | null;
  reference_peak_end?: string | null;
  wine_reference_drink_window_start?: string | null;
  wine_reference_drink_window_end?: string | null;
  wine_reference_peak_start?: string | null;
  wine_reference_peak_end?: string | null;
  drink_window_start?: string | null;
  drink_window_end?: string | null;
};

export type WineReadinessState = "hold" | "ready" | "drink_soon" | "past_peak" | "unknown";
export type WineReadinessPhase =
  | "missing_window"
  | "hold"
  | "entering_window"
  | "ready"
  | "at_peak"
  | "drink_soon"
  | "past_peak"
  | "needs_review";
export type WineReadinessSource = "inventory" | "wine_reference" | "partial" | "missing" | "invalid";
export type WineReadinessConfidence = "source-backed" | "reference-backed" | "partial" | "unknown" | "needs-review";
export type WineReadinessNextAction =
  | "set_drink_window"
  | "review_drink_window"
  | "hold"
  | "prepare_opening"
  | "consider_opening"
  | "open_at_peak"
  | "prioritize_opening"
  | "resolve_past_peak";
export type WineWindowDisplayStatus = "early" | "ready" | "late";

export type WineReadinessProfile = {
  phase: WineReadinessPhase;
  legacyState: WineReadinessState;
  source: WineReadinessSource;
  confidence: WineReadinessConfidence;
  normalizedDrinkAfter: string | null;
  normalizedDrinkBefore: string | null;
  peakStart: string | null;
  peakEnd: string | null;
  daysToStart: number | null;
  daysToPeak: number | null;
  daysToEnd: number | null;
  nextAction: WineReadinessNextAction;
  reason: string;
};

export type WineWindowDisplay = {
  progress: number;
  status: WineWindowDisplayStatus;
  label: string;
  windowStart: number;
  windowEnd: number;
};

const DEFAULT_DRINK_SOON_YEARS = 2;
const DEFAULT_ENTERING_WINDOW_DAYS = 180;
const DEFAULT_OPEN_ENDED_WINDOW_YEARS = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Boundary = {
  raw: string;
  date: Date;
  year: number;
};

type WindowResolution = {
  start: Boundary | null;
  end: Boundary | null;
  peakStart: Boundary | null;
  peakEnd: Boundary | null;
  source: WineReadinessSource;
};

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
    const date = side === "start"
      ? new Date(Date.UTC(year, month, day))
      : new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return side === "start"
    ? new Date(Date.UTC(year, 0, 1))
    : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

function boundary(value: string | null | undefined, side: "start" | "end"): Boundary | null {
  const date = parseWindowBoundary(value, side);
  const year = parseWineWindowYear(value);
  const raw = value?.trim();
  if (!raw || !date || year == null) return null;
  return { raw, date, year };
}

function hasExactIsoDate(value: string | null | undefined) {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(value?.trim() ?? "");
}

function firstValue(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value?.trim())) ?? null;
}

function resolveWindow(wine: WineWindowInput): WindowResolution {
  const inventoryStartRaw = firstValue(wine.drink_after);
  const inventoryEndRaw = firstValue(wine.drink_before);
  const inventoryPeakStartRaw = firstValue(wine.peak_start);
  const inventoryPeakEndRaw = firstValue(wine.peak_end);
  const referenceStartRaw = firstValue(
    wine.wine_reference_drink_window_start,
    wine.reference_drink_after,
    wine.drink_window_start
  );
  const referenceEndRaw = firstValue(
    wine.wine_reference_drink_window_end,
    wine.reference_drink_before,
    wine.drink_window_end
  );
  const referencePeakStartRaw = firstValue(wine.wine_reference_peak_start, wine.reference_peak_start);
  const referencePeakEndRaw = firstValue(wine.wine_reference_peak_end, wine.reference_peak_end);

  const startRaw = inventoryStartRaw ?? referenceStartRaw;
  const endRaw = inventoryEndRaw ?? referenceEndRaw;
  const peakStartRaw = inventoryPeakStartRaw ?? referencePeakStartRaw;
  const peakEndRaw = inventoryPeakEndRaw ?? referencePeakEndRaw;
  const start = boundary(startRaw, "start");
  const end = boundary(endRaw, "end");
  const peakStart = boundary(peakStartRaw, "start");
  const peakEnd = boundary(peakEndRaw, "end");

  let source: WineReadinessSource = "missing";
  if (inventoryStartRaw || inventoryEndRaw) {
    source = "inventory";
  } else if (referenceStartRaw || referenceEndRaw) {
    source = "wine_reference";
  }
  if ((startRaw || endRaw) && (!start || !end)) {
    source = source === "missing" ? "partial" : source;
  }
  if ((start && !end) || (!start && end)) {
    source = source === "missing" ? "partial" : source;
  }

  return { start, end, peakStart, peakEnd, source };
}

function hasInvertedWindow(wine: WineWindowInput) {
  const resolution = resolveWindow(wine);
  return resolution.start != null && resolution.end != null && resolution.start.date.getTime() > resolution.end.date.getTime();
}

function isPeakInvalid(resolution: WindowResolution) {
  const { start, end, peakStart, peakEnd } = resolution;
  if (peakStart && peakEnd && peakStart.date.getTime() > peakEnd.date.getTime()) return true;
  if (start && peakStart && peakStart.date.getTime() < start.date.getTime()) return true;
  if (end && peakEnd && peakEnd.date.getTime() > end.date.getTime()) return true;
  return false;
}

function normalizedBoundary(boundaryValue: Boundary | null, side: "start" | "end") {
  if (!boundaryValue) return null;
  return hasExactIsoDate(boundaryValue.raw)
    ? boundaryValue.raw
    : side === "start"
      ? `${boundaryValue.year}-01-01`
      : `${boundaryValue.year}-12-31`;
}

function daysUntil(asOf: Date, date: Date | null) {
  if (!date) return null;
  return Math.ceil((date.getTime() - asOf.getTime()) / MS_PER_DAY);
}

function isWithinInclusive(asOf: Date, start: Boundary | null, end: Boundary | null) {
  if (!start || !end) return false;
  return asOf.getTime() >= start.date.getTime() && asOf.getTime() <= end.date.getTime();
}

function isDrinkSoon(
  end: Boundary,
  asOf: Date,
  drinkSoonYears: number
) {
  if (hasExactIsoDate(end.raw)) {
    return end.date.getTime() - asOf.getTime() <= drinkSoonYears * 365 * MS_PER_DAY;
  }
  return end.year - getCurrentYear(asOf) <= drinkSoonYears;
}

function confidenceFor(resolution: WindowResolution): WineReadinessConfidence {
  if (!resolution.start && !resolution.end) return "unknown";
  if (!resolution.start || !resolution.end) return "partial";
  if (resolution.source === "wine_reference") return "reference-backed";
  if (resolution.source === "inventory") return "source-backed";
  return "partial";
}

function legacyStateForPhase(phase: WineReadinessPhase): WineReadinessState {
  switch (phase) {
    case "hold":
    case "entering_window":
      return "hold";
    case "ready":
    case "at_peak":
      return "ready";
    case "drink_soon":
      return "drink_soon";
    case "past_peak":
      return "past_peak";
    case "missing_window":
    case "needs_review":
      return "unknown";
  }
}

function nextActionForPhase(phase: WineReadinessPhase): WineReadinessNextAction {
  switch (phase) {
    case "missing_window": return "set_drink_window";
    case "needs_review": return "review_drink_window";
    case "hold": return "hold";
    case "entering_window": return "prepare_opening";
    case "ready": return "consider_opening";
    case "at_peak": return "open_at_peak";
    case "drink_soon": return "prioritize_opening";
    case "past_peak": return "resolve_past_peak";
  }
}

function reasonForPhase(phase: WineReadinessPhase, resolution: WindowResolution) {
  switch (phase) {
    case "missing_window":
      return "No usable drink window is available from inventory or linked reference data.";
    case "needs_review":
      return "Drink-window or peak-band dates conflict and need review before the app should trust them.";
    case "hold":
      return "The bottle is still before its drinking window.";
    case "entering_window":
      return "The bottle is approaching the start of its drinking window.";
    case "ready":
      return resolution.source === "wine_reference"
        ? "Linked reference drink-window evidence says this bottle is ready."
        : "The bottle is inside its drinking window.";
    case "at_peak":
      return "The bottle is inside its modeled peak band.";
    case "drink_soon":
      return "The bottle is near the end of its drinking window.";
    case "past_peak":
      return "The bottle is past its stated drinking window.";
  }
}

export function getWineReadinessProfile(
  wine: WineWindowInput,
  options: { asOf?: Date; drinkSoonYears?: number; enteringWindowDays?: number } = {}
): WineReadinessProfile {
  const asOf = options.asOf ?? new Date();
  const drinkSoonYears = options.drinkSoonYears ?? DEFAULT_DRINK_SOON_YEARS;
  const enteringWindowDays = options.enteringWindowDays ?? DEFAULT_ENTERING_WINDOW_DAYS;
  const resolution = resolveWindow(wine);
  const { start, end, peakStart, peakEnd } = resolution;

  let phase: WineReadinessPhase;
  if (!start && !end) {
    phase = "missing_window";
  } else if ((start && end && start.date.getTime() > end.date.getTime()) || isPeakInvalid(resolution)) {
    phase = "needs_review";
  } else if (end && asOf.getTime() > end.date.getTime()) {
    phase = "past_peak";
  } else if (start && asOf.getTime() < start.date.getTime()) {
    const daysToStart = daysUntil(asOf, start.date) ?? Number.POSITIVE_INFINITY;
    phase = daysToStart <= enteringWindowDays ? "entering_window" : "hold";
  } else if (isWithinInclusive(asOf, peakStart, peakEnd)) {
    phase = "at_peak";
  } else if (end && isDrinkSoon(end, asOf, drinkSoonYears)) {
    phase = "drink_soon";
  } else {
    phase = "ready";
  }

  const normalizedDrinkAfter = normalizedBoundary(start, "start");
  const normalizedDrinkBefore = normalizedBoundary(end, "end");
  const normalizedPeakStart = normalizedBoundary(peakStart, "start");
  const normalizedPeakEnd = normalizedBoundary(peakEnd, "end");
  const nextPeakDate = peakStart && asOf.getTime() <= peakStart.date.getTime()
    ? peakStart.date
    : peakEnd && asOf.getTime() <= peakEnd.date.getTime()
      ? peakEnd.date
      : null;

  return {
    phase,
    legacyState: legacyStateForPhase(phase),
    source: phase === "needs_review" ? "invalid" : resolution.source,
    confidence: phase === "needs_review" ? "needs-review" : confidenceFor(resolution),
    normalizedDrinkAfter,
    normalizedDrinkBefore,
    peakStart: normalizedPeakStart,
    peakEnd: normalizedPeakEnd,
    daysToStart: daysUntil(asOf, start?.date ?? null),
    daysToPeak: daysUntil(asOf, nextPeakDate),
    daysToEnd: daysUntil(asOf, end?.date ?? null),
    nextAction: nextActionForPhase(phase),
    reason: reasonForPhase(phase, resolution),
  };
}

export function getWineReadiness(
  wine: WineWindowInput,
  options: { asOf?: Date; drinkSoonYears?: number } = {}
): WineReadinessState {
  return getWineReadinessProfile(wine, options).legacyState;
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
  const resolution = resolveWindow(wine);
  const drinkAfterYear = resolution.start?.year ?? null;
  const drinkBeforeYear = resolution.end?.year ?? null;

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
