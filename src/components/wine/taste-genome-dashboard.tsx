"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Gauge, RefreshCw, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTasteGenomeDashboard, type TasteGenomeDashboard as TasteGenomeDashboardModel } from "@/lib/taste-genome-dashboard";

function EmptyChip({ children }: { children: string }) {
  return <span className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground">{children}</span>;
}

function SignalChips({ title, items, empty }: { title: string; items: Array<{ label: string; value?: string; support?: string }>; empty: string }) {
  return (
    <div className="rounded-2xl border bg-background/80 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? items.map((item) => (
          <Badge key={`${title}-${item.label}`} variant="secondary" className="rounded-full px-3 py-1">
            {item.label}{item.value ? ` · ${item.value}` : ""}
          </Badge>
        )) : <EmptyChip>{empty}</EmptyChip>}
      </div>
    </div>
  );
}

function LaneList({ title, items }: { title: string; items: TasteGenomeDashboardModel["lanes"]["regions"] }) {
  return (
    <div className="rounded-2xl border bg-background/80 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length ? items.map((item) => (
          <div key={`${title}-${item.name}`} className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 p-3">
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.support}</div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="rounded-full">{item.scoreLabel}</Badge>
              <div className="mt-1 text-[11px] capitalize text-muted-foreground">{item.confidence}</div>
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No durable lane yet.</p>}
      </div>
    </div>
  );
}

export function TasteGenomeDashboard() {
  const [dashboard, setDashboard] = useState<TasteGenomeDashboardModel>(() => buildTasteGenomeDashboard({}));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadDashboard() {
    try {
      const response = await fetch("/api/taste-genome", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load Taste Genome");
      setDashboard(payload.dashboard);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Taste Genome");
      setDashboard(buildTasteGenomeDashboard({}));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const confidenceWidth = useMemo(() => `${Math.max(0, Math.min(100, dashboard.confidence.score))}%`, [dashboard.confidence.score]);

  return (
    <Card id="taste-genome" className="rounded-[28px] border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><Brain className="h-7 w-7 text-primary" /> Taste Genome Dashboard</CardTitle>
            <CardDescription>The visible palate model: what Brian actually likes, what is still thin signal, and what should drive buying/list decisions.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full capitalize">{dashboard.confidence.label} confidence</Badge>
            <Button variant="outline" size="sm" onClick={() => { setIsRefreshing(true); void loadDashboard(); }} disabled={isRefreshing || isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-3xl border bg-background/85 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Genome read</div>
              <p className="mt-2 text-2xl font-semibold leading-8">{isLoading ? "Loading palate model…" : dashboard.headline}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{dashboard.profileSummary}</p>
            </div>
            <div className="min-w-56 rounded-2xl bg-muted/40 p-4">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Confidence</span><span className="font-semibold">{dashboard.confidence.score}%</span></div>
              <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: confidenceWidth }} /></div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{dashboard.confidence.explanation}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {dashboard.metrics.map((item) => (
            <div key={item.label} className="rounded-2xl border bg-background/80 p-4">
              <div className="text-2xl font-semibold">{item.value}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <LaneList title="Top producers" items={dashboard.lanes.producers} />
          <LaneList title="Top varietals" items={dashboard.lanes.varietals} />
          <LaneList title="Top regions" items={dashboard.lanes.regions} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SignalChips title="Loved descriptors" items={dashboard.lovedDescriptors} empty="Awaiting loved descriptors" />
          <SignalChips title="Avoid signals" items={dashboard.avoidSignals} empty="No avoid signal yet" />
          <SignalChips title="Structure fingerprint" items={dashboard.structureFingerprint} empty="Awaiting rating signals" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Gauge className="h-4 w-4" /> Price comfort band</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div><div className="font-semibold">{dashboard.priceBand.lowLabel}</div><div className="text-xs text-muted-foreground">low</div></div>
              <div><div className="font-semibold">{dashboard.priceBand.typicalLabel}</div><div className="text-xs text-muted-foreground">typical</div></div>
              <div><div className="font-semibold">{dashboard.priceBand.highLabel}</div><div className="text-xs text-muted-foreground">high</div></div>
            </div>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Target className="h-4 w-4" /> Benchmark set</div>
            <p className="mt-3 text-lg font-semibold">{dashboard.benchmarkSummary}</p>
            <p className="mt-1 text-sm text-muted-foreground">94+ captures become the anchors for future recommendations.</p>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Sparkles className="h-4 w-4" /> Next best moves</div>
            <div className="mt-3 space-y-2">
              {dashboard.nextActions.slice(0, 3).map((action) => <p key={action} className="text-sm leading-5 text-muted-foreground">• {action}</p>)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
