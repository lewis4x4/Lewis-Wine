export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, FileText, ListTodo, Newspaper, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { BriefCard } from "@/components/jarvis/brief-card";
import { CaptureList } from "@/components/jarvis/capture-list";
import { CommitmentList } from "@/components/jarvis/commitment-list";
import { JarvisEmptyState } from "@/components/jarvis/jarvis-empty-state";
import { JarvisMetricCard } from "@/components/jarvis/jarvis-metric-card";
import { JarvisSurfaceStatus } from "@/components/jarvis/jarvis-surface-status";
import { TimelineFeed } from "@/components/jarvis/timeline-feed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJarvisAccess } from "@/lib/jarvis/server";
import { getJarvisDashboardData } from "@/lib/jarvis/queries";

export const metadata = {
  title: "JARVIS Memory OS",
};

export default async function JarvisOverviewPage() {
  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    redirect("/login?redirect=%2Fjarvis");
  }

  const data = await getJarvisDashboardData(access);

  return (
    <div className="space-y-8">
      <JarvisSurfaceStatus status={data.status} />

      <section className="rounded-[32px] border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 px-7 py-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Executive command surface
            </div>
            <h2 className="font-playfair text-4xl font-semibold tracking-tight md:text-5xl">
              High-signal memory for the week in motion.
            </h2>
            <p className="text-base leading-7 text-muted-foreground md:text-lg">
              The first vertical slice ties together what was captured, what is owed, what changed, and what should shape the next day.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-full px-5">
              <Link href="/jarvis/capture">
                New capture
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/jarvis/briefing">Open briefing</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <JarvisMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      {data.latestBrief ? (
        <BriefCard brief={data.latestBrief} decisions={data.decisions} />
      ) : (
        <JarvisEmptyState
          title="No daily brief has been published yet"
          description="The briefing surface is wired and ready. As soon as the first brief lands, JARVIS will elevate priorities, blockers, and the active decision stack here."
          actionHref="/jarvis/capture"
          actionLabel="Start with a capture"
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <ListTodo className="h-4 w-4" />
                Commitments
              </div>
              <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
                What still needs to happen
              </CardTitle>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/jarvis/commitments">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.commitments.length > 0 ? (
              <CommitmentList commitments={data.commitments} compact />
            ) : (
              <JarvisEmptyState
                title="No commitments are being tracked"
                description="The system has no active follow-ups or deliverables yet. Once commitments are seeded or written from future workflows, they will surface here."
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                Timeline
              </div>
              <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
                The operating sequence
              </CardTitle>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/jarvis/timeline">Open timeline</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentTimeline.length > 0 ? (
              <TimelineFeed groups={data.recentTimeline} />
            ) : (
              <JarvisEmptyState
                title="No timeline events yet"
                description="Timeline events appear when captures, commitments, decisions, or briefs are logged. The first capture will establish the initial operating trail."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <FileText className="h-4 w-4" />
              Recent captures
            </div>
            <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
              Evidence entering memory
            </CardTitle>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/jarvis/capture">Capture inbox</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.recentCaptures.length > 0 ? (
            <CaptureList captures={data.recentCaptures} compact />
          ) : (
            <JarvisEmptyState
              title="No captures have been stored yet"
              description="Notes, transcripts, and recaps are ready to flow into this system. The first capture creates the first artifact and the first timeline entry."
              actionHref="/jarvis/capture"
              actionLabel="Create first capture"
            />
          )}
        </CardContent>
      </Card>

      {!data.latestBrief && data.decisions.length > 0 ? (
        <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Newspaper className="h-4 w-4" />
              Decision stack
            </div>
            <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
              Active decisions still shaping execution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.decisions.map((decision) => (
              <div
                key={decision.id}
                className="rounded-3xl border border-border/70 bg-muted/30 p-5"
              >
                <div className="font-medium text-foreground">{decision.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{decision.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
