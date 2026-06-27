"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock3, EyeOff, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortfolioRadar, PortfolioRadarAction, PortfolioRadarSeverity, PortfolioRadarSourceSurface } from "@/lib/portfolio-radar";

type SourceSummary = {
  cellar?: {
    uniqueWines: number;
    bottles: number;
    priceEvidence: number;
    refreshHistory?: {
      tableReady: boolean;
      records: number;
    };
  };
  refreshQueue?: {
    dueCount: number;
    highPriorityCount: number;
    deferredCount: number;
    estimatedCostUnits: number;
  };
  acquisition?: {
    totalTargets: number;
    buyNowCount: number;
    watchCount: number;
    refreshDueCount: number;
    estimatedBuyNowSpendCents: number;
  };
  replenishment?: {
    totalSignals: number;
    buyAgainNowCount: number;
    refillPromptCount: number;
    watchCount: number;
    suppressedCount: number;
  };
};

type RadarPayload = {
  success: boolean;
  radar?: PortfolioRadar;
  sourceSummary?: SourceSummary;
  error?: string;
};

type HiddenAction = {
  mode: "snoozed" | "dismissed";
  until: number | null;
};

const sourceCopy: Record<PortfolioRadarSourceSurface, string> = {
  cellar_command_center: "Cellar Command",
  portfolio_truth: "Portfolio Truth",
  replenishment_automation: "Replenishment",
  acquisition_engine: "Acquisition",
  acquisition_receipt: "Receipt Capture",
  tasting_memory: "Tasting Memory",
};

function severityVariant(severity: PortfolioRadarSeverity): "default" | "secondary" | "outline" | "destructive" {
  if (severity === "critical") return "destructive";
  if (severity === "high") return "default";
  if (severity === "medium") return "secondary";
  return "outline";
}

function formatCurrency(cents: number | null | undefined) {
  if (!cents) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function briefFrom(radar: PortfolioRadar | null, sourceSummary: SourceSummary | null, hiddenCount: number) {
  if (!radar) return "Portfolio Radar is waiting for cellar, acquisition, replenishment, and price-evidence signals.";
  if (radar.actions.length === 0) return "No active Portfolio Radar actions. Pourfolio has no urgent cellar, evidence, acquisition, or replenishment moves right now.";
  const valueActionCount = radar.summary.byType.refresh_valuation + radar.summary.byType.review_price_evidence + radar.summary.byType.sell_watch;
  const parts = [
    `${radar.summary.totalActions} prioritized action${radar.summary.totalActions === 1 ? "" : "s"}`,
    radar.summary.criticalCount ? `${radar.summary.criticalCount} critical` : null,
    radar.summary.byType.drink_now ? `${radar.summary.byType.drink_now} drink-now` : null,
    valueActionCount ? `${valueActionCount} value/evidence` : null,
    radar.summary.byType.acquisition_buy ? `${radar.summary.byType.acquisition_buy} buy-now` : null,
    radar.summary.byType.replenish ? `${radar.summary.byType.replenish} replenish` : null,
    sourceSummary?.refreshQueue?.dueCount ? `${sourceSummary.refreshQueue.dueCount} cellar refresh due` : null,
    hiddenCount ? `${hiddenCount} hidden locally` : null,
  ].filter(Boolean);
  const cellar = sourceSummary?.cellar;
  const sourcePart = cellar ? `Across ${cellar.bottles} bottle${cellar.bottles === 1 ? "" : "s"}, ${sourceSummary?.acquisition?.totalTargets ?? 0} acquisition target${sourceSummary?.acquisition?.totalTargets === 1 ? "" : "s"}, and ${sourceSummary?.replenishment?.totalSignals ?? 0} replenishment signal${sourceSummary?.replenishment?.totalSignals === 1 ? "" : "s"}.` : "";
  return `${parts.join(" · ")}. ${sourcePart}`.trim();
}

function ActionRow({ action, onSnooze, onDismiss }: { action: PortfolioRadarAction; onSnooze: (action: PortfolioRadarAction) => void; onDismiss: (action: PortfolioRadarAction) => void }) {
  return (
    <div className="rounded-3xl border bg-background p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={severityVariant(action.severity)} className="capitalize">{action.severity}</Badge>
            <Badge variant="outline" className="rounded-full">{sourceCopy[action.sourceSurface]}</Badge>
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{action.confidence}% confidence</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold leading-6"><span className="text-primary">{action.verb}</span> · {action.label}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Subject: {action.subjectType.replace("_", " ")}</span>
            <span>•</span>
            <span>Queue key: {action.dedupeKey}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          <Button size="sm" asChild>
            <Link href={action.cta.href}>{action.cta.label}<ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSnooze(action)}><Clock3 className="mr-2 h-4 w-4" /> Snooze</Button>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(action)}><EyeOff className="mr-2 h-4 w-4" /> Dismiss</Button>
        </div>
      </div>
    </div>
  );
}

export function PortfolioRadarPanel() {
  const [radar, setRadar] = useState<PortfolioRadar | null>(null);
  const [sourceSummary, setSourceSummary] = useState<SourceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [hidden, setHidden] = useState<Record<string, HiddenAction>>({});

  async function loadRadar() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/portfolio-radar", { cache: "no-store" });
      const payload = await response.json() as RadarPayload;
      if (response.status === 401) {
        setIsUnauthorized(true);
        setRadar(null);
        setSourceSummary(null);
        return;
      }
      if (!response.ok || !payload.success || !payload.radar) throw new Error(payload.error ?? "Failed to load Portfolio Radar");
      setIsUnauthorized(false);
      setRadar(payload.radar);
      setSourceSummary(payload.sourceSummary ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Portfolio Radar");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadRadar(); }, []);

  const visibleActions = useMemo(() => {
    const now = Date.now();
    return (radar?.actions ?? []).filter((action) => {
      const state = hidden[action.dedupeKey];
      if (!state) return true;
      if (state.mode === "snoozed" && state.until && state.until <= now) return true;
      return false;
    });
  }, [hidden, radar]);

  const hiddenCount = Math.max((radar?.actions.length ?? 0) - visibleActions.length, 0);
  const brief = briefFrom(radar, sourceSummary, hiddenCount);

  function snooze(action: PortfolioRadarAction) {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    setHidden((current) => ({ ...current, [action.dedupeKey]: { mode: "snoozed", until } }));
    toast.success(`Snoozed ${action.label} for 24 hours in this browser.`);
  }

  function dismiss(action: PortfolioRadarAction) {
    setHidden((current) => ({ ...current, [action.dedupeKey]: { mode: "dismissed", until: null } }));
    toast.success(`Dismissed ${action.label} locally.`);
  }

  return (
    <Card id="portfolio-radar" className="rounded-[32px] border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full"><Radar className="h-3 w-3" /> Pourfolio Today</Badge>
              <Badge variant="outline" className="rounded-full"><ShieldCheck className="h-3 w-3" /> Existing data only</Badge>
            </div>
            <CardTitle className="font-playfair text-3xl md:text-4xl">Portfolio Radar</CardTitle>
            <CardDescription className="max-w-4xl text-base leading-7">{brief}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={loadRadar} disabled={isLoading}><RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> {isLoading ? "Refreshing" : "Refresh"}</Button>
            <Button variant="secondary" size="sm" asChild><Link href="#acquisition-engine">Acquisition Engine</Link></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{radar?.summary.totalActions ?? 0}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">actions</div></div>
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{radar?.summary.criticalCount ?? 0}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">critical</div></div>
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{sourceSummary?.refreshQueue?.dueCount ?? radar?.refreshPlan.summary.dueCount ?? sourceSummary?.acquisition?.refreshDueCount ?? 0}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">cellar refresh due</div></div>
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{formatCurrency(sourceSummary?.acquisition?.estimatedBuyNowSpendCents)}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">buy-now spend</div></div>
        </div>

        {isLoading ? <div className="rounded-3xl border bg-muted/20 p-8 text-center text-muted-foreground">Loading Portfolio Radar…</div> : null}
        {!isLoading && isUnauthorized ? <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center"><h3 className="font-semibold">Sign in to see Pourfolio Today.</h3><p className="mt-1 text-sm text-muted-foreground">Portfolio Radar is built from Brian&apos;s private cellar, price evidence, acquisitions, and tasting memory.</p></div> : null}
        {!isLoading && !isUnauthorized && radar && radar.actions.length === 0 ? <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center"><h3 className="font-semibold">No active radar actions.</h3><p className="mt-1 text-sm text-muted-foreground">Add bottles, price evidence, acquisition targets, or tasting memories and this becomes the operating queue.</p></div> : null}
        {!isLoading && !isUnauthorized && radar && radar.actions.length > 0 && visibleActions.length === 0 ? <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center"><h3 className="font-semibold">All current actions are hidden locally.</h3><p className="mt-1 text-sm text-muted-foreground">Refresh or wait for snoozes to expire to bring them back.</p><Button className="mt-4" variant="outline" size="sm" onClick={() => setHidden({})}>Restore hidden actions</Button></div> : null}
        {!isLoading && !isUnauthorized && visibleActions.length > 0 ? <div className="space-y-3">{visibleActions.map((action) => <ActionRow key={action.id} action={action} onSnooze={snooze} onDismiss={dismiss} />)}</div> : null}
      </CardContent>
    </Card>
  );
}
