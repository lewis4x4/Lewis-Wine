export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { JarvisEmptyState } from "@/components/jarvis/jarvis-empty-state";
import { JarvisSurfaceStatus } from "@/components/jarvis/jarvis-surface-status";
import { TimelineFeed } from "@/components/jarvis/timeline-feed";
import { getJarvisTimelinePageData } from "@/lib/jarvis/queries";
import { getJarvisAccess } from "@/lib/jarvis/server";

export const metadata = {
  title: "Timeline | JARVIS",
};

export default async function JarvisTimelinePage() {
  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    redirect("/login?redirect=%2Fjarvis%2Ftimeline");
  }

  const data = await getJarvisTimelinePageData(access);

  return (
    <div className="space-y-8">
      <JarvisSurfaceStatus status={data.status} />

      <section className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Timeline memory
        </div>
        <div className="max-w-3xl space-y-3">
          <h2 className="font-playfair text-4xl font-semibold tracking-tight">
            A clean record of what changed and when.
          </h2>
          <p className="text-base leading-7 text-muted-foreground md:text-lg">
            Timeline is where executive context stops being anecdotal. New captures already write here; commitments, decisions, and briefs follow the same model.
          </p>
        </div>
      </section>

      {data.groups.length > 0 ? (
        <TimelineFeed groups={data.groups} />
      ) : (
        <JarvisEmptyState
          title="No timeline events are present"
          description="The timeline table is live for this phase, but it has not received data yet. The first capture submitted through JARVIS will appear here immediately."
          actionHref="/jarvis/capture"
          actionLabel="Create first timeline event"
        />
      )}
    </div>
  );
}
