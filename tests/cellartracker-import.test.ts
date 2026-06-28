import assert from "node:assert/strict";
import {
  buildCellarTrackerImportDraft,
  buildCellarTrackerObservationDraft,
  matchCellarTrackerRowToInventory,
  normalizeCellarTrackerRow,
  parseCellarTrackerCsv,
} from "@/lib/current-intelligence/cellartracker-import";
import { selectBestMarketValue } from "@/lib/current-intelligence/price-observations";

const csv = `Producer,Wine,Vintage,Size,Quantity,Value,Purchase Price,Location\nLewis Cellars,Estate Cabernet Sauvignon,2019,750ml,2,$128.00,$92.50,Home\nRidge,Monte Bello,2018,1.5L,1,$410.00,,Offsite`;
const richCsv = `Producer,Wine,Vintage,BottleSize,Qty,BottleCost,Purchase Currency,Market Value,Community Value,User Value,WMJ Auction Average,Begin Consume,End Consume,Ready to Drink,Availability,Location,Bin\nRidge,"Monte Bello, ""Collector"" Edition",2018,1.5L,3,USD 250.00,USD,$410.00,$390.00,$425.00,$405.50,2026,2042,"Hold / Ready in 2030",Available,Offsite,A-12`;
const largeFormatCsv = `Producer,Wine,Vintage,Size,Quantity,Value\nRidge,Monte Bello,2018,3750ml,1,$900.00`;
const partialWindowCsv = `Producer,Wine,Vintage,Begin Consume,Ready to Drink\nRidge,Monte Bello,2018,2026,"Hold until the window opens"`;

{
  const rows = parseCellarTrackerCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Producer, "Lewis Cellars");
}

{
  const rows = parseCellarTrackerCsv(richCsv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Wine, 'Monte Bello, "Collector" Edition');
  assert.equal(rows[0]["Ready to Drink"], "Hold / Ready in 2030");
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[0]);
  assert.equal(row.producer, "Lewis Cellars");
  assert.equal(row.name, "Estate Cabernet Sauvignon");
  assert.equal(row.vintage, 2019);
  assert.equal(row.bottleSizeMl, 750);
  assert.equal(row.valueCents, 12800);
  assert.equal(row.purchasePriceCents, 9250);
}

{
  const normalized = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[1]);
  assert.equal(normalized.bottleSizeMl, 1500);
}

{
  const normalized = normalizeCellarTrackerRow(parseCellarTrackerCsv(largeFormatCsv)[0]);
  assert.equal(normalized.bottleSizeMl, 3750);
}

{
  const normalized = normalizeCellarTrackerRow(parseCellarTrackerCsv(richCsv)[0]);
  assert.equal(normalized.name, 'Monte Bello, "Collector" Edition');
  assert.equal(normalized.bottleSizeMl, 1500);
  assert.equal(normalized.quantity, 3);
  assert.equal(normalized.purchasePriceCents, 25000);
  assert.equal(normalized.purchaseCurrency, "USD");
  assert.equal(normalized.marketValueCents, 41000);
  assert.equal(normalized.communityValueCents, 39000);
  assert.equal(normalized.userValueCents, 42500);
  assert.equal(normalized.auctionAverageCents, 40550);
  assert.equal(normalized.drinkAfter, "2026");
  assert.equal(normalized.drinkBefore, "2042");
  assert.equal(normalized.readyToDrink, "Hold / Ready in 2030");
  assert.equal(normalized.availability, "Available");
  assert.equal(normalized.location, "Offsite");
  assert.equal(normalized.bin, "A-12");
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[0]);
  const match = matchCellarTrackerRowToInventory(row, [
    { id: "wrong", custom_producer: "Other", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
    { id: "right", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
  ]);
  assert.equal(match.status, "matched");
  assert.equal(match.inventoryId, "right");
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(richCsv)[0]);
  const match = matchCellarTrackerRowToInventory(row, [
    { id: "wrong-vintage", custom_producer: "Ridge", custom_name: 'Monte Bello, "Collector" Edition', vintage: 2019, custom_vintage: null, wine_reference: null },
  ]);
  assert.equal(match.status, "unmatched");
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[0]);
  const draft = buildCellarTrackerObservationDraft(row, { status: "matched", inventoryId: "right", confidence: 92 });
  assert.equal(draft.marketObservation?.observationKind, "market_value");
  assert.equal(draft.marketObservation?.sourceType, "cellartracker");
  assert.equal(draft.purchaseObservation?.observationKind, "purchase_price");
  assert.equal(draft.purchaseObservation?.sourceType, "cellartracker");
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[0]);
  const match = { status: "matched" as const, inventoryId: "right", confidence: 92 };
  const compatibilityDraft = buildCellarTrackerObservationDraft(row, match);
  const richDraft = buildCellarTrackerImportDraft(row, match);
  assert.equal(compatibilityDraft.marketObservation?.observedPriceCents, richDraft.priceObservations.find((observation) => observation.observationKind === "market_value")?.observedPriceCents);
  assert.equal(compatibilityDraft.purchaseObservation?.observedPriceCents, richDraft.priceObservations.find((observation) => observation.observationKind === "purchase_price")?.observedPriceCents);
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(richCsv)[0]);
  const draft = buildCellarTrackerImportDraft(row, { status: "matched", inventoryId: "ridge-2018", confidence: 91 });
  const wmj = draft.priceObservations.find((observation) => observation.sourceType === "wine_market_journal");
  assert.ok(wmj);
  assert.equal(wmj.observationKind, "auction_comp");
  assert.equal(wmj.truthLabel, "verified");
  assert.equal(wmj.reviewStatus, "draft");
  assert.equal(wmj.observedPriceCents, 40550);
  assert.match(wmj.sourceName ?? "", /via CellarTracker/i);

  const community = draft.priceObservations.find((observation) => observation.observedPriceCents === 39000);
  assert.ok(community);
  assert.equal(community.sourceType, "cellartracker");
  assert.equal(community.observationKind, "estimate");
  assert.equal(community.truthLabel, "estimated");
  assert.equal(selectBestMarketValue([{ ...community, reviewStatus: "accepted" }]), null);

  const manual = draft.priceObservations.find((observation) => observation.observedPriceCents === 42500);
  assert.ok(manual);
  assert.equal(manual.sourceType, "manual");
  assert.equal(manual.reviewStatus, "draft");
  assert.match(manual.sourceName ?? "", /User\/manual valuation via CellarTracker export/);
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(richCsv)[0]);
  const draft = buildCellarTrackerImportDraft(row, { status: "matched", inventoryId: "ridge-2018", confidence: 91 });
  assert.equal(draft.match.status, "matched");
  assert.deepEqual(draft.reviewWarnings, []);
  assert.ok(draft.drinkWindowObservation);
  assert.equal(draft.drinkWindowObservation.sourceType, "cellartracker");
  assert.equal(draft.drinkWindowObservation.sourceName, "CellarTracker drinkability export");
  assert.equal(draft.drinkWindowObservation.reviewStatus, "draft");
  assert.equal(draft.drinkWindowObservation.drinkAfter, "2026");
  assert.equal(draft.drinkWindowObservation.drinkBefore, "2042");
  assert.match(draft.drinkWindowObservation.notes ?? "", /Hold \/ Ready in 2030/);
  assert.equal((draft.drinkWindowObservation.rawPayload as Record<string, string>)["Ready to Drink"], "Hold / Ready in 2030");
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(partialWindowCsv)[0]);
  const draft = buildCellarTrackerImportDraft(row, { status: "matched", inventoryId: "ridge-2018", confidence: 91 });
  assert.ok(draft.drinkWindowObservation);
  assert.equal(draft.drinkWindowObservation.drinkAfter, "2026");
  assert.equal(draft.drinkWindowObservation.drinkBefore, null);
  assert.match(draft.reviewWarnings.join(" "), /partial/i);
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(richCsv)[0]);
  const unmatchedDraft = buildCellarTrackerImportDraft(row, { status: "unmatched", confidence: 0 });
  assert.deepEqual(unmatchedDraft.priceObservations, []);
  assert.equal(unmatchedDraft.drinkWindowObservation, null);
  assert.match(unmatchedDraft.reviewWarnings.join(" "), /unmatched/i);

  const ambiguousDraft = buildCellarTrackerImportDraft(row, { status: "ambiguous", inventoryIds: ["ridge-a", "ridge-b"], confidence: 91 });
  assert.deepEqual(ambiguousDraft.priceObservations, []);
  assert.equal(ambiguousDraft.drinkWindowObservation, null);
  assert.match(ambiguousDraft.reviewWarnings.join(" "), /ambiguous/i);
}

{
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[0]);
  const match = matchCellarTrackerRowToInventory(row, [
    { id: "a", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
    { id: "b", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
  ]);
  assert.equal(match.status, "ambiguous");
}

console.log("cellartracker-import tests passed");
