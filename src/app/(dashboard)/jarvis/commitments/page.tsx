export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { CommitmentList } from "@/components/jarvis/commitment-list";
import { JarvisEmptyState } from "@/components/jarvis/jarvis-empty-state";
import { JarvisMetricCard } from "@/components/jarvis/jarvis-metric-card";
import { JarvisSurfaceStatus } from "@/components/jarvis/jarvis-surface-status";
import { getJarvisCommitmentsPageData } from "@/lib/jarvis/queries";
import { getJarvisAccess } from "@/lib/jarvis/server";

export const metadata = {
  title: "Commitments | JARVIS",
};

export default async function JarvisCommitmentsPage() {
  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    redirect("/login?redirect=%2Fjarvis%2Fcommitments");
  }

  const data = await getJarvisCommitmentsPageData(access);

  return (
    <div className="space-y-8">
      <JarvisSurfaceStatus status={data.status} />

      <section className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Commitments ledger
        </div>
        <div className="max-w-3xl space-y-3">
          <h2 className="font-playfair text-4xl font-semibold tracking-tight">
            Promises, follow-ups, and deliverables stay visible.
          </h2>
          <p className="text-base leading-7 text-muted-foreground md:text-lg">
            This page is the operating answer to “what did I say would happen, and what still depends on me?”
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <JarvisMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      {data.commitments.length > 0 ? (
        <CommitmentList commitments={data.commitments} />
      ) : (
        <JarvisEmptyState
          title="No commitments have been recorded"
          description="Phase 1 reads commitment data, but does not create commitments yet. Seed demo data or extend the write path in a later phase to populate this ledger."
        />
      )}
    </div>
  );
}
