import assert from "node:assert/strict";
import {
  classifyObservationKind,
  isPriceObservationStale,
  normalizePriceObservation,
  selectBestMarketValue,
  selectBestReplacementPrice,
  summarizePricePosture,
  type PriceObservation,
} from "@/lib/current-intelligence/price-observations";

const asOf = "2026-06-13T12:00:00.000Z";

function observation(overrides: Partial<PriceObservation>): PriceObservation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    inventoryId: "inv-1",
    wineReferenceId: "ref-1",
    sourceType: "manual",
    sourceName: "Brian verified",
    sourceUrl: null,
    observationKind: "market_value",
    truthLabel: "verified",
    reviewStatus: "accepted",
    observedPriceCents: 12500,
    currency: "USD",
    bottleSizeMl: 750,
    vintage: 2019,
    confidence: 90,
    observedAt: "2026-06-01T00:00:00.000Z",
    notes: null,
    rawPayload: null,
    ...overrides,
  };
}

{
  const posture = summarizePricePosture([], asOf);
  assert.equal(posture.market.status, "unknown");
  assert.equal(posture.market.valueCents, null);
  assert.equal(posture.replacement.status, "unknown");
  assert.equal(posture.replacement.valueCents, null);
}

{
  assert.equal(classifyObservationKind("retailer", "market_value"), "replacement_price");
  assert.equal(classifyObservationKind("winery", "market_value"), "replacement_price");
  assert.equal(classifyObservationKind("wine_market_journal", "market_value"), "auction_comp");
  assert.equal(classifyObservationKind("cellartracker", "market_value"), "market_value");
}

{
  const retailer = normalizePriceObservation({
    inventoryId: "inv-1",
    sourceType: "retailer",
    observationKind: "market_value",
    observedPriceCents: 9999,
    observedAt: asOf,
  });
  assert.equal(retailer.observationKind, "replacement_price");
  assert.equal(retailer.truthLabel, "estimated");
}

{
  const staleAi = observation({
    id: "ai-old",
    sourceType: "ai_inferred",
    truthLabel: "ai_inferred",
    observationKind: "market_value",
    observedPriceCents: 18000,
    observedAt: "2025-01-01T00:00:00.000Z",
    confidence: 55,
  });
  const manual = observation({ id: "manual", observedPriceCents: 12500, observedAt: "2026-06-01T00:00:00.000Z" });
  const selected = selectBestMarketValue([staleAi, manual], asOf);
  assert.equal(selected?.id, "manual");
  assert.equal(isPriceObservationStale(staleAi, asOf), true);
}

{
  const retail = observation({
    id: "retail",
    sourceType: "retailer",
    observationKind: "replacement_price",
    observedPriceCents: 14200,
    observedAt: "2026-06-10T00:00:00.000Z",
    confidence: 75,
  });
  const ct = observation({
    id: "ct",
    sourceType: "cellartracker",
    observationKind: "market_value",
    observedPriceCents: 12800,
    observedAt: "2026-06-05T00:00:00.000Z",
    confidence: 82,
  });
  assert.equal(selectBestMarketValue([retail, ct], asOf)?.id, "ct");
  assert.equal(selectBestReplacementPrice([retail, ct], asOf)?.id, "retail");
}

{
  const auction = observation({
    id: "wmj",
    sourceType: "wine_market_journal",
    observationKind: "auction_comp",
    observedPriceCents: 22000,
    observedAt: "2026-03-01T00:00:00.000Z",
  });
  const posture = summarizePricePosture([auction], asOf);
  assert.equal(posture.market.status, "estimated");
  assert.equal(posture.market.sourceType, "wine_market_journal");
  assert.equal(posture.market.kind, "auction_comp");
}

console.log("price-observations tests passed");
