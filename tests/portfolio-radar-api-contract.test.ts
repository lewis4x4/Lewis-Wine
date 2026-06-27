import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/portfolio-radar/route.ts", "utf8");
const pageSource = readFileSync("src/app/(dashboard)/intelligence/page.tsx", "utf8");

function assertIncludes(source: string, needle: string) {
  assert.ok(source.includes(needle), `expected source to include: ${needle}`);
}

function assertExcludes(source: string, needle: string) {
  assert.equal(source.includes(needle), false, `expected source not to include: ${needle}`);
}

function testRouteIsAuthenticatedReadOnlyAndOwnerScoped() {
  assertIncludes(routeSource, "export async function GET()");
  assertIncludes(routeSource, "status: 401");
  assertIncludes(routeSource, '.eq("owner_id", auth.user.id)');
  assertIncludes(routeSource, '.eq("user_id", auth.user.id)');
  assertIncludes(routeSource, '.in("cellar_id", cellarIds)');
  assertIncludes(routeSource, '.eq("status", "in_cellar")');
  assertIncludes(routeSource, '.eq("owner_id", auth.user.id)');

  assertExcludes(routeSource, "export async function POST");
  assertExcludes(routeSource, "export async function PATCH");
  assertExcludes(routeSource, "export async function PUT");
  assertExcludes(routeSource, "export async function DELETE");
  assertExcludes(routeSource, ".insert(");
  assertExcludes(routeSource, ".update(");
  assertExcludes(routeSource, ".delete(");
  assertExcludes(routeSource, ".upsert(");
  assertExcludes(routeSource, "Anthropic");
  assertExcludes(routeSource, "messages.create");
}

function testRouteFeedsTheRadarContractWithoutReDerivingInTheUi() {
  assertIncludes(routeSource, "buildPortfolioRadar({");
  assertIncludes(routeSource, "cellar,");
  assertIncludes(routeSource, "priceObservations,");
  assertIncludes(routeSource, "acquisition: { targets, priceObservations: acquisitionPriceObservations }");
  assertIncludes(routeSource, "replenishment,");
  assertIncludes(routeSource, "sourceSummary");
  assertIncludes(routeSource, "loadRefreshRecords(client, inventoryIds)");
  assertIncludes(routeSource, "refreshQueue: radarWithOutcomes.radar.refreshPlan.summary");
}

function testPortfolioRadarRendersBeforeLegacyPanelStack() {
  assertIncludes(pageSource, "<PortfolioRadarPanel />");
  assertIncludes(pageSource, "<CaptureCommandCard />");
  assert.ok(
    pageSource.indexOf("<PortfolioRadarPanel />") < pageSource.indexOf("<CaptureCommandCard />"),
    "Portfolio Radar must render before the old capture/buy-again/replenishment/acquisition panel stack"
  );
}

testRouteIsAuthenticatedReadOnlyAndOwnerScoped();
testRouteFeedsTheRadarContractWithoutReDerivingInTheUi();
testPortfolioRadarRendersBeforeLegacyPanelStack();

console.log("portfolio-radar API contract tests passed");
