import { addDays, isAfter, isBefore, parseISO, subDays } from "date-fns";
import { getTimelineGroupLabel } from "@/lib/jarvis/format";
import {
  getJarvisDegradedStatus,
  isJarvisLiveAccess,
  type JarvisAccess,
} from "@/lib/jarvis/server";
import type {
  JarvisBriefView,
  JarvisCapturePageData,
  JarvisCaptureSummary,
  JarvisCommitmentsPageData,
  JarvisCommitmentView,
  JarvisDashboardData,
  JarvisDecisionView,
  JarvisMetric,
  JarvisSurfaceStatus,
  JarvisTimelineItem,
  JarvisTimelinePageData,
  JarvisBriefingPageData,
} from "@/lib/jarvis/types";
import type {
  CaptureEvent,
  Commitment,
  DailyBrief,
  Decision,
  TimelineEvent,
} from "@/types/database";

const commitmentPriorityOrder = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
} as const;

const commitmentStatusOrder = {
  open: 0,
  in_progress: 1,
  blocked: 2,
  delegated: 3,
  done: 4,
  dropped: 5,
} as const;

function isCommitmentOpen(status: Commitment["status"]) {
  return status !== "done" && status !== "dropped";
}

function hasDueDatePassed(dueAt: string | null, status: Commitment["status"]) {
  return Boolean(dueAt && isCommitmentOpen(status) && isBefore(parseISO(dueAt), new Date()));
}

function mapCapture(row: CaptureEvent): JarvisCaptureSummary {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    businessLane: row.business_lane,
    preview: row.content_preview,
    participants: row.participants ?? [],
    happenedAt: row.happened_at,
    capturedAt: row.created_at,
  };
}

function mapCommitment(row: Commitment): JarvisCommitmentView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    businessLane: row.business_lane,
    status: row.status,
    priority: row.priority,
    commitmentType: row.commitment_type,
    counterparty: row.counterparty,
    participants: row.participants ?? [],
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOverdue: hasDueDatePassed(row.due_at, row.status),
  };
}

function sortCommitments(rows: Commitment[]) {
  return [...rows].sort((left, right) => {
    const leftOverdue = hasDueDatePassed(left.due_at, left.status) ? 0 : 1;
    const rightOverdue = hasDueDatePassed(right.due_at, right.status) ? 0 : 1;

    if (leftOverdue !== rightOverdue) {
      return leftOverdue - rightOverdue;
    }

    const statusDiff =
      commitmentStatusOrder[left.status] - commitmentStatusOrder[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const priorityDiff =
      commitmentPriorityOrder[left.priority] - commitmentPriorityOrder[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (left.due_at && right.due_at) {
      return parseISO(left.due_at).getTime() - parseISO(right.due_at).getTime();
    }

    if (left.due_at) {
      return -1;
    }

    if (right.due_at) {
      return 1;
    }

    return parseISO(right.updated_at).getTime() - parseISO(left.updated_at).getTime();
  });
}

function mapDecision(row: Decision): JarvisDecisionView {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    rationale: row.rationale,
    businessLane: row.business_lane,
    status: row.status,
    impactLevel: row.impact_level,
    decidedAt: row.decided_at,
  };
}

function mapBrief(row: DailyBrief): JarvisBriefView {
  return {
    id: row.id,
    briefDate: row.brief_date,
    title: row.title,
    summary: row.summary,
    priorities: row.priorities ?? [],
    blockers: row.blockers ?? [],
    watchItems: row.watch_items ?? [],
    createdAt: row.created_at,
  };
}

function mapTimelineItem(row: TimelineEvent): JarvisTimelineItem {
  return {
    id: row.id,
    eventType: row.event_type,
    businessLane: row.business_lane,
    headline: row.headline,
    summary: row.summary,
    happenedAt: row.happened_at,
    sourceTable: row.source_table,
    sourceId: row.source_id,
  };
}

function groupTimeline(rows: TimelineEvent[]) {
  const groups = new Map<string, JarvisTimelineItem[]>();

  rows.forEach((row) => {
    const label = getTimelineGroupLabel(row.happened_at);
    const existing = groups.get(label) ?? [];
    existing.push(mapTimelineItem(row));
    groups.set(label, existing);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

function getEmptyDashboard(status: JarvisSurfaceStatus): JarvisDashboardData {
  return {
    status,
    metrics: [
      { label: "Open commitments", value: "0", detail: "Nothing live yet." },
      { label: "Due soon", value: "0", detail: "No deadlines inside seven days." },
      { label: "Active decisions", value: "0", detail: "No active decisions logged." },
      { label: "Captures this week", value: "0", detail: "No recent intake yet." },
    ],
    latestBrief: null,
    commitments: [],
    recentTimeline: [],
    recentCaptures: [],
    decisions: [],
  };
}

function getEmptyCommitments(status: JarvisSurfaceStatus): JarvisCommitmentsPageData {
  return {
    status,
    metrics: [
      { label: "Open", value: "0", detail: "No live commitments." },
      { label: "In progress", value: "0", detail: "No active execution items." },
      { label: "Blocked", value: "0", detail: "No stalled work." },
      { label: "Done", value: "0", detail: "Nothing has been closed yet." },
    ],
    commitments: [],
  };
}

function getEmptyTimeline(status: JarvisSurfaceStatus): JarvisTimelinePageData {
  return {
    status,
    groups: [],
  };
}

function getEmptyCapture(status: JarvisSurfaceStatus): JarvisCapturePageData {
  return {
    status,
    recentCaptures: [],
  };
}

function getEmptyBriefing(status: JarvisSurfaceStatus): JarvisBriefingPageData {
  return {
    status,
    latestBrief: null,
    decisions: [],
  };
}

function buildDashboardMetrics(
  commitments: Commitment[],
  decisions: Decision[],
  captures: CaptureEvent[],
): JarvisMetric[] {
  const now = new Date();
  const upcomingDeadline = addDays(now, 7);
  const capturesSince = subDays(now, 7);

  const openCommitments = commitments.filter((item) => isCommitmentOpen(item.status)).length;
  const dueSoon = commitments.filter(
    (item) =>
      item.due_at &&
      isCommitmentOpen(item.status) &&
      isAfter(parseISO(item.due_at), now) &&
      isBefore(parseISO(item.due_at), upcomingDeadline),
  ).length;
  const activeDecisions = decisions.filter((item) => item.status === "active").length;
  const capturesThisWeek = captures.filter((item) =>
    isAfter(parseISO(item.created_at), capturesSince),
  ).length;

  return [
    {
      label: "Open commitments",
      value: openCommitments.toString(),
      detail: "Promises, follow-ups, and deliverables still in motion.",
    },
    {
      label: "Due soon",
      value: dueSoon.toString(),
      detail: "Items that need attention inside the next seven days.",
    },
    {
      label: "Active decisions",
      value: activeDecisions.toString(),
      detail: "Decisions still shaping execution and context.",
    },
    {
      label: "Captures this week",
      value: capturesThisWeek.toString(),
      detail: "New memory entering the system over the last seven days.",
    },
  ];
}

function buildCommitmentMetrics(commitments: Commitment[]): JarvisMetric[] {
  const open = commitments.filter((item) => item.status === "open").length;
  const inProgress = commitments.filter((item) => item.status === "in_progress").length;
  const blocked = commitments.filter((item) => item.status === "blocked").length;
  const done = commitments.filter((item) => item.status === "done").length;

  return [
    {
      label: "Open",
      value: open.toString(),
      detail: "Clear commitments waiting for action.",
    },
    {
      label: "In progress",
      value: inProgress.toString(),
      detail: "Items already moving inside the operating cadence.",
    },
    {
      label: "Blocked",
      value: blocked.toString(),
      detail: "Items that need attention or a dependency cleared.",
    },
    {
      label: "Done",
      value: done.toString(),
      detail: "Completed commitments retained as memory, not lost in chat.",
    },
  ];
}

function getUnavailableStatus(error: unknown) {
  console.error("JARVIS query failed", error);
  return getJarvisDegradedStatus(
    "The JARVIS tables are not available yet. Apply the Supabase migration to unlock live data on these surfaces.",
  );
}

export async function getJarvisDashboardData(access: JarvisAccess): Promise<JarvisDashboardData> {
  if (!isJarvisLiveAccess(access)) {
    return getEmptyDashboard(access.status);
  }

  try {
    const [capturesResult, commitmentsResult, decisionsResult, briefResult, timelineResult] =
      await Promise.all([
        access.supabase
          .from("capture_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(12),
        access.supabase
          .from("commitments")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(50),
        access.supabase
          .from("decisions")
          .select("*")
          .order("decided_at", { ascending: false })
          .limit(20),
        access.supabase
          .from("daily_briefs")
          .select("*")
          .order("brief_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        access.supabase
          .from("timeline_events")
          .select("*")
          .order("happened_at", { ascending: false })
          .limit(20),
      ]);

    const firstError =
      capturesResult.error ??
      commitmentsResult.error ??
      decisionsResult.error ??
      briefResult.error ??
      timelineResult.error;

    if (firstError) {
      return getEmptyDashboard(getUnavailableStatus(firstError));
    }

    const captures = (capturesResult.data ?? []) as CaptureEvent[];
    const commitments = sortCommitments((commitmentsResult.data ?? []) as Commitment[]);
    const decisions = (decisionsResult.data ?? []) as Decision[];
    const timeline = (timelineResult.data ?? []) as TimelineEvent[];

    return {
      status: access.status,
      metrics: buildDashboardMetrics(commitments, decisions, captures),
      latestBrief: briefResult.data ? mapBrief(briefResult.data) : null,
      commitments: commitments.slice(0, 5).map(mapCommitment),
      recentTimeline: groupTimeline(timeline),
      recentCaptures: captures.slice(0, 5).map(mapCapture),
      decisions: decisions
        .filter((item) => item.status === "active")
        .slice(0, 4)
        .map(mapDecision),
    };
  } catch (error) {
    return getEmptyDashboard(getUnavailableStatus(error));
  }
}

export async function getJarvisCommitmentsPageData(
  access: JarvisAccess,
): Promise<JarvisCommitmentsPageData> {
  if (!isJarvisLiveAccess(access)) {
    return getEmptyCommitments(access.status);
  }

  try {
    const { data, error } = await access.supabase
      .from("commitments")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      return getEmptyCommitments(getUnavailableStatus(error));
    }

    const commitments = sortCommitments((data ?? []) as Commitment[]);

    return {
      status: access.status,
      metrics: buildCommitmentMetrics(commitments),
      commitments: commitments.map(mapCommitment),
    };
  } catch (error) {
    return getEmptyCommitments(getUnavailableStatus(error));
  }
}

export async function getJarvisTimelinePageData(
  access: JarvisAccess,
): Promise<JarvisTimelinePageData> {
  if (!isJarvisLiveAccess(access)) {
    return getEmptyTimeline(access.status);
  }

  try {
    const { data, error } = await access.supabase
      .from("timeline_events")
      .select("*")
      .order("happened_at", { ascending: false })
      .limit(40);

    if (error) {
      return getEmptyTimeline(getUnavailableStatus(error));
    }

    return {
      status: access.status,
      groups: groupTimeline(data ?? []),
    };
  } catch (error) {
    return getEmptyTimeline(getUnavailableStatus(error));
  }
}

export async function getJarvisCapturePageData(
  access: JarvisAccess,
): Promise<JarvisCapturePageData> {
  if (!isJarvisLiveAccess(access)) {
    return getEmptyCapture(access.status);
  }

  try {
    const { data, error } = await access.supabase
      .from("capture_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return getEmptyCapture(getUnavailableStatus(error));
    }

    return {
      status: access.status,
      recentCaptures: (data ?? []).map(mapCapture),
    };
  } catch (error) {
    return getEmptyCapture(getUnavailableStatus(error));
  }
}

export async function getJarvisBriefingPageData(
  access: JarvisAccess,
): Promise<JarvisBriefingPageData> {
  if (!isJarvisLiveAccess(access)) {
    return getEmptyBriefing(access.status);
  }

  try {
    const [briefResult, decisionsResult] = await Promise.all([
      access.supabase
        .from("daily_briefs")
        .select("*")
        .order("brief_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      access.supabase
        .from("decisions")
        .select("*")
        .order("decided_at", { ascending: false })
        .limit(6),
    ]);

    const firstError = briefResult.error ?? decisionsResult.error;
    if (firstError) {
      return getEmptyBriefing(getUnavailableStatus(firstError));
    }

    return {
      status: access.status,
      latestBrief: briefResult.data ? mapBrief(briefResult.data) : null,
      decisions: (decisionsResult.data ?? []).slice(0, 4).map(mapDecision),
    };
  } catch (error) {
    return getEmptyBriefing(getUnavailableStatus(error));
  }
}
