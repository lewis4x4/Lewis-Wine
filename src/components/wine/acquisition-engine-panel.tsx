"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, Search, ShoppingCart, Target, TimerReset, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildAcquisitionEngine,
  type AcquisitionAction,
  type AcquisitionCommandItem,
  type AcquisitionPriceObservation,
  type AcquisitionTarget,
} from "@/lib/acquisition-engine";

const laneCopy = {
  buyNow: { title: "Buy Now", icon: ShoppingCart, description: "Targets with current evidence at or below Brian's buy ceiling." },
  watch: { title: "Watch", icon: TimerReset, description: "Good targets waiting on price, source, or availability." },
  ordered: { title: "Ordered", icon: CheckCircle2, description: "Purchased but not yet confirmed into the cellar." },
  acquired: { title: "Acquired", icon: Trophy, description: "Closed acquisition wins." },
  passed: { title: "Passed", icon: XCircle, description: "No longer worth chasing." },
} as const;

function formatSpend(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function TargetCard({ item, onAction, onRefresh, busy, refreshing }: { item: AcquisitionCommandItem; onAction: (id: string, action: AcquisitionAction) => void; onRefresh: (id: string) => void; busy: boolean; refreshing: boolean }) {
  return (
    <div className="rounded-3xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium leading-6">{item.wineTitle}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{[item.producer, item.region, item.varietal].filter(Boolean).join(" · ") || item.sourceKind.replace("_", " ")}</p>
        </div>
        <Badge variant={item.decision === "buy_now" ? "default" : "secondary"} className="rounded-full capitalize">{item.decision.replace("_", " ")}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Best price</div><div className="mt-1 text-xl font-semibold">{item.bestPriceLabel}</div></div>
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Target</div><div className="mt-1 text-xl font-semibold">{item.targetPriceLabel}</div></div>
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Qty / confidence</div><div className="mt-1 text-sm font-medium">{item.quantity} bottle{item.quantity === 1 ? "" : "s"}</div><div className="text-xs capitalize text-muted-foreground">{item.confidenceLabel}</div></div>
      </div>
      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        {item.reasons.slice(0, 3).map((reason) => <p key={reason}>• {reason}</p>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.bestObservation?.sourceUrl ? <Button variant="outline" size="sm" asChild><a href={item.bestObservation.sourceUrl} target="_blank" rel="noreferrer">Source</a></Button> : null}
        <Button variant="outline" size="sm" onClick={() => onRefresh(item.id)} disabled={busy || refreshing}>
          {refreshing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {refreshing ? "Searching" : "Find price evidence"}
        </Button>
        {item.decision !== "ordered" && item.decision !== "acquired" ? <Button size="sm" onClick={() => onAction(item.id, "mark_ordered")} disabled={busy || refreshing}>Mark ordered</Button> : null}
        {item.decision !== "acquired" ? <Button variant="secondary" size="sm" onClick={() => onAction(item.id, "mark_acquired")} disabled={busy || refreshing}>Acquired</Button> : null}
        {item.decision !== "passed" ? <Button variant="ghost" size="sm" onClick={() => onAction(item.id, "pass")} disabled={busy || refreshing}>Pass</Button> : <Button variant="secondary" size="sm" onClick={() => onAction(item.id, "reopen")} disabled={busy || refreshing}>Reopen</Button>}
      </div>
    </div>
  );
}

function Lane({ name, items, onAction, onRefresh, busyId, refreshingId }: { name: keyof ReturnType<typeof buildAcquisitionEngine>["lanes"]; items: AcquisitionCommandItem[]; onAction: (id: string, action: AcquisitionAction) => void; onRefresh: (id: string) => void; busyId: string | null; refreshingId: string | null }) {
  const copy = laneCopy[name];
  const Icon = copy.icon;
  return (
    <div className="rounded-[28px] border bg-muted/20 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-playfair text-2xl font-semibold"><Icon className="h-5 w-5 text-primary" /> {copy.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <Badge variant="outline" className="rounded-full">{items.length}</Badge>
      </div>
      <div className="space-y-3">
        {items.length ? items.map((item) => <TargetCard key={item.id} item={item} onAction={onAction} onRefresh={onRefresh} busy={busyId === item.id} refreshing={refreshingId === item.id} />) : <div className="rounded-3xl border border-dashed bg-background/70 p-6 text-sm text-muted-foreground">No targets in this lane.</div>}
      </div>
    </div>
  );
}

export function AcquisitionEnginePanel() {
  const [targets, setTargets] = useState<AcquisitionTarget[]>([]);
  const [priceObservations, setPriceObservations] = useState<AcquisitionPriceObservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const engine = useMemo(() => buildAcquisitionEngine({ targets, priceObservations }), [targets, priceObservations]);

  async function loadEngine() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/acquisition-engine", { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        setIsUnauthorized(true);
        setTargets([]);
        setPriceObservations([]);
        return;
      }
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load acquisition engine");
      setIsUnauthorized(false);
      setTargets(payload.targets ?? []);
      setPriceObservations(payload.priceObservations ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load acquisition engine");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadEngine(); }, []);

  async function refreshEngine() {
    setIsRefreshing(true);
    await loadEngine();
    setIsRefreshing(false);
  }

  async function updateTarget(id: string, action: AcquisitionAction) {
    setBusyId(id);
    try {
      const response = await fetch("/api/acquisition-engine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Could not update acquisition target");
      toast.success("Acquisition target updated.");
      await loadEngine();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update acquisition target");
    } finally {
      setBusyId(null);
    }
  }

  async function refreshTargetPrice(id: string) {
    setRefreshingId(id);
    try {
      const response = await fetch("/api/acquisition-engine?kind=refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id, force: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Could not refresh acquisition price evidence");
      const count = Array.isArray(payload.observations) ? payload.observations.length : 0;
      const gap = Array.isArray(payload.gaps) && payload.gaps.length ? ` ${payload.gaps[0]}` : "";
      toast.success(count ? `Saved ${count} acquisition price signal${count === 1 ? "" : "s"}.` : `Refresh complete.${gap}`);
      await loadEngine();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh acquisition price evidence");
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <Card id="acquisition-engine" className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><Target className="h-7 w-7 text-primary" /> Acquisition Engine</CardTitle>
            <CardDescription>Unified watchlist and price-refresh queue for bottles Brian actually wants to acquire.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">{engine.summary.buyNowCount} buy now</Badge>
            <Badge variant="outline" className="rounded-full">{engine.summary.refreshDueCount} refresh due</Badge>
            <Button variant="outline" size="sm" onClick={refreshEngine} disabled={isRefreshing || isLoading}><RefreshCw className="mr-2 h-4 w-4" /> {isRefreshing ? "Refreshing" : "Refresh"}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{engine.summary.totalTargets}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">targets</div></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{engine.summary.buyNowCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">buy now</div></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{engine.summary.refreshDueCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">refresh due</div></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{formatSpend(engine.summary.estimatedBuyNowSpendCents)}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">buy-now spend</div></div>
        </div>

        {isLoading ? <div className="rounded-3xl border bg-muted/20 p-8 text-center text-muted-foreground">Loading acquisition engine…</div> : null}
        {!isLoading && isUnauthorized ? <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center"><h3 className="font-semibold">Sign in to run the Acquisition Engine.</h3><p className="mt-1 text-sm text-muted-foreground">The engine is tied to Brian&apos;s private cellar, watchlist, and price evidence.</p></div> : null}
        {!isLoading && !isUnauthorized && targets.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
            <h3 className="font-semibold">No acquisition targets yet.</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add bottles from Buy Again, Wishlist, Shopping, or Restaurant Mode. The next slice wires those source buttons into this board.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2"><Button variant="secondary" size="sm" asChild><Link href="/wishlist">Open Wishlist</Link></Button><Button variant="outline" size="sm" asChild><Link href="/shopping">Open Shopping</Link></Button></div>
          </div>
        ) : null}
        {!isLoading && !isUnauthorized && targets.length ? (
          <>
            {engine.refreshQueue.length ? <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="font-medium text-amber-950 dark:text-amber-100">Price refresh queue</div><p className="mt-1 text-sm text-amber-950/80 dark:text-amber-100/80">{engine.refreshQueue.slice(0, 3).map((item) => `${item.wineTitle}: ${item.refreshReason}`).join(" · ")}</p></div> : null}
            <div className="grid gap-4 xl:grid-cols-2">
              <Lane name="buyNow" items={engine.lanes.buyNow} onAction={updateTarget} onRefresh={refreshTargetPrice} busyId={busyId} refreshingId={refreshingId} />
              <Lane name="watch" items={engine.lanes.watch} onAction={updateTarget} onRefresh={refreshTargetPrice} busyId={busyId} refreshingId={refreshingId} />
              <Lane name="ordered" items={engine.lanes.ordered} onAction={updateTarget} onRefresh={refreshTargetPrice} busyId={busyId} refreshingId={refreshingId} />
              <Lane name="acquired" items={engine.lanes.acquired} onAction={updateTarget} onRefresh={refreshTargetPrice} busyId={busyId} refreshingId={refreshingId} />
              <Lane name="passed" items={engine.lanes.passed} onAction={updateTarget} onRefresh={refreshTargetPrice} busyId={busyId} refreshingId={refreshingId} />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
