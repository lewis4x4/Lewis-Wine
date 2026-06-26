import assert from "node:assert/strict";
import {
  getWineReadinessProfile,
  getWineReadiness,
  getWineWindowDisplay,
  isWineApproachingPeak,
  isWineReadyNow,
  parseWineWindowYear,
} from "../src/lib/wine-readiness";

const asOf = new Date("2026-06-12T12:00:00Z");

function testParsesYearsFromDatesAndLabels() {
  assert.equal(parseWineWindowYear("2028"), 2028);
  assert.equal(parseWineWindowYear("2028-12-31"), 2028);
  assert.equal(parseWineWindowYear(null), null);
  assert.equal(parseWineWindowYear("not set"), null);
}

function testReadinessUsesSingleCanonicalStateMachine() {
  assert.equal(getWineReadiness({ drink_after: "2028", drink_before: "2034" }, { asOf }), "hold");
  assert.equal(getWineReadiness({ drink_after: "2024", drink_before: "2034" }, { asOf }), "ready");
  assert.equal(getWineReadiness({ drink_after: "2024", drink_before: "2028" }, { asOf }), "drink_soon");
  assert.equal(getWineReadiness({ drink_after: "2018", drink_before: "2024" }, { asOf }), "past_peak");
  assert.equal(getWineReadiness({ drink_after: null, drink_before: null }, { asOf }), "unknown");
}

function testReadinessProfileCoversCanonicalV2Phases() {
  assert.equal(getWineReadinessProfile({ drink_after: null, drink_before: null }, { asOf }).phase, "missing_window");
  assert.equal(getWineReadinessProfile({ drink_after: "2030", drink_before: "2028" }, { asOf }).phase, "needs_review");
  assert.equal(getWineReadinessProfile({ drink_after: "2028", drink_before: "2034" }, { asOf }).phase, "hold");
  assert.equal(
    getWineReadinessProfile({ drink_after: "2026-08-01", drink_before: "2034" }, { asOf, enteringWindowDays: 60 }).phase,
    "entering_window"
  );
  assert.equal(getWineReadinessProfile({ drink_after: "2026-06-12", drink_before: "2034" }, { asOf }).phase, "ready");
  assert.equal(
    getWineReadinessProfile(
      { drink_after: "2024-01-01", drink_before: "2034-12-31", peak_start: "2026-01-01", peak_end: "2026-12-31" },
      { asOf }
    ).phase,
    "at_peak"
  );
  assert.equal(getWineReadinessProfile({ drink_after: "2024", drink_before: "2028" }, { asOf }).phase, "drink_soon");
  assert.equal(getWineReadinessProfile({ drink_after: "2018", drink_before: "2024" }, { asOf }).phase, "past_peak");
}

function testReadinessProfileKeepsLegacyCompatibility() {
  assert.equal(getWineReadinessProfile({ drink_after: null, drink_before: null }, { asOf }).legacyState, "unknown");
  assert.equal(getWineReadinessProfile({ drink_after: "2030", drink_before: "2028" }, { asOf }).legacyState, "unknown");
  assert.equal(getWineReadinessProfile({ drink_after: "2026-08-01", drink_before: "2034" }, { asOf, enteringWindowDays: 60 }).legacyState, "hold");
  assert.equal(
    getWineReadinessProfile(
      { drink_after: "2024-01-01", drink_before: "2034-12-31", peak_start: "2026-01-01", peak_end: "2026-12-31" },
      { asOf }
    ).legacyState,
    "ready"
  );
}

function testReadinessProfileUsesReferenceWindowFallback() {
  const profile = getWineReadinessProfile(
    {
      drink_after: null,
      drink_before: null,
      wine_reference_drink_window_start: "2024",
      wine_reference_drink_window_end: "2030",
    },
    { asOf }
  );

  assert.equal(profile.phase, "ready");
  assert.equal(profile.source, "wine_reference");
  assert.equal(profile.confidence, "reference-backed");
  assert.equal(profile.normalizedDrinkAfter, "2024-01-01");
  assert.equal(profile.normalizedDrinkBefore, "2030-12-31");
  assert.equal(profile.nextAction, "consider_opening");
}

function testReadinessProfileBoundaryDatesAreExact() {
  const boundary = new Date("2026-06-12T00:00:00.000Z");
  assert.equal(
    getWineReadinessProfile({ drink_after: "2026-06-12", drink_before: "2028-12-31" }, { asOf: boundary }).phase,
    "ready"
  );
  assert.equal(
    getWineReadinessProfile({ drink_after: "2024-01-01", drink_before: "2026-06-12" }, { asOf: boundary }).phase,
    "drink_soon"
  );
  assert.equal(
    getWineReadinessProfile({ drink_after: "2024-01-01", drink_before: "2026-06-12" }, { asOf: new Date("2026-06-13T00:00:00.000Z") }).phase,
    "past_peak"
  );
  assert.equal(
    getWineReadinessProfile(
      { drink_after: "2024-01-01", drink_before: "2030-12-31", peak_start: "2026-06-12", peak_end: "2026-06-12" },
      { asOf: boundary }
    ).phase,
    "at_peak"
  );
}

function testReadinessRespectsExactIsoDatesWhenAvailable() {
  assert.equal(getWineReadiness({ drink_after: "2026-12-31", drink_before: "2032-12-31" }, { asOf }), "hold");
  assert.equal(getWineReadiness({ drink_after: "2024-01-01", drink_before: "2026-06-01" }, { asOf }), "past_peak");
  assert.equal(getWineReadiness({ drink_after: "2024-01-01", drink_before: "2026-07-01" }, { asOf }), "drink_soon");
}

function testReadinessFlagsInvertedWindowsAsUnknown() {
  assert.equal(getWineReadiness({ drink_after: "2030", drink_before: "2028" }, { asOf }), "unknown");
  assert.equal(getWineWindowDisplay({ drink_after: "2030", drink_before: "2028" }, { asOf }), null);
}

function testReadyNowRequiresARealWindow() {
  assert.equal(isWineReadyNow({ drink_after: null, drink_before: null }, { asOf }), false);
  assert.equal(isWineReadyNow({ drink_after: "2024", drink_before: "2028" }, { asOf }), true);
  assert.equal(isWineReadyNow({ drink_after: "2028", drink_before: "2034" }, { asOf }), false);
  assert.equal(isWineReadyNow({ drink_after: "2018", drink_before: "2024" }, { asOf }), false);
}

function testWindowDisplayFeedsCardsWithoutReinventingLogic() {
  const ready = getWineWindowDisplay({ drink_after: "2024", drink_before: "2028" }, { asOf });
  assert.deepEqual(ready, {
    progress: 50,
    status: "ready",
    label: "2024-2028",
    windowStart: 2024,
    windowEnd: 2028,
  });

  const hold = getWineWindowDisplay({ drink_after: "2029", drink_before: null }, { asOf });
  assert.equal(hold?.status, "early");
  assert.equal(hold?.label, "Ready from 2029");

  const past = getWineWindowDisplay({ drink_after: null, drink_before: "2024" }, { asOf });
  assert.equal(past?.status, "late");
  assert.equal(past?.label, "Until 2024");

  assert.equal(getWineWindowDisplay({ drink_after: null, drink_before: null }, { asOf }), null);
}

function testApproachingPeakIsDerivedFromSameWindowParsing() {
  assert.equal(isWineApproachingPeak({ drink_before: "2026-07-01" }, { asOf, withinDays: 30 }), true);
  assert.equal(isWineApproachingPeak({ drink_before: "2026-08-15" }, { asOf, withinDays: 30 }), false);
  assert.equal(isWineApproachingPeak({ drink_before: "2026-06-01" }, { asOf, withinDays: 30 }), false);
  assert.equal(isWineApproachingPeak({ drink_before: null }, { asOf, withinDays: 30 }), false);
}

testParsesYearsFromDatesAndLabels();
testReadinessUsesSingleCanonicalStateMachine();
testReadinessProfileCoversCanonicalV2Phases();
testReadinessProfileKeepsLegacyCompatibility();
testReadinessProfileUsesReferenceWindowFallback();
testReadinessProfileBoundaryDatesAreExact();
testReadinessRespectsExactIsoDatesWhenAvailable();
testReadinessFlagsInvertedWindowsAsUnknown();
testReadyNowRequiresARealWindow();
testWindowDisplayFeedsCardsWithoutReinventingLogic();
testApproachingPeakIsDerivedFromSameWindowParsing();

console.log("wine-readiness tests passed");
