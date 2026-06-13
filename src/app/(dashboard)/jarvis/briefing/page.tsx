export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { BriefCard } from "@/components/jarvis/brief-card";
import { JarvisEmptyState } from "@/components/jarvis/jarvis-empty-state";
import { JarvisSurfaceStatus } from "@/components/jarvis/jarvis-surface-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJarvisDate } from "@/lib/jarvis/format";
import { getJarvisBriefingPageData } from "@/lib/jarvis/queries";
import { getJarvisAccess } from "@/lib/jarvis/server";

export const metadata = {
  title: "Briefing | JARVIS",
};

export default async function JarvisBriefingPage() {
  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    redirect("/login?redirect=%2Fjarvis%2Fbriefing");
  }

  const data = await getJarvisBriefingPageData(access);

  return (
    <div className="space-y-8">
      <JarvisSurfaceStatus status={data.status} />

      <section className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Daily brief
        </div>
        <div className="max-w-3xl space-y-3">
          <h2 className="font-playfair text-4xl font-semibold tracking-tight">
            One concise read before the day starts moving.
          </h2>
          <p className="text-base leading-7 text-muted-foreground md:text-lg">
            Briefing is where JARVIS should eventually compress memory, commitments, and decisions into the operator read for the morning. Phase 1 displays the latest stored brief and active decisions.
          </p>
        </div>
      </section>

      {data.latestBrief ? (
        <BriefCard brief={data.latestBrief} decisions={data.decisions} />
      ) : (
        <JarvisEmptyState
          title="No daily brief has been generated"
          description="The schema and read surface are ready. Once a brief is inserted, this page becomes the morning operating panel."
        />
      )}

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
            Briefing notes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
            Latest brief date:{" "}
            <span className="font-medium text-foreground">
              {data.latestBrief ? formatJarvisDate(data.latestBrief.briefDate) : "No brief yet"}
            </span>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
            Active decisions visible:{" "}
            <span className="font-medium text-foreground">{data.decisions.length}</span>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-5 text-sm leading-7 text-muted-foreground">
            Next phase should synthesize this brief automatically from recent captures, commitments, and decision deltas.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
