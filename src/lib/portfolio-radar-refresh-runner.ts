import type {
  PortfolioRefreshPlan,
  PortfolioRefreshQueueItem,
  PortfolioRefreshReason,
  PortfolioRefreshScope,
  PortfolioRefreshSkippedItem,
  PortfolioRefreshSkipReason,
} from "./portfolio-radar-refresh";

export type PortfolioRefreshRunMode = "record_only";
export type PortfolioRefreshDbScope = PortfolioRefreshScope | "quick";
export type PortfolioRefreshDbStatus = "planned" | "completed" | "failed" | "skipped";

export type PortfolioRefreshRunInput = {
  plan: PortfolioRefreshPlan;
  asOf?: string | Date;
  runId?: string;
  mode?: PortfolioRefreshRunMode;
  maxItems?: number;
  includeSkipped?: boolean;
  maxSkipped?: number;
};

export type PortfolioRefreshProviderStatus = {
  runner: "portfolio_radar_refresh_runner";
  mode: PortfolioRefreshRunMode;
  executed: false;
  paidProviderCalled: false;
  reason: "refresh_due_recorded_without_paid_provider_call" | "refresh_skipped_by_planner";
  runId: string;
};

export type PortfolioRefreshRunPlanPayload = {
  runner: "portfolio_radar_refresh_runner";
  runId: string;
  mode: PortfolioRefreshRunMode;
  source: "portfolio_radar_refresh_plan";
  queueItem: PortfolioRefreshQueueItem | null;
  skippedItem: PortfolioRefreshSkippedItem | null;
  planAsOf: string;
};

export type PortfolioRefreshPersistenceRow = {
  inventory_id: string;
  scope: PortfolioRefreshDbScope;
  status: PortfolioRefreshDbStatus;
  plan: PortfolioRefreshRunPlanPayload;
  provider_status: PortfolioRefreshProviderStatus;
  gaps: string[];
  started_at: string;
  completed_at: string | null;
  error: string | null;
};

export type PortfolioRefreshRunSummary = {
  runId: string;
  mode: PortfolioRefreshRunMode;
  asOf: string;
  planDueCount: number;
  planSkippedCount: number;
  plannedCount: number;
  skippedCount: number;
  totalRows: number;
  estimatedCostUnits: number;
  paidProviderCalls: 0;
};

export type PortfolioRefreshRun = {
  summary: PortfolioRefreshRunSummary;
  rows: PortfolioRefreshPersistenceRow[];
};

const REASON_COPY: Record<PortfolioRefreshReason, string> = {
  missing_market_value: "No trusted market value is available.",
  missing_replacement_price: "No trusted replacement price is available.",
  stale_market_value: "Trusted market evidence is stale.",
  stale_replacement_price: "Trusted replacement evidence is stale.",
  high_value_watch: "High-value bottle needs tighter refresh cadence.",
  readiness_transition: "Readiness is changing and should be rechecked.",
  unresolved_radar_action: "Existing Portfolio Radar action still needs fresh evidence.",
};

const SKIP_COPY: Record<PortfolioRefreshSkipReason, string> = {
  inactive_inventory: "Skipped: inventory is inactive.",
  review_pending: "Skipped: review pending evidence should be resolved before another refresh.",
  cooldown_active: "Skipped: cooldown active.",
  ai_inferred_only: "Skipped: only AI-inferred context exists, so paid/provider refresh is not trusted yet.",
  fresh_enough: "Skipped: existing evidence is fresh enough.",
  no_actionable_gap: "Skipped: no actionable gap was found.",
  budget_deferred: "Skipped: budget deferred this refresh.",
};

function asIso(value: string | Date | undefined, fallback: string) {
  if (!value) return fallback;
  return value instanceof Date ? value.toISOString() : value;
}

function safeLimit(value: number | undefined, fallback: number) {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function defaultRunId(asOf: string) {
  return `portfolio-radar-refresh:${asOf.replace(/[^0-9A-Za-z-]/g, "-")}`;
}

function scopeFromReasons(reasons: PortfolioRefreshReason[]): PortfolioRefreshDbScope {
  if (reasons.includes("stale_market_value") || reasons.includes("missing_market_value")) {
    return reasons.includes("high_value_watch") ? "deep" : "pricing";
  }
  if (reasons.includes("stale_replacement_price") || reasons.includes("missing_replacement_price")) return "replacement";
  if (reasons.includes("readiness_transition")) return "readiness";
  return "quick";
}

function dueGaps(item: PortfolioRefreshQueueItem) {
  return item.reasons.map((reason) => REASON_COPY[reason]);
}

function skippedGaps(item: PortfolioRefreshSkippedItem) {
  return [
    ...item.skipReasons.map((reason) => SKIP_COPY[reason]),
    ...item.candidateReasons.map((reason) => REASON_COPY[reason]),
  ];
}

function providerStatus(runId: string, mode: PortfolioRefreshRunMode, reason: PortfolioRefreshProviderStatus["reason"]): PortfolioRefreshProviderStatus {
  return {
    runner: "portfolio_radar_refresh_runner",
    mode,
    executed: false,
    paidProviderCalled: false,
    reason,
    runId,
  };
}

function planPayload(params: {
  runId: string;
  mode: PortfolioRefreshRunMode;
  planAsOf: string;
  queueItem?: PortfolioRefreshQueueItem | null;
  skippedItem?: PortfolioRefreshSkippedItem | null;
}): PortfolioRefreshRunPlanPayload {
  return {
    runner: "portfolio_radar_refresh_runner",
    runId: params.runId,
    mode: params.mode,
    source: "portfolio_radar_refresh_plan",
    queueItem: params.queueItem ?? null,
    skippedItem: params.skippedItem ?? null,
    planAsOf: params.planAsOf,
  };
}

function rowForDueItem(item: PortfolioRefreshQueueItem, runId: string, mode: PortfolioRefreshRunMode, asOf: string, planAsOf: string): PortfolioRefreshPersistenceRow {
  return {
    inventory_id: item.inventoryId,
    scope: item.scope,
    status: "planned",
    plan: planPayload({ runId, mode, planAsOf, queueItem: item }),
    provider_status: providerStatus(runId, mode, "refresh_due_recorded_without_paid_provider_call"),
    gaps: dueGaps(item),
    started_at: asOf,
    completed_at: null,
    error: null,
  };
}

function rowForSkippedItem(item: PortfolioRefreshSkippedItem, runId: string, mode: PortfolioRefreshRunMode, asOf: string, planAsOf: string): PortfolioRefreshPersistenceRow {
  return {
    inventory_id: item.inventoryId,
    scope: scopeFromReasons(item.candidateReasons),
    status: "skipped",
    plan: planPayload({ runId, mode, planAsOf, skippedItem: item }),
    provider_status: providerStatus(runId, mode, "refresh_skipped_by_planner"),
    gaps: skippedGaps(item),
    started_at: asOf,
    completed_at: asOf,
    error: null,
  };
}

export function buildPortfolioRefreshRun(input: PortfolioRefreshRunInput): PortfolioRefreshRun {
  const mode = input.mode ?? "record_only";
  const asOf = asIso(input.asOf, input.plan.asOf);
  const runId = input.runId ?? defaultRunId(asOf);
  const maxItems = safeLimit(input.maxItems, input.plan.items.length);
  const includeSkipped = input.includeSkipped ?? true;
  const maxSkipped = safeLimit(input.maxSkipped, 25);
  const plannedRows = input.plan.items
    .slice(0, maxItems)
    .map((item) => rowForDueItem(item, runId, mode, asOf, input.plan.asOf));
  const skippedRows = includeSkipped
    ? input.plan.skipped.slice(0, maxSkipped).map((item) => rowForSkippedItem(item, runId, mode, asOf, input.plan.asOf))
    : [];
  const rows = [...plannedRows, ...skippedRows];

  return {
    rows,
    summary: {
      runId,
      mode,
      asOf,
      planDueCount: input.plan.items.length,
      planSkippedCount: input.plan.skipped.length,
      plannedCount: plannedRows.length,
      skippedCount: skippedRows.length,
      totalRows: rows.length,
      estimatedCostUnits: plannedRows.reduce((sum, row) => sum + (row.plan.queueItem?.costUnits ?? 0), 0),
      paidProviderCalls: 0,
    },
  };
}
