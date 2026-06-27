import type { PortfolioRefreshSkipReason } from "./portfolio-radar-refresh";
import type { PortfolioRefreshDbScope, PortfolioRefreshDbStatus, PortfolioRefreshRun } from "./portfolio-radar-refresh-runner";

export type PortfolioRefreshScheduleWindow = "daily" | "weekly";

export type PortfolioRefreshScheduleHistoryRow = {
  inventoryId: string;
  label?: string | null;
  scope: PortfolioRefreshDbScope | string;
  status: PortfolioRefreshDbStatus | "planned" | "running" | string;
  startedAt: string;
  completedAt?: string | null;
  gaps?: string[] | null;
};

export type PortfolioRefreshScheduleSummaryInput = {
  asOf: string | Date;
  window: PortfolioRefreshScheduleWindow;
  run: PortfolioRefreshRun;
  recentHistory?: PortfolioRefreshScheduleHistoryRow[];
};

export type PortfolioRefreshScheduleSummary = {
  window: PortfolioRefreshScheduleWindow;
  asOf: string;
  lookbackHours: number;
  due: {
    plannerDue: number;
    planned: number;
    highPriority: number;
    deferred: number;
  };
  recorded: {
    planned: number;
    skipped: number;
    totalRows: number;
  };
  skipped: {
    total: number;
    byReason: Record<PortfolioRefreshSkipReason, number>;
  };
  changed: {
    completed: number;
    failed: number;
    labels: string[];
  };
  cost: {
    estimatedCostUnits: number;
    paidProviderCalls: number;
  };
  topDueLabels: string[];
  topSkippedLabels: string[];
  narrative: string[];
};

const EMPTY_SKIP_REASON_COUNTS: Record<PortfolioRefreshSkipReason, number> = {
  inactive_inventory: 0,
  review_pending: 0,
  cooldown_active: 0,
  ai_inferred_only: 0,
  fresh_enough: 0,
  no_actionable_gap: 0,
  budget_deferred: 0,
};

function asIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function safeTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function lookbackHoursFor(window: PortfolioRefreshScheduleWindow) {
  return window === "weekly" ? 168 : 24;
}

function periodLabel(window: PortfolioRefreshScheduleWindow) {
  return window === "weekly" ? "last 7 days" : "last 24 hours";
}

function rowLabel(row: PortfolioRefreshRun["rows"][number]) {
  return row.plan.queueItem?.label ?? row.plan.skippedItem?.label ?? row.inventory_id;
}

function historyLabel(row: PortfolioRefreshScheduleHistoryRow) {
  return row.label?.trim() || row.inventoryId;
}

function topLabels(labels: string[]) {
  return [...new Set(labels.filter(Boolean))].slice(0, 5);
}

function recentRows(rows: PortfolioRefreshScheduleHistoryRow[], asOf: string, lookbackHours: number) {
  const asOfTime = safeTime(asOf) ?? Date.now();
  const floor = asOfTime - lookbackHours * 60 * 60 * 1000;
  return rows.filter((row) => {
    const time = safeTime(row.completedAt) ?? safeTime(row.startedAt);
    return time != null && time >= floor && time <= asOfTime;
  });
}

function skipReasonsFor(row: PortfolioRefreshRun["rows"][number]) {
  return row.plan.skippedItem?.skipReasons ?? [];
}

function sentenceJoin(labels: string[]) {
  if (labels.length === 0) return "none";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

export function buildPortfolioRefreshScheduleSummary(input: PortfolioRefreshScheduleSummaryInput): PortfolioRefreshScheduleSummary {
  const asOf = asIso(input.asOf);
  const lookbackHours = lookbackHoursFor(input.window);
  const plannedRows = input.run.rows.filter((row) => row.status === "planned");
  const skippedRows = input.run.rows.filter((row) => row.status === "skipped");
  const skippedByReason = { ...EMPTY_SKIP_REASON_COUNTS };

  for (const row of skippedRows) {
    for (const reason of skipReasonsFor(row)) {
      skippedByReason[reason] += 1;
    }
  }

  const dueLabels = topLabels(plannedRows.map(rowLabel));
  const skippedLabels = topLabels(skippedRows.map(rowLabel));
  const recent = recentRows(input.recentHistory ?? [], asOf, lookbackHours);
  const completedRows = recent.filter((row) => row.status === "completed");
  const failedRows = recent.filter((row) => row.status === "failed");
  const changedLabels = topLabels([...completedRows, ...failedRows].map(historyLabel));
  const deferred = skippedByReason.budget_deferred;
  const reviewPending = skippedByReason.review_pending;

  const narrative = [
    `Due: ${plannedRows.length} recorded refresh actions from ${input.run.summary.planDueCount} planner candidates (${input.run.summary.estimatedCostUnits} cost units; ${input.run.summary.paidProviderCalls} paid provider calls).`,
    `Skipped/deferred: ${skippedRows.length} (${deferred} budget deferred, ${reviewPending} review pending).`,
    `Changed in the ${periodLabel(input.window)}: ${completedRows.length} completed, ${failedRows.length} failed.`,
    `Top due: ${sentenceJoin(dueLabels)}.`,
  ];
  if (skippedLabels.length) narrative.push(`Top skipped: ${sentenceJoin(skippedLabels)}.`);
  if (changedLabels.length) narrative.push(`Recent changed: ${sentenceJoin(changedLabels)}.`);

  return {
    window: input.window,
    asOf,
    lookbackHours,
    due: {
      plannerDue: input.run.summary.planDueCount,
      planned: plannedRows.length,
      highPriority: plannedRows.filter((row) => (row.plan.queueItem?.priority ?? 0) >= 820).length,
      deferred,
    },
    recorded: {
      planned: plannedRows.length,
      skipped: skippedRows.length,
      totalRows: input.run.rows.length,
    },
    skipped: {
      total: skippedRows.length,
      byReason: skippedByReason,
    },
    changed: {
      completed: completedRows.length,
      failed: failedRows.length,
      labels: changedLabels,
    },
    cost: {
      estimatedCostUnits: input.run.summary.estimatedCostUnits,
      paidProviderCalls: input.run.summary.paidProviderCalls,
    },
    topDueLabels: dueLabels,
    topSkippedLabels: skippedLabels,
    narrative,
  };
}
