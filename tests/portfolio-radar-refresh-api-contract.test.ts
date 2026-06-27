import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("src/app/api/portfolio-radar/refresh/route.ts", "utf8");
const packageSource = readFileSync("package.json", "utf8");

function assertIncludes(source: string, needle: string) {
  assert.ok(source.includes(needle), `expected source to include: ${needle}`);
}

function assertExcludes(source: string, needle: string) {
  assert.equal(source.includes(needle), false, `expected source not to include: ${needle}`);
}

function testRefreshRunnerRouteIsAuthenticatedAndPersistenceOnly() {
  assertIncludes(routeSource, "export async function POST");
  assertIncludes(routeSource, "status: 401");
  assertIncludes(routeSource, "buildPortfolioRefreshRun");
  assertIncludes(routeSource, "record_only");
  assertIncludes(routeSource, '.from("wine_intelligence_refreshes")');
  assertIncludes(routeSource, ".insert(run.rows)");

  assertExcludes(routeSource, "export async function GET");
  assertExcludes(routeSource, "Anthropic");
  assertExcludes(routeSource, "messages.create");
  assertExcludes(routeSource, ".update(");
  assertExcludes(routeSource, ".delete(");
  assertExcludes(routeSource, ".upsert(");
}

function testRefreshRunnerIsInFullCheckGate() {
  assertIncludes(packageSource, "test:portfolio-radar-refresh-runner");
  assertIncludes(packageSource, "test:portfolio-radar-refresh-api");
  assertIncludes(packageSource, "npm run test:portfolio-radar-refresh-runner");
  assertIncludes(packageSource, "npm run test:portfolio-radar-refresh-api");
}

testRefreshRunnerRouteIsAuthenticatedAndPersistenceOnly();
testRefreshRunnerIsInFullCheckGate();

console.log("portfolio-radar refresh API contract tests passed");
