import assert from "node:assert/strict";
import {
  buildPortfolioRadar,
  type PortfolioRadarAction,
  type PortfolioRadarInput,
  type PortfolioRadarCellarItem,
} from "../src/lib/portfolio-radar";
import { normalizeDrinkWindowObservation } from "../src/lib/drink-window-evidence";

const asOf = "2026-06-24T12:00:00.000Z";

function cellar(overrides: Partial<PortfolioRadarCellarItem>): PortfolioRadarCellarItem {
  return {
    id: overrides.id ?? "cellar-1",
    name: "Estate Cabernet",
    producer: "Lewis Cellars",
    region: "Napa Valley",
    vintage: 2021,
    quantity: 1,
    drink_after: "2024",
    drink_before: "2032",
    purchase_price_cents: 10000,
    current_market_value_cents: 12000,
    market_value_source: "manual",
    low_stock_threshold: null,
    low_stock_alert_enabled: false,
    ratings_count: 1,
    rating_signal_count: 1,
    brian_fit_score: 88,
    brian_fit_confidence: 80,
    accepted_price_evidence_count: 1,
    stale_price_evidence_count: 0,
    evidence_awaiting_review_count: 0,
    ...overrides,
  };
}

function sampleInput(): PortfolioRadarInput {
  return {
    asOf,
    cellar: [
      cellar({
        id: "drink-now",
        name: "Dinner Cabernet",
        vintage: 2020,
        quantity: 2,
        drink_after: "2020",
        drink_before: "2030",
        ratings_count: 2,
        brian_fit_score: 93,
      }),
      cellar({
        id: "past-peak",
        name: "Old Bordeaux",
        producer: "Chateau Test",
        region: "Bordeaux",
        vintage: 2010,
        drink_after: "2012",
        drink_before: "2024",
        purchase_price_cents: 12000,
        current_market_value_cents: 14000,
      }),
      cellar({
        id: "window-gap",
        name: "Windowless Rioja",
        producer: "Bodega Test",
        region: "Rioja",
        vintage: 2018,
        drink_after: null,
        drink_before: null,
        purchase_price_cents: 4500,
        current_market_value_cents: 5500,
      }),
      cellar({
        id: "review-evidence",
        name: "Draft Evidence Barolo",
        producer: "Piedmont Test",
        region: "Piedmont",
        vintage: 2016,
        evidence_awaiting_review_count: 2,
      }),
      cellar({
        id: "stale-market",
        name: "Stale Valuation Brunello",
        producer: "Montalcino Test",
        region: "Tuscany",
        vintage: 2017,
        stale_price_evidence_count: 1,
        current_market_value_cents: 14000,
      }),
      cellar({
        id: "missing-price",
        name: "Unpriced Cabernet",
        producer: "Napa Test",
        region: "Napa Valley",
        vintage: 2021,
        purchase_price_cents: 18500,
        current_market_value_cents: null,
        accepted_price_evidence_count: 0,
      }),
      cellar({
        id: "memory-gap",
        name: "Untasted Pinot",
        producer: "Willamette Test",
        region: "Willamette Valley",
        vintage: 2022,
        ratings_count: 0,
        rating_signal_count: 0,
        purchase_price_cents: 6500,
        current_market_value_cents: 8000,
      }),
      cellar({
        id: "ai-estimate-only",
        name: "AI Mirage Syrah",
        producer: "No Citation Estate",
        region: "California",
        vintage: 2019,
        purchase_price_cents: null,
        current_market_value_cents: null,
        accepted_price_evidence_count: 1,
      }),
      cellar({
        id: "replacement-only",
        name: "Retailer Only Pinot",
        producer: "Shop Listing Estate",
        region: "Sonoma",
        vintage: 2020,
        purchase_price_cents: null,
        current_market_value_cents: null,
        accepted_price_evidence_count: 1,
      }),
      cellar({
        id: "stored-ai-market",
        name: "Stored AI Guess Cabernet",
        producer: "Uncited Model Estate",
        region: "California",
        vintage: 2021,
        purchase_price_cents: null,
        current_market_value_cents: 888888,
        market_value_source: "ai_inferred",
        accepted_price_evidence_count: 0,
      }),
      cellar({
        id: "stored-retailer-market",
        name: "Stored Retail Listing Merlot",
        producer: "Retail Mirror Estate",
        region: "Washington",
        vintage: 2020,
        purchase_price_cents: 4500,
        current_market_value_cents: 7777,
        market_value_source: "retailer",
        accepted_price_evidence_count: 0,
      }),
      cellar({
        id: "sell-watch",
        name: "Gained Ground Cabernet",
        producer: "Value Estate",
        region: "Napa Valley",
        vintage: 2018,
        quantity: 3,
        drink_after: "2030",
        drink_before: "2040",
        purchase_price_cents: 10000,
        current_market_value_cents: null,
        brian_fit_score: 78,
        accepted_price_evidence_count: 1,
      }),
    ],
    priceObservations: [
      {
        id: "draft-review-price",
        inventoryId: "review-evidence",
        sourceType: "retailer",
        sourceName: "Benchmark Retailer",
        sourceUrl: "https://example.com/barolo",
        observationKind: "replacement_price",
        truthLabel: "estimated",
        reviewStatus: "draft",
        observedPriceCents: 9500,
        currency: "USD",
        bottleSizeMl: 750,
        confidence: 72,
        observedAt: "2026-06-23T12:00:00.000Z",
      },
      {
        id: "stale-market-price",
        inventoryId: "stale-market",
        sourceType: "provider",
        sourceName: "Wine-Searcher",
        sourceUrl: "https://example.com/brunello",
        observationKind: "market_value",
        truthLabel: "verified",
        reviewStatus: "accepted",
        observedPriceCents: 14000,
        currency: "USD",
        bottleSizeMl: 750,
        confidence: 86,
        observedAt: "2025-10-01T12:00:00.000Z",
      },
      {
        id: "ai-only-price",
        inventoryId: "ai-estimate-only",
        sourceType: "ai_inferred",
        sourceName: "Model estimate without source",
        sourceUrl: null,
        observationKind: "market_value",
        truthLabel: "ai_inferred",
        reviewStatus: "accepted",
        observedPriceCents: 999999,
        currency: "USD",
        bottleSizeMl: 750,
        confidence: 80,
        observedAt: "2026-06-23T12:00:00.000Z",
      },
      {
        id: "retailer-replacement-only",
        inventoryId: "replacement-only",
        sourceType: "retailer",
        sourceName: "Source-backed Retailer",
        sourceUrl: "https://example.com/retailer-only-pinot",
        observationKind: "replacement_price",
        truthLabel: "estimated",
        reviewStatus: "accepted",
        observedPriceCents: 7000,
        currency: "USD",
        bottleSizeMl: 750,
        confidence: 78,
        observedAt: "2026-06-23T12:00:00.000Z",
      },
      {
        id: "sell-watch-market",
        inventoryId: "sell-watch",
        sourceType: "provider",
        sourceName: "Verified market feed",
        sourceUrl: "https://example.com/gained-ground-cabernet",
        observationKind: "market_value",
        truthLabel: "verified",
        reviewStatus: "accepted",
        observedPriceCents: 16500,
        currency: "USD",
        bottleSizeMl: 750,
        confidence: 91,
        observedAt: "2026-06-23T12:00:00.000Z",
      },
    ],
    acquisition: {
      targets: [
        {
          id: "tapiz-target",
          wineTitle: "2021 Tapiz Alta Collection Cabernet Sauvignon",
          producer: "Tapiz",
          vintage: 2021,
          region: "Mendoza",
          varietal: "Cabernet Sauvignon",
          sourceKind: "buy_again",
          status: "watching",
          targetPriceCents: 9500,
          maxPriceCents: 11000,
          desiredQuantity: 6,
          priority: "must_have",
          nextRefreshAt: "2026-07-15T12:00:00.000Z",
        },
        {
          id: "lewis-target",
          wineTitle: "2020 Lewis Cellars Reserve Cabernet",
          producer: "Lewis Cellars",
          vintage: 2020,
          region: "Napa Valley",
          varietal: "Cabernet Sauvignon",
          sourceKind: "wishlist",
          status: "watching",
          targetPriceCents: 18000,
          maxPriceCents: 22000,
          desiredQuantity: 2,
          priority: "high",
          nextRefreshAt: "2026-06-01T12:00:00.000Z",
        },
      ],
      priceObservations: [
        {
          id: "tapiz-retailer",
          targetId: "tapiz-target",
          observedPriceCents: 9200,
          sourceType: "retailer",
          sourceName: "Benchmark Retailer",
          sourceUrl: "https://example.com/tapiz",
          availability: "available",
          confidence: 88,
          observedAt: "2026-06-23T12:00:00.000Z",
        },
      ],
    },
    replenishment: {
      inventory: [
        {
          id: "tapiz-cellar",
          wineReferenceId: "11111111-1111-4111-8111-111111111111",
          wineTitle: "2021 Tapiz Alta Collection Cabernet Sauvignon",
          producer: "Tapiz",
          vintage: 2021,
          region: "Mendoza",
          varietal: "Cabernet Sauvignon",
          quantity: 1,
          lowStockThreshold: 2,
          lowStockAlertEnabled: true,
          status: "in_cellar",
          purchasePriceCents: 9200,
          purchaseLocation: "Benchmark Wine Shop",
        },
      ],
      ratings: [
        {
          id: "tapiz-rating",
          inventoryId: "tapiz-cellar",
          wineReferenceId: "11111111-1111-4111-8111-111111111111",
          score: 95,
          tastingDate: "2026-06-01",
          notes: "Loved it.",
        },
      ],
      tastings: [],
      existingTargets: [],
      asOf,
    },
    receipts: [
      {
        id: "receipt-1",
        vendor: "Benchmark Wine Shop",
        vendorType: "retailer",
        purchaseDate: "2026-06-24",
        totalCents: 18400,
        items: [
          {
            id: "receipt-item-1",
            rawText: "2 x 2021 Tapiz Alta Collection Cabernet Sauvignon Mendoza @ $92.00",
            wineTitle: "2021 Tapiz Alta Collection Cabernet Sauvignon",
            producer: "Tapiz",
            label: "Alta Collection Cabernet Sauvignon",
            vintage: 2021,
            region: "Mendoza",
            varietal: "Cabernet Sauvignon",
            quantity: 2,
            unitPriceCents: 9200,
            lineTotalCents: 18400,
            acquisitionTargetId: "tapiz-target",
            selected: true,
          },
        ],
      },
    ],
    tastingMemoryDrafts: [
      {
        id: "draft-memory-1",
        inventoryId: "memory-gap",
        wineTitle: "2022 Untasted Pinot",
        status: "draft",
        capturedAt: "2026-06-23T20:00:00.000Z",
        confidence: 70,
      },
    ],
  };
}

function findAction(actions: PortfolioRadarAction[], type: PortfolioRadarAction["type"], targetId: string) {
  const action = actions.find((candidate) => candidate.type === type && candidate.target.id === targetId);
  assert.ok(action, `missing ${type} action for ${targetId}`);
  return action;
}

function assertActionShape(action: PortfolioRadarAction) {
  assert.ok(action.id.startsWith("radar:"));
  assert.ok(action.dedupeKey.length > 0);
  assert.equal(action.id, `radar:${action.dedupeKey}`);
  assert.ok(action.type);
  assert.equal(action.subjectType, action.target.kind);
  assert.equal(action.subjectId, action.target.id);
  assert.equal(typeof action.priority, "number");
  assert.ok(["critical", "high", "medium", "low"].includes(action.severity));
  assert.ok(action.verb.length > 0);
  assert.ok(action.label.length > 0);
  assert.ok(action.reason.length > 0);
  assert.ok(action.confidence >= 0 && action.confidence <= 100);
  assert.ok(action.sourceSurface.length > 0);
  assert.ok(action.cta.label.length > 0);
  assert.ok(action.cta.href.length > 0);
  assert.ok(action.cta.action.length > 0);
  assert.ok(action.target.id.length > 0);
  assert.ok(action.target.href.length > 0);
  assert.ok(action.target.label.length > 0);
  assert.equal(action.affordance.snooze.enabled, true);
  assert.equal(action.affordance.snooze.state, "available");
  assert.equal(action.affordance.snooze.until, null);
  assert.equal(action.affordance.dismiss.enabled, true);
  assert.equal(action.affordance.dismiss.state, "available");
  assert.equal(action.affordance.dismiss.dismissedAt, null);
}

function testRadarBuildsConcreteActionQueueFromAllInputs() {
  const radar = buildPortfolioRadar(sampleInput());

  for (const action of radar.actions) assertActionShape(action);

  assert.equal(radar.asOf, asOf);
  assert.equal(radar.summary.totalActions, radar.actions.length);
  assert.ok(radar.summary.criticalCount >= 1);
  assert.ok(radar.actions.length >= 12);

  findAction(radar.actions, "drink_now", "drink-now");
  findAction(radar.actions, "at_risk_past_peak", "past-peak");
  findAction(radar.actions, "missing_drink_window", "window-gap");
  findAction(radar.actions, "review_price_evidence", "review-evidence");
  findAction(radar.actions, "refresh_valuation", "stale-market");
  findAction(radar.actions, "refresh_valuation", "missing-price");
  findAction(radar.actions, "refresh_valuation", "replacement-only");
  findAction(radar.actions, "replenish", "tapiz-cellar");
  findAction(radar.actions, "acquisition_buy", "tapiz-target");
  findAction(radar.actions, "acquisition_watch", "lewis-target");
  findAction(radar.actions, "close_receipt", "receipt-1");
  findAction(radar.actions, "capture_tasting_memory", "draft-memory-1");
  findAction(radar.actions, "investigate_missing_evidence", "ai-estimate-only");
  findAction(radar.actions, "investigate_missing_evidence", "stored-ai-market");
  findAction(radar.actions, "refresh_valuation", "stored-retailer-market");
  findAction(radar.actions, "sell_watch", "sell-watch");
}

function testReadinessActionsUseTruthBeforePreference() {
  const radar = buildPortfolioRadar(sampleInput());
  const drink = findAction(radar.actions, "drink_now", "drink-now");
  assert.equal(drink.id, "radar:drink_now:cellar_item:drink-now");
  assert.equal(drink.dedupeKey, "drink_now:cellar_item:drink-now");
  assert.equal(drink.verb, "Open");
  assert.equal(drink.label, "Open 2020 Dinner Cabernet");
  assert.match(drink.reason, /Inside its drinking window/);
  assert.equal(drink.confidence, 88);
  assert.equal(drink.sourceSurface, "cellar_command_center");
  assert.deepEqual(drink.cta, {
    label: "Choose bottle",
    href: "/cellar/drink-now",
    action: "open_cellar_item",
  });
  assert.equal(drink.target.kind, "cellar_item");
  assert.equal(drink.target.metadata.readiness, "ready");
  assert.equal(drink.target.metadata.readinessPhase, "ready");
  assert.equal(drink.target.metadata.readinessSource, "inventory");
  assert.equal(drink.target.metadata.quantity, 2);

  const risk = findAction(radar.actions, "at_risk_past_peak", "past-peak");
  assert.equal(risk.severity, "critical");
  assert.ok(risk.priority > drink.priority);
  assert.match(risk.reason, /Past its stated drinking window/);
  assert.equal(risk.target.metadata.readiness, "past_peak");
  assert.equal(risk.target.metadata.readinessPhase, "past_peak");

  const windowGap = findAction(radar.actions, "missing_drink_window", "window-gap");
  assert.equal(windowGap.verb, "Set window");
  assert.match(windowGap.reason, /No drink window is stored/);
  assert.equal(windowGap.cta.action, "set_drink_window");
  assert.equal(windowGap.target.metadata.readinessPhase, "missing_window");
}

function testPortfolioRadarConsumesRicherReadinessPhases() {
  const radar = buildPortfolioRadar({
    asOf,
    cellar: [
      cellar({
        id: "at-peak",
        name: "Peak Cabernet",
        vintage: 2018,
        drink_after: "2022-01-01",
        drink_before: "2030-12-31",
        peak_start: "2026-01-01",
        peak_end: "2026-12-31",
        brian_fit_score: 94,
      }),
      cellar({
        id: "reference-ready",
        name: "Reference Window Pinot",
        vintage: 2020,
        drink_after: null,
        drink_before: null,
        wine_reference_drink_window_start: "2024",
        wine_reference_drink_window_end: "2030",
        current_market_value_cents: 8000,
      }),
    ],
  });

  const peak = findAction(radar.actions, "drink_now", "at-peak");
  assert.equal(peak.target.metadata.readiness, "ready");
  assert.equal(peak.target.metadata.readinessPhase, "at_peak");
  assert.equal(peak.target.metadata.peakStart, "2026-01-01");
  assert.match(peak.reason, /at peak/i);
  assert.ok(peak.priority > 790);

  const referenceReady = findAction(radar.actions, "drink_now", "reference-ready");
  assert.equal(referenceReady.target.metadata.readinessPhase, "ready");
  assert.equal(referenceReady.target.metadata.readinessSource, "wine_reference");
  assert.equal(referenceReady.target.metadata.normalizedDrinkAfter, "2024-01-01");
  assert.equal(
    radar.actions.some((action) => action.type === "missing_drink_window" && action.target.id === "reference-ready"),
    false
  );
}

function testPortfolioRadarConsumesAcceptedDrinkWindowEvidenceWithoutInventoryOverwrite() {
  const radar = buildPortfolioRadar({
    asOf,
    cellar: [
      cellar({
        id: "evidence-ready",
        name: "Evidence Window Barolo",
        vintage: 2016,
        drink_after: null,
        drink_before: null,
        current_market_value_cents: 9000,
        drink_window_observations: [
          normalizeDrinkWindowObservation({
            id: "dw-evidence-ready",
            inventoryId: "evidence-ready",
            sourceType: "winery",
            sourceName: "Producer tech sheet",
            sourceUrl: "https://example.com/barolo-tech-sheet.pdf",
            truthLabel: "estimated",
            reviewStatus: "accepted",
            drinkAfter: "2022",
            drinkBefore: "2032",
            confidence: 84,
            observedAt: "2026-06-01T00:00:00.000Z",
          }),
        ],
      }),
      cellar({
        id: "draft-evidence-only",
        name: "Draft Window Brunello",
        vintage: 2018,
        drink_after: null,
        drink_before: null,
        current_market_value_cents: 9000,
        drink_window_observations: [
          normalizeDrinkWindowObservation({
            id: "dw-draft-only",
            inventoryId: "draft-evidence-only",
            sourceType: "winery",
            sourceName: "Producer draft",
            sourceUrl: "https://example.com/brunello-tech-sheet.pdf",
            truthLabel: "estimated",
            reviewStatus: "draft",
            drinkAfter: "2024",
            drinkBefore: "2030",
            confidence: 90,
            observedAt: "2026-06-01T00:00:00.000Z",
          }),
        ],
      }),
    ],
  });

  const ready = findAction(radar.actions, "drink_now", "evidence-ready");
  assert.equal(ready.target.metadata.readinessPhase, "ready");
  assert.equal(ready.target.metadata.readinessSource, "drink_window_evidence");
  assert.equal(ready.target.metadata.normalizedDrinkAfter, "2022-01-01");
  assert.equal(
    radar.actions.some((action) => action.type === "missing_drink_window" && action.target.id === "evidence-ready"),
    false
  );

  const draftOnly = findAction(radar.actions, "missing_drink_window", "draft-evidence-only");
  assert.equal(draftOnly.target.metadata.readinessPhase, "missing_window");
}

function testValuationEvidenceActionsAndAiGuardrail() {
  const radar = buildPortfolioRadar(sampleInput());

  const review = findAction(radar.actions, "review_price_evidence", "review-evidence");
  assert.equal(review.verb, "Review");
  assert.equal(review.sourceSurface, "portfolio_truth");
  assert.equal(review.target.metadata.evidenceAwaitingReview, 2);
  assert.match(review.reason, /2 price evidence items await review/);

  const stale = findAction(radar.actions, "refresh_valuation", "stale-market");
  assert.equal(stale.verb, "Refresh");
  assert.equal(stale.target.metadata.stalePriceEvidenceCount, 1);
  assert.equal(stale.target.metadata.marketValueCents, 14000);
  assert.equal(stale.target.metadata.refreshScope, "pricing");
  assert.match(String(stale.target.metadata.refreshReasons), /stale_market_value/);
  assert.match(stale.reason, /stale/i);

  const missing = findAction(radar.actions, "refresh_valuation", "missing-price");
  assert.equal(missing.target.metadata.marketValueCents, null);
  assert.match(String(missing.target.metadata.refreshReasons), /missing_market_value/);
  assert.match(missing.reason, /No trusted market value/i);

  const replacementOnly = findAction(radar.actions, "refresh_valuation", "replacement-only");
  assert.equal(replacementOnly.target.metadata.marketValueCents, null);
  assert.equal(replacementOnly.target.metadata.replacementPriceCents, 7000);
  assert.match(String(replacementOnly.target.metadata.refreshReasons), /missing_market_value/);
  assert.match(replacementOnly.reason, /No trusted market value/i);

  const aiOnly = findAction(radar.actions, "investigate_missing_evidence", "ai-estimate-only");
  assert.equal(aiOnly.target.metadata.marketValueCents, null);
  assert.equal(aiOnly.target.metadata.replacementPriceCents, null);
  assert.equal(aiOnly.target.metadata.aiInferredObservedPriceCents, 999999);
  assert.match(aiOnly.reason, /AI-inferred estimate/i);
  assert.equal(
    radar.actions.some(
      (action) =>
        action.target.id === "ai-estimate-only" &&
        action.type === "refresh_valuation" &&
        action.target.metadata.marketValueCents === 999999
    ),
    false
  );

  const storedAi = findAction(radar.actions, "investigate_missing_evidence", "stored-ai-market");
  assert.equal(storedAi.target.metadata.marketValueCents, null);
  assert.equal(storedAi.target.metadata.aiInferredObservedPriceCents, 888888);
  assert.match(storedAi.reason, /AI-inferred estimate/i);
  assert.equal(
    radar.actions.some(
      (action) =>
        action.target.id === "stored-ai-market" &&
        action.type === "refresh_valuation" &&
        action.target.metadata.marketValueCents === 888888
    ),
    false
  );

  const storedRetailer = findAction(radar.actions, "refresh_valuation", "stored-retailer-market");
  assert.equal(storedRetailer.target.metadata.marketValueCents, null);
  assert.equal(storedRetailer.target.metadata.replacementPriceCents, null);
  assert.match(storedRetailer.reason, /No trusted market value/i);
  assert.equal(
    radar.actions.some(
      (action) =>
        action.target.id === "stored-retailer-market" &&
        action.target.metadata.marketValueCents === 7777
    ),
    false
  );

  const sellWatch = findAction(radar.actions, "sell_watch", "sell-watch");
  assert.equal(sellWatch.verb, "Review sell-watch");
  assert.equal(sellWatch.sourceSurface, "portfolio_truth");
  assert.equal(sellWatch.target.metadata.valuationPhase, "sell_watch");
  assert.equal(sellWatch.target.metadata.marketValueCents, 16500);
  assert.equal(sellWatch.target.metadata.marketValueObservationId, "sell-watch-market");
  assert.equal(sellWatch.target.metadata.gainLossCents, 6500);
  assert.equal(sellWatch.target.metadata.gainLossPercent, 0.65);
  assert.match(sellWatch.reason, /65% gain/);
  assert.match(sellWatch.reason, /review-only signal/i);
  assert.equal(sellWatch.cta.action, "review_sell_watch");
}

function testAcquisitionReplenishmentReceiptAndMemoryActions() {
  const radar = buildPortfolioRadar(sampleInput());

  const replenish = findAction(radar.actions, "replenish", "tapiz-cellar");
  assert.equal(replenish.sourceSurface, "replenishment_automation");
  assert.equal(replenish.verb, "Replenish");
  assert.equal(replenish.target.metadata.desiredQuantity, 2);
  assert.match(replenish.reason, /Low stock on a bottle with strong tasting evidence/);

  const buy = findAction(radar.actions, "acquisition_buy", "tapiz-target");
  assert.equal(buy.sourceSurface, "acquisition_engine");
  assert.equal(buy.verb, "Buy");
  assert.equal(buy.target.metadata.projectedSpendCents, 55200);
  assert.match(buy.reason, /at or below the target price/i);

  const watch = findAction(radar.actions, "acquisition_watch", "lewis-target");
  assert.equal(watch.verb, "Watch");
  assert.equal(watch.target.metadata.refreshDue, true);
  assert.match(watch.reason, /Refresh needed: refresh scheduled/);

  const receipt = findAction(radar.actions, "close_receipt", "receipt-1");
  assert.equal(receipt.sourceSurface, "acquisition_receipt");
  assert.equal(receipt.verb, "Close receipt");
  assert.equal(receipt.target.metadata.closeoutCount, 1);
  assert.equal(receipt.cta.action, "close_acquisition_receipt");

  const memory = findAction(radar.actions, "capture_tasting_memory", "draft-memory-1");
  assert.equal(memory.sourceSurface, "tasting_memory");
  assert.equal(memory.verb, "Capture");
  assert.equal(memory.target.kind, "tasting_memory");
  assert.equal(memory.target.metadata.inventoryId, "memory-gap");
}

function testPrioritizationAndDeterminism() {
  const input = sampleInput();
  const first = buildPortfolioRadar(input);
  const second = buildPortfolioRadar(input);

  assert.deepEqual(second, first);
  assert.deepEqual(
    first.actions.slice(0, 5).map((action) => `${action.type}:${action.target.id}`),
    [
      "at_risk_past_peak:past-peak",
      "review_price_evidence:review-evidence",
      "refresh_valuation:stale-market",
      "close_receipt:receipt-1",
      "acquisition_buy:tapiz-target",
    ]
  );
}

testRadarBuildsConcreteActionQueueFromAllInputs();
testReadinessActionsUseTruthBeforePreference();
testPortfolioRadarConsumesRicherReadinessPhases();
testPortfolioRadarConsumesAcceptedDrinkWindowEvidenceWithoutInventoryOverwrite();
testValuationEvidenceActionsAndAiGuardrail();
testAcquisitionReplenishmentReceiptAndMemoryActions();
testPrioritizationAndDeterminism();

console.log("portfolio-radar tests passed");
