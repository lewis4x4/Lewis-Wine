import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const routePath = "src/app/api/imports/cellartracker/route.ts";

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

function testCellarTrackerImportRouteStaysReviewGated() {
  const route = source(routePath);
  assertIncludes(route, "export async function POST(request: Request)");
  assertIncludes(route, "supabase.auth.getUser()");
  assertIncludes(route, '.eq("cellars.owner_id", user.id)');
  assertIncludes(route, "buildCellarTrackerImportDraft");
  assertIncludes(route, "review_status: observation.reviewStatus");
  assertIncludes(route, "if (insertError) throw insertError");
  assertIncludes(route, "reviewWarnings");

  assertExcludes(route, 'review_status: "accepted"');
  assertExcludes(route, "current_market_value_cents");
  assertExcludes(route, "drink_after");
  assertExcludes(route, "drink_before");
  assertExcludes(route, ".update(");
  assertExcludes(route, "Anthropic");
  assertExcludes(route, "messages.create");
  assertExcludes(route, "fetch(");
}

testCellarTrackerImportRouteStaysReviewGated();

console.log("cellartracker import API contract tests passed");
