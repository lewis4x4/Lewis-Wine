import assert from "node:assert/strict";
import { buildCellarTrackerImportPlan, stableCellarTrackerRowHash } from "@/lib/current-intelligence/cellartracker-import-persistence";
import { normalizeCellarTrackerRow, parseCellarTrackerCsv, type InventoryMatchRecord } from "@/lib/current-intelligence/cellartracker-import";

const ownerId = "00000000-0000-4000-8000-000000000001";
const observedAt = "2026-06-27T12:00:00.000Z";
const importBatchId = "ct-import-test-batch";

const csv = `Producer,Wine,Vintage,BottleSize,Qty,BottleCost,Purchase Currency,Market Value,Community Value,User Value,WMJ Auction Average,Begin Consume,End Consume,Peak Start,Peak End,Ready to Drink,Availability,Location,Bin\nRidge,"Monte Bello, Collector Edition",2018,1.5L,3,USD 250.00,USD,$410.00,$390.00,$425.00,$405.50,2026,2042,2030,2036,"Hold / Ready in 2030",Available,Offsite,A-12\nLewis Cellars,Estate Cabernet Sauvignon,2019,750ml,2,$128.00,,,$118.00,,,,,,,Drink now,Home,B-02\nRidge,Lytton Springs,2018,750ml,1,$300.00,USD,$500.00,,,,2025,2040,,,,,\nMystery Producer,Lost Wine,2020,750ml,1,$55.00,USD,$75.00,,,,2024,2030,,,,,`;

const rows = parseCellarTrackerCsv(csv);
const duplicateRows = parseCellarTrackerCsv(`Producer,Wine,Vintage,BottleSize,Qty,Market Value,Begin Consume,End Consume
Ridge,"Monte Bello, Collector Edition",2018,1.5L,3,$410.00,2026,2042
Ridge,"Monte Bello, Collector Edition",2018,1.5L,3,$410.00,2026,2042`);
const inventory: InventoryMatchRecord[] = [
  { id: "ridge-2018", custom_producer: "Ridge", custom_name: "Monte Bello, Collector Edition", vintage: 2018, custom_vintage: null, wine_reference: null },
  { id: "lewis-a", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
  { id: "lewis-b", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
];

function buildPlan() {
  return buildCellarTrackerImportPlan({ rows, inventory, ownerId, importBatchId, observedAt });
}

{
  const row = normalizeCellarTrackerRow(rows[0]);
  const equivalentRow = normalizeCellarTrackerRow({ ...rows[0], Wine: "Monte Bello, Collector Edition" });
  const changedValueRow = normalizeCellarTrackerRow({ ...rows[0], "Market Value": "$411.00" });
  assert.equal(stableCellarTrackerRowHash(row), stableCellarTrackerRowHash(equivalentRow));
  assert.notEqual(stableCellarTrackerRowHash(row), stableCellarTrackerRowHash(changedValueRow));
  assert.match(stableCellarTrackerRowHash(row), /^[a-f0-9]{64}$/);
}

{
  const plan = buildPlan();
  assert.equal(plan.report.importBatchId, importBatchId);
  assert.equal(plan.report.rows, 4);
  assert.equal(plan.report.matched, 1);
  assert.equal(plan.report.ambiguous, 1);
  assert.equal(plan.report.unmatched, 2);
  assert.equal(plan.rowResults.length, 4);
  assert.deepEqual(plan.rowResults.map((row) => row.rowNumber), [2, 3, 4, 5]);
  assert.deepEqual(plan.rowResults.map((row) => row.matchStatus), ["matched", "ambiguous", "unmatched", "unmatched"]);
  assert.deepEqual(plan.rowResults[0].normalizedIdentity, {
    producer: "Ridge",
    name: "Monte Bello, Collector Edition",
    vintage: 2018,
    bottleSizeMl: 1500,
    quantity: 3,
  });
}

{
  const plan = buildPlan();
  assert.equal(plan.payloads.priceObservations.length, 5);
  assert.equal(plan.payloads.drinkWindowObservations.length, 1);
  assert.equal(plan.report.priceDraftCountsByKindSource["cellartracker:market_value"], 1);
  assert.equal(plan.report.priceDraftCountsByKindSource["cellartracker:estimate"], 1);
  assert.equal(plan.report.priceDraftCountsByKindSource["manual:market_value"], 1);
  assert.equal(plan.report.priceDraftCountsByKindSource["wine_market_journal:auction_comp"], 1);
  assert.equal(plan.report.priceDraftCountsByKindSource["cellartracker:purchase_price"], 1);
  assert.equal(plan.report.drinkWindowDraftCount, 1);
}

{
  const plan = buildPlan();
  for (const payload of plan.payloads.priceObservations) {
    assert.equal(payload.review_status, "draft");
    assert.equal(payload.observed_at, observedAt);
    assert.equal(payload.raw_payload.importBatchId, importBatchId);
    assert.equal(payload.raw_payload.rowNumber, 2);
    assert.match(payload.raw_payload.rowHash, /^[a-f0-9]{64}$/);
    assert.equal(payload.raw_payload.originalRow.Producer, "Ridge");
    assert.equal(payload.raw_payload.normalizedRow.name, "Monte Bello, Collector Edition");
    assert.equal(payload.raw_payload.normalizedRow.marketValueCents, 41000);
    assert.match(payload.raw_payload.duplicateCandidateKey, /^wine_price_observations\|ridge-2018\|/);
  }

  const market = plan.payloads.priceObservations.find((payload) => payload.observation_kind === "market_value" && payload.source_type === "cellartracker");
  assert.ok(market);
  assert.equal(market.inventory_id, "ridge-2018");
  assert.equal(market.observed_price_cents, 41000);
  assert.equal(market.currency, "USD");
  assert.equal(market.bottle_size_ml, 1500);
  assert.equal(market.vintage, 2018);
}

{
  const plan = buildPlan();
  const drinkWindow = plan.payloads.drinkWindowObservations[0];
  assert.equal(drinkWindow.owner_id, ownerId);
  assert.equal(drinkWindow.inventory_id, "ridge-2018");
  assert.equal(drinkWindow.review_status, "draft");
  assert.equal(drinkWindow.source_type, "cellartracker");
  assert.equal(drinkWindow.drink_after, "2026-01-01");
  assert.equal(drinkWindow.drink_before, "2042-12-31");
  assert.equal(drinkWindow.peak_start, "2030-01-01");
  assert.equal(drinkWindow.peak_end, "2036-12-31");
  assert.equal(drinkWindow.raw_payload.importBatchId, importBatchId);
  assert.equal(drinkWindow.raw_payload.rowNumber, 2);
  assert.match(drinkWindow.raw_payload.duplicateCandidateKey, /^wine_drink_window_observations\|ridge-2018\|/);
}

{
  const plan = buildPlan();
  assert.match(plan.cleanupSql, /wine_price_observations/);
  assert.match(plan.cleanupSql, /wine_drink_window_observations/);
  assert.match(plan.cleanupSql, /review_status = 'draft'/);
  assert.match(plan.cleanupSql, /raw_payload->>'importBatchId' = 'ct-import-test-batch'/);
  assert.match(plan.cleanupSql, /cellar\.owner_id = '00000000-0000-4000-8000-000000000001'/);
  assert.match(plan.cleanupInstructions, /Review before executing/i);
}

{
  const plan = buildPlan();
  assert.equal(plan.rowResults[1].priceDraftCount, 0);
  assert.equal(plan.rowResults[1].drinkWindowDraft, false);
  assert.equal(plan.rowResults[2].priceDraftCount, 0);
  assert.equal(plan.rowResults[3].priceDraftCount, 0);
  assert.equal(plan.payloads.priceObservations.every((payload) => payload.raw_payload.rowNumber === 2), true);
  assert.match(plan.report.reviewWarnings.join("\n"), /ambiguous/i);
  assert.match(plan.report.reviewWarnings.join("\n"), /unmatched/i);
}

{
  const plan = buildCellarTrackerImportPlan({ rows: duplicateRows, inventory: [inventory[0]], ownerId, importBatchId, observedAt });
  assert.equal(plan.report.matched, 2);
  assert.ok(plan.report.inFileDuplicateCandidateKeys.length > 0);
  assert.match(plan.report.reviewWarnings.join("\n"), /duplicate/i);
}

{
  const basePlan = buildPlan();
  const existingDuplicateCandidateKey = basePlan.payloads.priceObservations[0].raw_payload.duplicateCandidateKey;
  const dedupedPlan = buildCellarTrackerImportPlan({ rows, inventory, ownerId, importBatchId, observedAt, existingDuplicateCandidateKeys: new Set([existingDuplicateCandidateKey]) });
  assert.equal(dedupedPlan.report.existingDuplicateCandidateKeys.includes(existingDuplicateCandidateKey), true);
  assert.equal(dedupedPlan.payloads.priceObservations.some((payload) => payload.raw_payload.duplicateCandidateKey === existingDuplicateCandidateKey), false);
  assert.match(dedupedPlan.report.reviewWarnings.join("\n"), /already exists/i);
}

{
  const plan = buildPlan() as unknown as Record<string, unknown>;
  assert.equal("inventoryUpdates" in plan, false);
  const serialized = JSON.stringify(plan);
  assert.doesNotMatch(serialized, /current_market_value_cents/);
  assert.doesNotMatch(serialized, /update\s+public\.cellar_inventory/i);
  assert.doesNotMatch(serialized, /delete\s+from\s+public\.cellar_inventory/i);
}

console.log("cellartracker import persistence tests passed");
