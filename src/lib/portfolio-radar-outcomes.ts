import type {
  PortfolioRadar,
  PortfolioRadarAction,
  PortfolioRadarActionType,
  PortfolioRadarSourceSurface,
  PortfolioRadarSummary,
  PortfolioRadarTargetKind,
} from "./portfolio-radar";

export type PortfolioRadarOutcomeResultType = "opened" | "dismissed" | "skipped";
export type PortfolioRadarMaturityFeedback = "too_young" | "ideal" | "fading" | "dead";
export type PortfolioRadarOutcomeLearningPolicy = "outcome_only_no_source_truth_overwrite";

export type PortfolioRadarActionOutcome = {
  id: string;
  ownerId?: string | null;
  actionDedupeKey: string;
  actionType: PortfolioRadarActionType;
  subjectType: PortfolioRadarTargetKind;
  subjectId: string;
  resultType: PortfolioRadarOutcomeResultType;
  sourceSurface?: PortfolioRadarSourceSurface | null;
  maturityFeedback?: PortfolioRadarMaturityFeedback | null;
  suppressUntil?: string | null;
  notes?: string | null;
  createdAt: string;
  rawPayload: Record<string, unknown>;
  learningPolicy: PortfolioRadarOutcomeLearningPolicy;
};

export type PortfolioRadarOutcomeRequest = Omit<
  PortfolioRadarActionOutcome,
  "id" | "ownerId" | "createdAt" | "learningPolicy"
> & {
  id?: string;
  ownerId?: string | null;
  createdAt?: string;
};

export type PortfolioRadarHiddenAction = {
  action: PortfolioRadarAction;
  outcome: PortfolioRadarActionOutcome;
};

export type PortfolioRadarOutcomeSummary = {
  totalOutcomes: number;
  closedActions: number;
  openedBottles: number;
  dismissedActions: number;
  skippedActions: number;
  maturityFeedbackCount: number;
  recentOutcomes: Array<{
    id: string;
    actionDedupeKey: string;
    resultType: PortfolioRadarOutcomeResultType;
    subjectType: PortfolioRadarTargetKind;
    subjectId: string;
    createdAt: string;
    maturityFeedback: PortfolioRadarMaturityFeedback | null;
  }>;
};

export type ApplyPortfolioRadarOutcomesResult = {
  radar: PortfolioRadar;
  hiddenActions: PortfolioRadarHiddenAction[];
  outcomeSummary: PortfolioRadarOutcomeSummary;
};

export type PortfolioRadarOutcomeInsertRow = {
  owner_id: string;
  action_dedupe_key: string;
  action_type: PortfolioRadarActionType;
  subject_type: PortfolioRadarTargetKind;
  subject_id: string;
  result_type: PortfolioRadarOutcomeResultType;
  source_surface: PortfolioRadarSourceSurface | null;
  maturity_feedback: PortfolioRadarMaturityFeedback | null;
  suppress_until: string | null;
  notes: string | null;
  raw_payload: Record<string, unknown>;
};

const ACTION_TYPES: PortfolioRadarActionType[] = [
  "drink_now",
  "at_risk_past_peak",
  "missing_drink_window",
  "review_price_evidence",
  "refresh_valuation",
  "sell_watch",
  "replenish",
  "acquisition_buy",
  "acquisition_watch",
  "close_receipt",
  "capture_tasting_memory",
  "investigate_missing_evidence",
];

const LEARNING_POLICY: PortfolioRadarOutcomeLearningPolicy = "outcome_only_no_source_truth_overwrite";

function isoOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoOrNow(value: string | null | undefined) {
  return isoOrNull(value) ?? new Date(0).toISOString();
}

function normalizedPayload(rawPayload: Record<string, unknown> | null | undefined) {
  return {
    ...(rawPayload ?? {}),
    evidencePolicy: LEARNING_POLICY,
  };
}

function normalizeOptionalText(value: string | null | undefined, maxLength = 2000) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function activeOutcomes(outcomes: PortfolioRadarActionOutcome[], asOf: string) {
  const asOfTime = new Date(asOf).getTime();
  return outcomes.filter((outcome) => {
    const suppressUntil = outcome.suppressUntil ? new Date(outcome.suppressUntil).getTime() : null;
    if (suppressUntil != null && Number.isFinite(suppressUntil) && suppressUntil <= asOfTime) {
      return false;
    }
    return true;
  });
}

function matchesAction(outcome: PortfolioRadarActionOutcome, action: PortfolioRadarAction) {
  if (outcome.actionDedupeKey === action.dedupeKey) return true;
  return outcome.actionType === action.type &&
    outcome.subjectType === action.subjectType &&
    outcome.subjectId === action.subjectId;
}

function compareOutcomes(a: PortfolioRadarActionOutcome, b: PortfolioRadarActionOutcome) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id);
}

function summaryForActions(actions: PortfolioRadarAction[]): PortfolioRadarSummary {
  const byType = Object.fromEntries(ACTION_TYPES.map((type) => [type, 0])) as Record<PortfolioRadarActionType, number>;
  for (const action of actions) byType[action.type] += 1;
  return {
    totalActions: actions.length,
    criticalCount: actions.filter((action) => action.severity === "critical").length,
    highCount: actions.filter((action) => action.severity === "high").length,
    mediumCount: actions.filter((action) => action.severity === "medium").length,
    lowCount: actions.filter((action) => action.severity === "low").length,
    byType,
  };
}

export function normalizePortfolioRadarOutcome(input: PortfolioRadarOutcomeRequest): PortfolioRadarActionOutcome {
  return {
    id: input.id ?? `outcome:${input.actionDedupeKey}:${input.resultType}`,
    ownerId: input.ownerId ?? null,
    actionDedupeKey: input.actionDedupeKey,
    actionType: input.actionType,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    resultType: input.resultType,
    sourceSurface: input.sourceSurface ?? null,
    maturityFeedback: input.maturityFeedback ?? null,
    suppressUntil: isoOrNull(input.suppressUntil),
    notes: normalizeOptionalText(input.notes),
    createdAt: isoOrNow(input.createdAt),
    rawPayload: normalizedPayload(input.rawPayload),
    learningPolicy: LEARNING_POLICY,
  };
}

export function portfolioRadarOutcomeFromRecord(row: Record<string, unknown>): PortfolioRadarActionOutcome {
  return normalizePortfolioRadarOutcome({
    id: String(row.id),
    ownerId: (row.owner_id as string | null | undefined) ?? null,
    actionDedupeKey: String(row.action_dedupe_key),
    actionType: row.action_type as PortfolioRadarActionType,
    subjectType: row.subject_type as PortfolioRadarTargetKind,
    subjectId: String(row.subject_id),
    resultType: row.result_type as PortfolioRadarOutcomeResultType,
    sourceSurface: (row.source_surface as PortfolioRadarSourceSurface | null | undefined) ?? null,
    maturityFeedback: (row.maturity_feedback as PortfolioRadarMaturityFeedback | null | undefined) ?? null,
    suppressUntil: (row.suppress_until as string | null | undefined) ?? null,
    notes: (row.notes as string | null | undefined) ?? null,
    createdAt: String(row.created_at ?? new Date(0).toISOString()),
    rawPayload: (row.raw_payload as Record<string, unknown> | null | undefined) ?? {},
  });
}

export function portfolioRadarOutcomeInsertRow(
  input: PortfolioRadarOutcomeRequest,
  ownerId: string
): PortfolioRadarOutcomeInsertRow {
  const outcome = normalizePortfolioRadarOutcome(input);
  return {
    owner_id: ownerId,
    action_dedupe_key: outcome.actionDedupeKey,
    action_type: outcome.actionType,
    subject_type: outcome.subjectType,
    subject_id: outcome.subjectId,
    result_type: outcome.resultType,
    source_surface: outcome.sourceSurface ?? null,
    maturity_feedback: outcome.maturityFeedback ?? null,
    suppress_until: outcome.suppressUntil ?? null,
    notes: outcome.notes ?? null,
    raw_payload: outcome.rawPayload,
  };
}

export function summarizePortfolioRadarOutcomes(
  outcomes: PortfolioRadarActionOutcome[],
  options: { asOf?: string | Date; recentLimit?: number } = {}
): PortfolioRadarOutcomeSummary {
  const asOf = options.asOf instanceof Date ? options.asOf.toISOString() : options.asOf ?? new Date().toISOString();
  const active = activeOutcomes(outcomes, asOf);
  const closed = new Set(active.map((outcome) => outcome.actionDedupeKey));
  const recentLimit = Math.max(0, options.recentLimit ?? 5);
  return {
    totalOutcomes: active.length,
    closedActions: closed.size,
    openedBottles: active.filter((outcome) => outcome.resultType === "opened").length,
    dismissedActions: active.filter((outcome) => outcome.resultType === "dismissed").length,
    skippedActions: active.filter((outcome) => outcome.resultType === "skipped").length,
    maturityFeedbackCount: active.filter((outcome) => outcome.maturityFeedback != null).length,
    recentOutcomes: [...active].sort(compareOutcomes).slice(0, recentLimit).map((outcome) => ({
      id: outcome.id,
      actionDedupeKey: outcome.actionDedupeKey,
      resultType: outcome.resultType,
      subjectType: outcome.subjectType,
      subjectId: outcome.subjectId,
      createdAt: outcome.createdAt,
      maturityFeedback: outcome.maturityFeedback ?? null,
    })),
  };
}

export function applyPortfolioRadarOutcomes(
  radar: PortfolioRadar,
  outcomes: PortfolioRadarActionOutcome[],
  options: { asOf?: string | Date } = {}
): ApplyPortfolioRadarOutcomesResult {
  const asOf = options.asOf instanceof Date ? options.asOf.toISOString() : options.asOf ?? radar.asOf;
  const active = activeOutcomes(outcomes, asOf).sort(compareOutcomes);
  const hiddenActions: PortfolioRadarHiddenAction[] = [];
  const actions = radar.actions.filter((action) => {
    const outcome = active.find((candidate) => matchesAction(candidate, action));
    if (!outcome) return true;
    hiddenActions.push({ action, outcome });
    return false;
  });

  return {
    radar: {
      ...radar,
      actions,
      summary: summaryForActions(actions),
    },
    hiddenActions,
    outcomeSummary: summarizePortfolioRadarOutcomes(active, { asOf }),
  };
}
