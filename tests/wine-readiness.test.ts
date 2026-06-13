import assert from "node:assert/strict";
import {
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
testReadyNowRequiresARealWindow();
testWindowDisplayFeedsCardsWithoutReinventingLogic();
testApproachingPeakIsDerivedFromSameWindowParsing();

console.log("wine-readiness tests passed");
