import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "../scripts/cellartracker-import";

const scriptPath = "scripts/cellartracker-import.ts";
const packagePath = "package.json";

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

function testCellarTrackerImportScriptContract() {
  const script = source(scriptPath);
  const pkg = source(packagePath);

  assertIncludes(pkg, '"test:cellartracker-import-persistence"');
  assertIncludes(pkg, '"test:cellartracker-import-script"');
  assertIncludes(pkg, "npm run test:cellartracker-import-persistence");
  assertIncludes(pkg, "npm run test:cellartracker-import-script");

  assertIncludes(script, "writeDrafts: false");
  assertIncludes(script, "--file");
  assertIncludes(script, "--write-drafts");
  assertIncludes(script, "--import-batch-id");
  assertIncludes(script, "--owner-id");
  assertIncludes(script, "CELLARTRACKER_IMPORT_OWNER_ID");
  assertIncludes(script, "buildCellarTrackerImportPlan");
  assertIncludes(script, "loadExistingDuplicateCandidateKeys");
  assertIncludes(script, "isMissingDrinkWindowObservationTable");
  assertIncludes(script, "raw_payload->>duplicateCandidateKey");
  assertIncludes(script, '.in("inventory_id", ownedInventoryIds)');
  assertIncludes(script, '.from("cellar_inventory")');
  assertIncludes(script, '.from("wine_price_observations")');
  assertIncludes(script, '.from("wine_drink_window_observations")');
  assertIncludes(script, "review_status");
  assertIncludes(script, "draft");

  assertIncludes(script, "DRY RUN");
  assertIncludes(script, "No writes happened");
  assertIncludes(script, "Batch");
  assertIncludes(script, "matched");
  assertIncludes(script, "ambiguous");
  assertIncludes(script, "unmatched");
  assertIncludes(script, "price draft");
  assertIncludes(script, "drink-window draft");
  assertIncludes(script, "cleanup");

  assertExcludes(script, ".update(");
  assertExcludes(script, ".delete(");
  assertExcludes(script, ".upsert(");
  assertExcludes(script, ".rpc(");
  assertExcludes(script, "current_market_value_cents");
  assertExcludes(script, "drink_after:");
  assertExcludes(script, "drink_before:");
  assertExcludes(script, "fetch(");
  assertExcludes(script, "Anthropic");
  assertExcludes(script, "messages.create");
  assertExcludes(script, "OpenAI");
  assertExcludes(script, "wine-searcher.com");
  assertExcludes(script, "vivino.com");
  assertExcludes(script, "cellartracker.com");
}

testCellarTrackerImportScriptContract();

{
  const dryRun = parseArgs(["--file", "export.csv", "--owner-id", "owner-1"]);
  assert.equal(dryRun.file, "export.csv");
  assert.equal(dryRun.ownerId, "owner-1");
  assert.equal(dryRun.importBatchId, null);
  assert.equal(dryRun.writeDrafts, false);
}

{
  const writeRun = parseArgs(["--file", "export.csv", "--owner-id", "owner-1", "--import-batch-id", "reviewed-batch", "--write-drafts"]);
  assert.equal(writeRun.importBatchId, "reviewed-batch");
  assert.equal(writeRun.writeDrafts, true);
}

console.log("cellartracker import script contract tests passed");
