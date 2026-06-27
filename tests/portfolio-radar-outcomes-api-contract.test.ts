import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/portfolio-radar/outcomes/route.ts", "utf8");
const radarRouteSource = readFileSync("src/app/api/portfolio-radar/route.ts", "utf8");
const panelSource = readFileSync("src/components/wine/portfolio-radar-panel.tsx", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const migrationSource = readFileSync("supabase/migrations/00023_cellar_action_outcomes.sql", "utf8");

function assertIncludes(source: string, needle: string) {
  assert.ok(source.includes(needle), `expected source to include: ${needle}`);
}

function assertExcludes(source: string, needle: string) {
  assert.equal(source.includes(needle), false, `expected source not to include: ${needle}`);
}

function testOutcomeRouteIsAuthenticatedOwnerScopedAndRecordOnly() {
  assertIncludes(routeSource, "export async function POST");
  assertIncludes(routeSource, "status: 401");
  assertIncludes(routeSource, '.from("cellar_action_outcomes")');
  assertIncludes(routeSource, ".insert(");
  assertIncludes(routeSource, "verifySubjectOwnership");
  assertIncludes(routeSource, '.from("cellar_inventory")');
  assertIncludes(routeSource, '.from("acquisition_watchlist")');
  assertIncludes(routeSource, "outcome_only_no_source_truth_overwrite");

  assertExcludes(routeSource, "Anthropic");
  assertExcludes(routeSource, "messages.create");
  assertExcludes(routeSource, ".update(");
  assertExcludes(routeSource, ".delete(");
  assertExcludes(routeSource, "current_market_value_cents:");
  assertExcludes(routeSource, "drink_after:");
  assertExcludes(routeSource, "drink_before:");
}

function testPortfolioRadarReadsOutcomesAndPanelRecordsThem() {
  assertIncludes(radarRouteSource, "loadActionOutcomes");
  assertIncludes(radarRouteSource, "applyPortfolioRadarOutcomes");
  assertIncludes(radarRouteSource, "outcomeSummary");
  assertIncludes(panelSource, "/api/portfolio-radar/outcomes");
  assertIncludes(panelSource, "Mark opened");
  assertIncludes(panelSource, "Recorded outcome");
  assertIncludes(panelSource, "outcomeSummary");
}

function testMigrationAndCheckGateIncludeOutcomeLedger() {
  assertIncludes(migrationSource, "create table if not exists public.cellar_action_outcomes");
  assertIncludes(migrationSource, "gen_random_uuid()");
  assertIncludes(migrationSource, "enable row level security");
  assertIncludes(migrationSource, "owner_id = auth.uid()");
  assertIncludes(migrationSource, "outcome_only_no_source_truth_overwrite");
  assertIncludes(packageSource, "test:portfolio-radar-outcomes");
  assertIncludes(packageSource, "test:portfolio-radar-outcomes-api");
  assertIncludes(packageSource, "npm run test:portfolio-radar-outcomes");
  assertIncludes(packageSource, "npm run test:portfolio-radar-outcomes-api");
}

testOutcomeRouteIsAuthenticatedOwnerScopedAndRecordOnly();
testPortfolioRadarReadsOutcomesAndPanelRecordsThem();
testMigrationAndCheckGateIncludeOutcomeLedger();

console.log("portfolio-radar outcomes API contract tests passed");
