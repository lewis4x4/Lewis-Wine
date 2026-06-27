import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const routePath = "src/app/api/portfolio-radar/refresh/scheduled/route.ts";
const netlifyFunctionPath = "netlify/functions/portfolio-radar-refresh-schedule.mjs";
const packageSource = readFileSync("package.json", "utf8");

function source(path: string) {
  assert.ok(existsSync(path), `expected ${path} to exist`);
  return readFileSync(path, "utf8");
}

function assertIncludes(haystack: string, needle: string) {
  assert.ok(haystack.includes(needle), `expected source to include: ${needle}`);
}

function assertExcludes(haystack: string, needle: string) {
  assert.equal(haystack.includes(needle), false, `expected source not to include: ${needle}`);
}

function testScheduledRouteIsSecretProtectedAndBuildsPlanServerSide() {
  const routeSource = source(routePath);

  assertIncludes(routeSource, "export async function POST");
  assertIncludes(routeSource, "status: 401");
  assertIncludes(routeSource, "POURFOLIO_CRON_SECRET");
  assertIncludes(routeSource, "SUPABASE_SERVICE_ROLE_KEY");
  assertIncludes(routeSource, "POURFOLIO_REFRESH_OWNER_ID");
  assertIncludes(routeSource, "buildPortfolioRefreshQueue");
  assertIncludes(routeSource, "buildPortfolioRefreshRun");
  assertIncludes(routeSource, "buildPortfolioRefreshScheduleSummary");
  assertIncludes(routeSource, '.from("wine_intelligence_refreshes")');
  assertIncludes(routeSource, ".insert(run.rows)");
  assertIncludes(routeSource, "dailySummary");
  assertIncludes(routeSource, "weeklySummary");

  assertExcludes(routeSource, "request.json");
  assertExcludes(routeSource, "Anthropic");
  assertExcludes(routeSource, "messages.create");
  assertExcludes(routeSource, ".delete(");
  assertExcludes(routeSource, ".update(");
  assertExcludes(routeSource, ".upsert(");
}

function testNetlifyScheduledFunctionCallsOnlyTheProtectedEndpoint() {
  const functionSource = source(netlifyFunctionPath);

  assertIncludes(functionSource, "export const config");
  assertIncludes(functionSource, "@daily");
  assertIncludes(functionSource, "POURFOLIO_REFRESH_SCHEDULE_URL");
  assertIncludes(functionSource, "POURFOLIO_CRON_SECRET");
  assertIncludes(functionSource, "/api/portfolio-radar/refresh/scheduled");
  assertIncludes(functionSource, "Authorization");
  assertIncludes(functionSource, "Bearer");

  assertExcludes(functionSource, "SUPABASE_SERVICE_ROLE_KEY");
  assertExcludes(functionSource, "console.log(process.env");
}

function testScheduledRefreshGateIsInFullCheck() {
  assertIncludes(packageSource, "test:portfolio-radar-refresh-schedule");
  assertIncludes(packageSource, "test:portfolio-radar-refresh-schedule-api");
  assertIncludes(packageSource, "npm run test:portfolio-radar-refresh-schedule");
  assertIncludes(packageSource, "npm run test:portfolio-radar-refresh-schedule-api");
}

testScheduledRouteIsSecretProtectedAndBuildsPlanServerSide();
testNetlifyScheduledFunctionCallsOnlyTheProtectedEndpoint();
testScheduledRefreshGateIsInFullCheck();

console.log("portfolio-radar refresh scheduled API contract tests passed");
