import assert from "node:assert/strict";
import {
  buildCellarTrackerObservationDraft,
  matchCellarTrackerRowToInventory,
  normalizeCellarTrackerRow,
  parseCellarTrackerCsv,
} from "@/lib/current-intelligence/cellartracker-import";

const csv = `Producer,Wine,Vintage,Size,Quantity,Value,Purchase Price,Location\nLewis Cellars,Estate Cabernet Sauvignon,2019,750ml,2,$128.00,$92.50,Home\nRidge,Monte Bello,2018,1.5L,1,$410.00,,Offsite`;

{
  const rows = parseCellarTrackerCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].Producer, "Lewis Cellars");
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
  const row = normalizeCellarTrackerRow(parseCellarTrackerCsv(csv)[0]);
  const match = matchCellarTrackerRowToInventory(row, [
    { id: "wrong", custom_producer: "Other", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
    { id: "right", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
  ]);
  assert.equal(match.status, "matched");
  assert.equal(match.inventoryId, "right");
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
  const match = matchCellarTrackerRowToInventory(row, [
    { id: "a", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
    { id: "b", custom_producer: "Lewis Cellars", custom_name: "Estate Cabernet Sauvignon", vintage: 2019, custom_vintage: null, wine_reference: null },
  ]);
  assert.equal(match.status, "ambiguous");
}

console.log("cellartracker-import tests passed");
