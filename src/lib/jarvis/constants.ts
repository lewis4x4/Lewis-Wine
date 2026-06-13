import type {
  JarvisArtifactType,
  JarvisBusinessLane,
  JarvisCaptureSourceType,
  JarvisCommitmentPriority,
  JarvisCommitmentStatus,
  JarvisCommitmentType,
  JarvisDecisionImpactLevel,
  JarvisDecisionStatus,
  JarvisTimelineEventType,
} from "@/types/database";

export const JARVIS_BUSINESS_LANES: Array<{
  value: JarvisBusinessLane;
  label: string;
  description: string;
  badgeClassName: string;
}> = [
  {
    value: "executive",
    label: "Executive",
    description: "CEO, board, and top-level operating context.",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    value: "product",
    label: "Product",
    description: "Roadmap, launches, customer signal, and product bets.",
    badgeClassName: "border-sky-200 bg-sky-100 text-sky-700",
  },
  {
    value: "commercial",
    label: "Commercial",
    description: "Revenue motion, partnerships, pipeline, and GTM execution.",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  {
    value: "finance",
    label: "Finance",
    description: "Capital, budgets, board asks, and financial discipline.",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
  },
  {
    value: "operations",
    label: "Operations",
    description: "Cross-functional execution, process, and delivery rhythm.",
    badgeClassName: "border-indigo-200 bg-indigo-100 text-indigo-700",
  },
  {
    value: "talent",
    label: "Talent",
    description: "Hiring, staffing, feedback, and org design.",
    badgeClassName: "border-rose-200 bg-rose-100 text-rose-700",
  },
  {
    value: "relationships",
    label: "Relationships",
    description: "Investors, partners, customers, and key stakeholder memory.",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-700",
  },
  {
    value: "personal",
    label: "Personal",
    description: "Founder health, personal commitments, and life operating context.",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
  },
];

export const JARVIS_CAPTURE_SOURCE_TYPES: Array<{
  value: JarvisCaptureSourceType;
  label: string;
  description: string;
}> = [
  {
    value: "manual",
    label: "Manual note",
    description: "A clean operator note written directly into JARVIS.",
  },
  {
    value: "note",
    label: "Imported note",
    description: "A note captured elsewhere and pasted in while context is fresh.",
  },
  {
    value: "transcript",
    label: "Transcript",
    description: "Meeting or call transcript that should stay queryable later.",
  },
  {
    value: "meeting",
    label: "Meeting recap",
    description: "Structured notes from a meeting that produced real commitments.",
  },
  {
    value: "email",
    label: "Email",
    description: "An email thread or summary worth retaining as operating memory.",
  },
  {
    value: "document",
    label: "Document",
    description: "A memo, board pack, or other reference artifact.",
  },
];

export const JARVIS_ARTIFACT_TYPES: JarvisArtifactType[] = [
  "primary_text",
  "summary",
  "attachment",
  "link",
  "brief",
];

export const JARVIS_TIMELINE_EVENT_TYPES: Array<{
  value: JarvisTimelineEventType;
  label: string;
}> = [
  { value: "capture", label: "Capture" },
  { value: "commitment", label: "Commitment" },
  { value: "decision", label: "Decision" },
  { value: "brief", label: "Daily brief" },
];

export const JARVIS_COMMITMENT_STATUSES: Array<{
  value: JarvisCommitmentStatus;
  label: string;
  badgeClassName: string;
}> = [
  {
    value: "open",
    label: "Open",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    value: "in_progress",
    label: "In progress",
    badgeClassName: "border-sky-200 bg-sky-100 text-sky-700",
  },
  {
    value: "blocked",
    label: "Blocked",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
  },
  {
    value: "delegated",
    label: "Delegated",
    badgeClassName: "border-violet-200 bg-violet-100 text-violet-700",
  },
  {
    value: "done",
    label: "Done",
    badgeClassName: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  {
    value: "dropped",
    label: "Dropped",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
  },
];

export const JARVIS_COMMITMENT_PRIORITIES: Array<{
  value: JarvisCommitmentPriority;
  label: string;
  badgeClassName: string;
}> = [
  {
    value: "critical",
    label: "Critical",
    badgeClassName: "border-red-200 bg-red-100 text-red-700",
  },
  {
    value: "high",
    label: "High",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
  },
  {
    value: "normal",
    label: "Normal",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    value: "low",
    label: "Low",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
  },
];

export const JARVIS_COMMITMENT_TYPES: Array<{
  value: JarvisCommitmentType;
  label: string;
}> = [
  { value: "follow_up", label: "Follow-up" },
  { value: "decision", label: "Decision" },
  { value: "deliverable", label: "Deliverable" },
  { value: "relationship", label: "Relationship" },
  { value: "finance", label: "Finance" },
  { value: "personal", label: "Personal" },
];

export const JARVIS_DECISION_STATUSES: Array<{
  value: JarvisDecisionStatus;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "superseded", label: "Superseded" },
  { value: "reversed", label: "Reversed" },
];

export const JARVIS_DECISION_IMPACT_LEVELS: Array<{
  value: JarvisDecisionImpactLevel;
  label: string;
}> = [
  { value: "low", label: "Low impact" },
  { value: "medium", label: "Medium impact" },
  { value: "high", label: "High impact" },
];

export const JARVIS_CAPTURE_PREVIEW_LIMIT = 220;

export function getJarvisLaneMeta(value: JarvisBusinessLane) {
  return JARVIS_BUSINESS_LANES.find((lane) => lane.value === value) ?? JARVIS_BUSINESS_LANES[0];
}

export function getJarvisSourceTypeMeta(value: JarvisCaptureSourceType) {
  return (
    JARVIS_CAPTURE_SOURCE_TYPES.find((sourceType) => sourceType.value === value) ??
    JARVIS_CAPTURE_SOURCE_TYPES[0]
  );
}

export function getJarvisCommitmentStatusMeta(value: JarvisCommitmentStatus) {
  return (
    JARVIS_COMMITMENT_STATUSES.find((status) => status.value === value) ??
    JARVIS_COMMITMENT_STATUSES[0]
  );
}

export function getJarvisCommitmentPriorityMeta(value: JarvisCommitmentPriority) {
  return (
    JARVIS_COMMITMENT_PRIORITIES.find((priority) => priority.value === value) ??
    JARVIS_COMMITMENT_PRIORITIES[0]
  );
}

export function getJarvisDecisionStatusMeta(value: JarvisDecisionStatus) {
  return (
    JARVIS_DECISION_STATUSES.find((status) => status.value === value) ??
    JARVIS_DECISION_STATUSES[0]
  );
}

export function getJarvisDecisionImpactMeta(value: JarvisDecisionImpactLevel) {
  return (
    JARVIS_DECISION_IMPACT_LEVELS.find((impact) => impact.value === value) ??
    JARVIS_DECISION_IMPACT_LEVELS[1]
  );
}
