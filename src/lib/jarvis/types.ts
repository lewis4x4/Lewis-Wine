import type {
  Artifact,
  CaptureEvent,
  Commitment,
  DailyBrief,
  Decision,
  JarvisBusinessLane,
  JarvisCaptureSourceType,
  JarvisCommitmentPriority,
  JarvisCommitmentStatus,
  JarvisDecisionImpactLevel,
  JarvisDecisionStatus,
  JarvisTimelineEventType,
  TimelineEvent,
} from "@/types/database";

export type JarvisDataMode = "live" | "demo" | "degraded";

export interface JarvisSurfaceStatus {
  mode: JarvisDataMode;
  title: string;
  detail: string;
}

export interface JarvisMetric {
  label: string;
  value: string;
  detail: string;
}

export interface JarvisCaptureSummary {
  id: string;
  title: string;
  sourceType: JarvisCaptureSourceType;
  businessLane: JarvisBusinessLane;
  preview: string | null;
  participants: string[];
  happenedAt: string | null;
  capturedAt: string;
}

export interface JarvisCommitmentView {
  id: string;
  title: string;
  description: string | null;
  businessLane: JarvisBusinessLane;
  status: JarvisCommitmentStatus;
  priority: JarvisCommitmentPriority;
  commitmentType: Commitment["commitment_type"];
  counterparty: string | null;
  participants: string[];
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

export interface JarvisDecisionView {
  id: string;
  title: string;
  summary: string;
  rationale: string | null;
  businessLane: JarvisBusinessLane;
  status: JarvisDecisionStatus;
  impactLevel: JarvisDecisionImpactLevel;
  decidedAt: string;
}

export interface JarvisTimelineItem {
  id: string;
  eventType: JarvisTimelineEventType;
  businessLane: JarvisBusinessLane;
  headline: string;
  summary: string | null;
  happenedAt: string;
  sourceTable: TimelineEvent["source_table"];
  sourceId: string | null;
}

export interface JarvisTimelineGroup {
  label: string;
  items: JarvisTimelineItem[];
}

export interface JarvisBriefView {
  id: string;
  briefDate: string;
  title: string;
  summary: string;
  priorities: string[];
  blockers: string[];
  watchItems: string[];
  createdAt: string;
}

export interface JarvisDashboardData {
  status: JarvisSurfaceStatus;
  metrics: JarvisMetric[];
  latestBrief: JarvisBriefView | null;
  commitments: JarvisCommitmentView[];
  recentTimeline: JarvisTimelineGroup[];
  recentCaptures: JarvisCaptureSummary[];
  decisions: JarvisDecisionView[];
}

export interface JarvisCommitmentsPageData {
  status: JarvisSurfaceStatus;
  metrics: JarvisMetric[];
  commitments: JarvisCommitmentView[];
}

export interface JarvisTimelinePageData {
  status: JarvisSurfaceStatus;
  groups: JarvisTimelineGroup[];
}

export interface JarvisCapturePageData {
  status: JarvisSurfaceStatus;
  recentCaptures: JarvisCaptureSummary[];
}

export interface JarvisBriefingPageData {
  status: JarvisSurfaceStatus;
  latestBrief: JarvisBriefView | null;
  decisions: JarvisDecisionView[];
}

export interface JarvisCaptureInput {
  sourceType: JarvisCaptureSourceType;
  businessLane: JarvisBusinessLane;
  title: string;
  content: string;
  participants: string[];
  happenedAt: string | null;
}

export interface JarvisCaptureResult {
  success: boolean;
  mode: JarvisDataMode;
  message: string;
  captureId?: string;
  artifactId?: string;
  echo: JarvisCaptureInput;
}

export type JarvisCaptureEventRow = CaptureEvent;
export type JarvisArtifactRow = Artifact;
export type JarvisCommitmentRow = Commitment;
export type JarvisDecisionRow = Decision;
export type JarvisDailyBriefRow = DailyBrief;
