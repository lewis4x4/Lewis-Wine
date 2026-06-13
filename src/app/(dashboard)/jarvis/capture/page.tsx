export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { CaptureForm } from "@/components/jarvis/capture-form";
import { CaptureList } from "@/components/jarvis/capture-list";
import { JarvisEmptyState } from "@/components/jarvis/jarvis-empty-state";
import { JarvisSurfaceStatus } from "@/components/jarvis/jarvis-surface-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJarvisAccess } from "@/lib/jarvis/server";
import { getJarvisCapturePageData } from "@/lib/jarvis/queries";

export const metadata = {
  title: "Capture | JARVIS",
};

export default async function JarvisCapturePage() {
  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    redirect("/login?redirect=%2Fjarvis%2Fcapture");
  }

  const data = await getJarvisCapturePageData(access);

  return (
    <div className="space-y-8">
      <JarvisSurfaceStatus status={data.status} />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CaptureForm />

        <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
          <CardHeader>
            <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
              Intake standard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <div className="rounded-3xl border border-border/70 bg-muted/30 p-5">
              Capture once, then let downstream surfaces read from the same source of truth.
            </div>
            <div className="rounded-3xl border border-border/70 bg-muted/30 p-5">
              Use business lanes aggressively. The lane is what keeps a note useful when it resurfaces later inside briefing and commitments.
            </div>
            <div className="rounded-3xl border border-border/70 bg-muted/30 p-5">
              Prefer raw source text over polished summary. JARVIS can derive views later, but it cannot recreate evidence that was never stored.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
            Recent capture history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentCaptures.length > 0 ? (
            <CaptureList captures={data.recentCaptures} />
          ) : (
            <JarvisEmptyState
              title="The capture inbox is empty"
              description="This route is ready for real writes. Submit the first capture to create a capture event, a primary artifact, and a matching timeline entry."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
