import { summarizeCaptureContent } from "@/lib/jarvis/format";
import type { JarvisLiveAccess } from "@/lib/jarvis/server";
import type { JarvisCaptureInput, JarvisCaptureResult } from "@/lib/jarvis/types";
import type { ArtifactInsert, CaptureEventInsert, TimelineEventInsert } from "@/types/database";

type InsertSingleResult = Promise<{ data: { id: string } | null; error: unknown }>;
type ErrorResult = Promise<{ error: unknown }>;

type InsertTable<TInsert> = {
  insert: (values: TInsert) => {
    select: (columns: string) => {
      single: () => InsertSingleResult;
    };
  };
};

type CaptureTable = InsertTable<CaptureEventInsert> & {
  delete: () => {
    eq: (column: "id", value: string) => ErrorResult;
  };
};

type TimelineTable = {
  insert: (values: TimelineEventInsert) => ErrorResult;
};

type JarvisMutationClient = {
  from: {
    (table: "capture_events"): CaptureTable;
    (table: "artifacts"): InsertTable<ArtifactInsert>;
    (table: "timeline_events"): TimelineTable;
  };
};

export async function createJarvisCapture(
  access: JarvisLiveAccess,
  input: JarvisCaptureInput,
): Promise<JarvisCaptureResult> {
  const normalizedTitle = input.title.trim();
  const normalizedContent = input.content.trim();
  const normalizedParticipants = input.participants.map((participant) => participant.trim());
  const contentPreview = summarizeCaptureContent(normalizedContent);
  const jarvisDb = access.supabase as unknown as JarvisMutationClient;

  const captureInsert: CaptureEventInsert = {
    owner_id: access.userId,
    source_type: input.sourceType,
    business_lane: input.businessLane,
    title: normalizedTitle,
    content_preview: contentPreview,
    participants: normalizedParticipants,
    happened_at: input.happenedAt,
    metadata: {
      participant_count: normalizedParticipants.length,
      captured_via: "jarvis_capture_form",
    },
  };

  const { data: capture, error: captureError } = await jarvisDb
    .from("capture_events")
    .insert(captureInsert)
    .select("id")
    .single();

  if (captureError || !capture) {
    console.error("JARVIS capture insert failed", captureError);
    return {
      success: false,
      mode: "degraded",
      message:
        "JARVIS could not save this capture. Confirm the migration has run and Supabase is reachable.",
      echo: input,
    };
  }

  const artifactInsert: ArtifactInsert = {
    owner_id: access.userId,
    capture_event_id: capture.id,
    artifact_type: "primary_text",
    title: normalizedTitle,
    mime_type: "text/markdown",
    content_text: normalizedContent,
    is_primary: true,
    metadata: {
      source_type: input.sourceType,
    },
  };

  const { data: artifact, error: artifactError } = await jarvisDb
    .from("artifacts")
    .insert(artifactInsert)
    .select("id")
    .single();

  if (artifactError || !artifact) {
    console.error("JARVIS artifact insert failed", artifactError);
    await jarvisDb.from("capture_events").delete().eq("id", capture.id);

    return {
      success: false,
      mode: "degraded",
      message:
        "The capture record was created, but the primary artifact failed. JARVIS rolled the write back to keep the record clean.",
      echo: input,
    };
  }

  const timelineSummary =
    normalizedParticipants.length > 0
      ? `Participants: ${normalizedParticipants.join(", ")}`
      : contentPreview;

  const timelineInsert: TimelineEventInsert = {
    owner_id: access.userId,
    event_type: "capture",
    business_lane: input.businessLane,
    headline: normalizedTitle,
    summary: timelineSummary,
    happened_at: input.happenedAt ?? new Date().toISOString(),
    source_table: "capture_events",
    source_id: capture.id,
    metadata: {
      source_type: input.sourceType,
    },
  };

  const { error: timelineError } = await jarvisDb.from("timeline_events").insert(timelineInsert);

  if (timelineError) {
    console.error("JARVIS timeline insert failed", timelineError);
  }

  return {
    success: true,
    mode: "live",
    message: "Capture saved to JARVIS Memory OS.",
    captureId: capture.id,
    artifactId: artifact.id,
    echo: input,
  };
}
