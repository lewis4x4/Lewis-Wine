import assert from "node:assert/strict";
import {
  buildAcquisitionReceipt,
  parseReceiptText,
  receiptItemToCellarPayload,
  receiptItemToPriceObservation,
  receiptItemToTargetUpdate,
  type AcquisitionReceiptInput,
} from "../src/lib/acquisition-receipt";
import {
  BOUGHT_WINE_INTAKE,
  boughtWineIntakeHref,
  chooseBoughtWineIntake,
} from "../src/lib/purchase-intake";

const text = `
Benchmark Wine Shop
2026-06-24
2 x 2021 Tapiz Alta Collection Cabernet Sauvignon Mendoza @ $92.00
1 x 2020 Lewis Cellars Reserve Cabernet Napa Valley @ $210.00
Subtotal $394.00
Tax $27.58
Total $421.58
`;

const parsed = parseReceiptText(text);
assert.equal(parsed.vendor, "Benchmark Wine Shop");
assert.equal(parsed.purchaseDate, "2026-06-24");
assert.equal(parsed.totalCents, 42158);
assert.equal(parsed.items.length, 2);
assert.equal(parsed.items[0].producer, "Tapiz");
assert.equal(parsed.items[0].quantity, 2);
assert.equal(parsed.items[0].unitPriceCents, 9200);
assert.equal(parsed.items[0].lineTotalCents, 18400);
assert.equal(parsed.items[1].region, "Napa Valley");

const input: AcquisitionReceiptInput = {
  vendor: parsed.vendor,
  purchaseDate: parsed.purchaseDate,
  totalCents: parsed.totalCents,
  taxCents: parsed.taxCents,
  subtotalCents: parsed.subtotalCents,
  receiptText: text,
  items: parsed.items.map((item, index) => ({
    ...item,
    acquisitionTargetId: index === 0 ? "target-tapiz" : null,
    selected: true,
  })),
};

const receipt = buildAcquisitionReceipt(input);
assert.equal(receipt.summary.selectedItems, 2);
assert.equal(receipt.summary.totalBottles, 3);
assert.equal(receipt.summary.totalWineSpendCents, 39400);
assert.equal(receipt.summary.closeoutCount, 1);
assert.equal(receipt.summary.cellarIntakeCount, 2);
assert.equal(receipt.items[0].action, "close_acquisition_and_add_to_cellar");
assert.equal(receipt.items[1].action, "add_to_cellar");
assert.ok(receipt.purchaseStory.includes("Benchmark Wine Shop"));
assert.ok(receipt.purchaseStory.includes("3 bottles"));

const cellarPayload = receiptItemToCellarPayload(receipt.items[0], "cellar-1", receipt);
assert.equal(cellarPayload.cellar_id, "cellar-1");
assert.equal(cellarPayload.custom_name, "Alta Collection Cabernet Sauvignon");
assert.equal(cellarPayload.custom_producer, "Tapiz");
assert.equal(cellarPayload.quantity, 2);
assert.equal(cellarPayload.purchase_price_cents, 9200);
assert.equal(cellarPayload.purchase_location, "Benchmark Wine Shop");
assert.ok(String(cellarPayload.notes).includes("Acquisition Receipt Capture"));

const priceObservation = receiptItemToPriceObservation(receipt.items[0], "inventory-1", receipt);
assert.equal(priceObservation.inventoryId, "inventory-1");
assert.equal(priceObservation.observedPriceCents, 9200);
assert.equal(priceObservation.sourceType, "retailer");
assert.equal(priceObservation.reviewStatus, "accepted");
assert.equal(priceObservation.truthLabel, "verified");

const targetUpdate = receiptItemToTargetUpdate(receipt.items[0]);
assert.equal(targetUpdate.status, "acquired");
assert.equal(targetUpdate.acquiredQuantity, 2);
assert.equal(targetUpdate.acquiredPriceCents, 18400);

assert.equal(BOUGHT_WINE_INTAKE.primaryLabel, "I bought wine");
assert.equal(boughtWineIntakeHref(), "/intelligence?intake=purchase#acquisition-receipt");
assert.equal(chooseBoughtWineIntake({ bottleCount: 1, hasReceipt: false }).href, "/capture?intent=purchase&save_mode=add_to_cellar");
assert.equal(chooseBoughtWineIntake({ bottleCount: 1, hasReceipt: false }).reason, "single bottle label capture");
assert.equal(chooseBoughtWineIntake({ bottleCount: 3, hasReceipt: false }).href, "/intelligence?intake=purchase#acquisition-receipt");
assert.equal(chooseBoughtWineIntake({ bottleCount: 1, hasReceipt: true }).reason, "receipt or order confirmation");

console.log("acquisition-receipt tests passed");
