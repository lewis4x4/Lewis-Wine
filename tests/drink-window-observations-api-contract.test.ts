import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const listRoutePath = "src/app/api/drink-window-observations/route.ts";
const reviewRoutePath = "src/app/api/drink-window-observations/[id]/route.ts";
const panelPath = "src/components/cellar/drink-window-evidence-panel.tsx";
const bottlePagePath = "src/app/(dashboard)/cellar/[id]/page.tsx";
const radarRoutePath = "src/app/api/portfolio-radar/route.ts";

function source(path: string) {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, "utf8");
}

function assertIncludes(haystack: string, needle: string) {
  assert.ok(haystack.includes(needle), `expected source to include: ${needle}`);
}

function assertExcludes(haystack: string, needle: string) {
  assert.equal(haystack.includes(needle), false, `expected source not to include: ${needle}`);
}

function testListAndCreateRouteIsAuthenticatedOwnerScopedAndBackwardCompatible() {
  const route = source(listRoutePath);
  assertIncludes(route, "export async function GET(request: Request)");
  assertIncludes(route, "export async function POST(request: Request)");
  assertIncludes(route, "supabase.auth.getUser()");
  assertIncludes(route, '.from("cellar_inventory")');
  assertIncludes(route, '.from("cellars")');
  assertIncludes(route, "owner_id !== user.id");
  assertIncludes(route, '.from("wine_drink_window_observations")');
  assertIncludes(route, "buildReadinessInputWithDrinkWindowEvidence");
  assertIncludes(route, "getWineReadinessProfile");
  assertIncludes(route, "isMissingDrinkWindowObservationTable");
  assertIncludes(route, "tableReady: false");
  assertExcludes(route, '.from("cellar_inventory").update');
}

function testReviewRouteCanAcceptEditRejectWithoutOverwritingInventoryTruth() {
  const route = source(reviewRoutePath);
  const recordHelpers = source("src/lib/drink-window-observation-records.ts");
  assertIncludes(route, "export async function PATCH");
  assertIncludes(route, "reviewStatus");
  assertIncludes(route, "accepted");
  assertIncludes(route, "rejected");
  assertIncludes(route, "superseded");
  assertIncludes(route, '.from("wine_drink_window_observations")');
  assertIncludes(route, "validateDrinkWindowObservation");
  assertIncludes(recordHelpers, "reviewed_at");
  assertExcludes(route, '.from("cellar_inventory").update');
  assertExcludes(route, "update({ drink_after");
}

function testBottleDetailRendersReviewApplyPanel() {
  const panel = source(panelPath);
  const page = source(bottlePagePath);
  assertIncludes(panel, "DrinkWindowEvidencePanel");
  assertIncludes(panel, "/api/drink-window-observations");
  assertIncludes(panel, "Accept");
  assertIncludes(panel, "Reject");
  assertIncludes(panel, "Supersede");
  assertIncludes(panel, "Edit");
  assertIncludes(panel, "cellar truth is not overwritten");
  assertIncludes(page, "DrinkWindowEvidencePanel");
  assertIncludes(page, "<DrinkWindowEvidencePanel");
}

function testPortfolioRadarCanConsumeAcceptedDrinkWindowEvidenceWithoutBreakingBeforeMigration() {
  const radarRoute = source(radarRoutePath);
  assertIncludes(radarRoute, "loadDrinkWindowObservations");
  assertIncludes(radarRoute, "isMissingDrinkWindowObservationTable");
  assertIncludes(radarRoute, "drink_window_observations");
  assertIncludes(radarRoute, "tableReady: false");
}

testListAndCreateRouteIsAuthenticatedOwnerScopedAndBackwardCompatible();
testReviewRouteCanAcceptEditRejectWithoutOverwritingInventoryTruth();
testBottleDetailRendersReviewApplyPanel();
testPortfolioRadarCanConsumeAcceptedDrinkWindowEvidenceWithoutBreakingBeforeMigration();

console.log("drink-window observations API/UI contract tests passed");
