import assert from "node:assert/strict";
import {
  applyPortfolioRadarOutcomes,
  normalizePortfolioRadarOutcome,
  type PortfolioRadarActionOutcome,
} from "../src/lib/portfolio-radar-outcomes";
import type { PortfolioRadar, PortfolioRadarAction } from "../src/lib/portfolio-radar";

const asOf = "2026-06-27T12:00:00.000Z";

function action(overrides: Partial<PortfolioRadarAction> = {}): PortfolioRadarAction {
  const type = overrides.type ?? "drink_now";
  const target = overrides.target ?? {
    kind: "cellar_item" as const,
    id: "cellar-1",
    href: "/cellar/cellar-1",
    label: "2020 Test Cabernet",
    metadata: {
      readinessPhase: "ready",
      marketValueCents: 12000,
    },
  };
  const dedupeKey = overrides.dedupeKey ?? `${type}:${target.kind}:${target.id}`;
  return {
    id: `radar:${dedupeKey}`,
    dedupeKey,
    type,
    subjectType: target.kind,
    subjectId: target.id,
    priority: overrides.priority ?? 800,
    severity: overrides.severity ?? "high",
    verb: overrides.verb ?? "Open",
    label: overrides.label ?? "Open 2020 Test Cabernet",
    reason: overrides.reason ?? "Inside the drinking window.",
    confidence: overrides.confidence ?? 88,
    sourceSurface: overrides.sourceSurface ?? "cellar_command_center",
    cta: overrides.cta ?? { label: "Choose bottle", href: target.href, action: "open_cellar_item" },
    target,
    affordance: overrides.affordance ?? {
      snooze: { enabled: true, state: "available", until: null, suggestedUntil: null },
      dismiss: { enabled: true, state: "available", dismissedAt: null },
    },
  };
}

function radar(actions: PortfolioRadarAction[]): PortfolioRadar {
  return {
    asOf,
    actions,
    summary: {
      totalActions: actions.length,
      criticalCount: actions.filter((item) => item.severity === "critical").length,
      highCount: actions.filter((item) => item.severity === "high").length,
      mediumCount: actions.filter((item) => item.severity === "medium").length,
      lowCount: actions.filter((item) => item.severity === "low").length,
      byType: {
        drink_now: actions.filter((item) => item.type === "drink_now").length,
        at_risk_past_peak: actions.filter((item) => item.type === "at_risk_past_peak").length,
        missing_drink_window: actions.filter((item) => item.type === "missing_drink_window").length,
        review_price_evidence: actions.filter((item) => item.type === "review_price_evidence").length,
        refresh_valuation: actions.filter((item) => item.type === "refresh_valuation").length,
        sell_watch: actions.filter((item) => item.type === "sell_watch").length,
        replenish: actions.filter((item) => item.type === "replenish").length,
        acquisition_buy: actions.filter((item) => item.type === "acquisition_buy").length,
        acquisition_watch: actions.filter((item) => item.type === "acquisition_watch").length,
        close_receipt: actions.filter((item) => item.type === "close_receipt").length,
        capture_tasting_memory: actions.filter((item) => item.type === "capture_tasting_memory").length,
        investigate_missing_evidence: actions.filter((item) => item.type === "investigate_missing_evidence").length,
      },
    },
    refreshPlan: {
      asOf,
      items: [],
      skipped: [],
      summary: {
        dueCount: 0,
        highPriorityCount: 0,
        deferredCount: 0,
        estimatedCostUnits: 0,
        budget: { maxItems: 25, maxCostUnits: 20 },
        byScope: { pricing: 0, replacement: 0, readiness: 0, deep: 0 },
        byReason: {
          missing_market_value: 0,
          missing_replacement_price: 0,
          stale_market_value: 0,
          stale_replacement_price: 0,
          high_value_watch: 0,
          readiness_transition: 0,
          unresolved_radar_action: 0,
        },
        skippedByReason: {
          inactive_inventory: 0,
          review_pending: 0,
          cooldown_active: 0,
          ai_inferred_only: 0,
          fresh_enough: 0,
          no_actionable_gap: 0,
          budget_deferred: 0,
        },
      },
    },
  };
}

function outcome(overrides: Partial<PortfolioRadarActionOutcome> = {}): PortfolioRadarActionOutcome {
  return normalizePortfolioRadarOutcome({
    id: overrides.id ?? "outcome-1",
    actionDedupeKey: overrides.actionDedupeKey ?? "drink_now:cellar_item:cellar-1",
    actionType: overrides.actionType ?? "drink_now",
    subjectType: overrides.subjectType ?? "cellar_item",
    subjectId: overrides.subjectId ?? "cellar-1",
    resultType: overrides.resultType ?? "opened",
    sourceSurface: overrides.sourceSurface ?? "cellar_command_center",
    maturityFeedback: overrides.maturityFeedback ?? "ideal",
    suppressUntil: overrides.suppressUntil ?? null,
    notes: overrides.notes ?? "Opened with dinner.",
    createdAt: overrides.createdAt ?? "2026-06-27T11:00:00.000Z",
    rawPayload: overrides.rawPayload ?? { evidencePolicy: "outcome_only_no_source_truth_overwrite" },
  });
}

function testOutcomesCloseMatchingRadarActionsWithoutChangingEvidenceMetadata() {
  const drink = action();
  const price = action({
    type: "refresh_valuation",
    target: {
      kind: "cellar_item",
      id: "cellar-2",
      href: "/cellar/cellar-2",
      label: "2018 Value Cabernet",
      metadata: { marketValueCents: 18000, readinessPhase: "hold" },
    },
    label: "Refresh valuation for 2018 Value Cabernet",
    priority: 700,
    severity: "medium",
    sourceSurface: "portfolio_truth",
    cta: { label: "Refresh valuation", href: "/cellar/cellar-2?focus=valuation-refresh", action: "refresh_valuation" },
  });
  const applied = applyPortfolioRadarOutcomes(radar([drink, price]), [outcome()], { asOf });

  assert.deepEqual(applied.radar.actions.map((item) => item.dedupeKey), ["refresh_valuation:cellar_item:cellar-2"]);
  assert.equal(applied.outcomeSummary.closedActions, 1);
  assert.equal(applied.outcomeSummary.openedBottles, 1);
  assert.equal(applied.outcomeSummary.maturityFeedbackCount, 1);
  assert.equal(applied.hiddenActions[0].action.dedupeKey, drink.dedupeKey);
  assert.equal(applied.hiddenActions[0].outcome.resultType, "opened");
  assert.equal(price.target.metadata.marketValueCents, 18000);
}

function testDismissAndSkipSuppressOnlyUntilExpiryWhenProvided() {
  const dismissedAction = action({
    type: "sell_watch",
    label: "Review sell-watch",
    sourceSurface: "portfolio_truth",
    cta: { label: "Review value trade-off", href: "/cellar/cellar-1?focus=sell-watch", action: "review_sell_watch" },
  });
  const expiredSkipAction = action({
    type: "replenish",
    target: {
      kind: "cellar_item",
      id: "cellar-3",
      href: "/cellar/cellar-3",
      label: "2021 Tapiz",
      metadata: { lowStockThreshold: 2 },
    },
    label: "Replenish 2021 Tapiz",
    sourceSurface: "replenishment_automation",
    cta: { label: "Create acquisition target", href: "/intelligence?focus=replenishment", action: "create_replenishment_target" },
  });

  const applied = applyPortfolioRadarOutcomes(
    radar([dismissedAction, expiredSkipAction]),
    [
      outcome({
        id: "dismiss-1",
        actionDedupeKey: dismissedAction.dedupeKey,
        actionType: "sell_watch",
        subjectId: "cellar-1",
        resultType: "dismissed",
        maturityFeedback: null,
      }),
      outcome({
        id: "skip-expired",
        actionDedupeKey: expiredSkipAction.dedupeKey,
        actionType: "replenish",
        subjectId: "cellar-3",
        resultType: "skipped",
        maturityFeedback: null,
        suppressUntil: "2026-06-26T12:00:00.000Z",
      }),
    ],
    { asOf }
  );

  assert.deepEqual(applied.radar.actions.map((item) => item.dedupeKey), [expiredSkipAction.dedupeKey]);
  assert.equal(applied.outcomeSummary.dismissedActions, 1);
  assert.equal(applied.outcomeSummary.skippedActions, 0);
}

function testNormalizationGuardsOutcomeOnlyLearningPolicy() {
  const normalized = outcome({
    resultType: "opened",
    maturityFeedback: "fading",
    rawPayload: { label: "Open bottle", trustedEvidenceWrite: false },
  });

  assert.equal(normalized.resultType, "opened");
  assert.equal(normalized.maturityFeedback, "fading");
  assert.equal(normalized.learningPolicy, "outcome_only_no_source_truth_overwrite");
  assert.equal(normalized.rawPayload.trustedEvidenceWrite, false);
}

testOutcomesCloseMatchingRadarActionsWithoutChangingEvidenceMetadata();
testDismissAndSkipSuppressOnlyUntilExpiryWhenProvided();
testNormalizationGuardsOutcomeOnlyLearningPolicy();

console.log("portfolio-radar outcomes tests passed");
