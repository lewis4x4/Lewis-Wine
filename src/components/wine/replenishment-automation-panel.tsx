"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, RefreshCw, Repeat2, ShoppingCart, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildReplenishmentAutomation, type ReplenishmentAutomation, type ReplenishmentPrompt } from "@/lib/replenishment-automation";

function formatCents(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function emptyAutomation(): ReplenishmentAutomation {
  return buildReplenishmentAutomation({ inventory: [] });
}

function PromptCard({ prompt, onCreate, busy }: { prompt: ReplenishmentPrompt; onCreate: (prompt: ReplenishmentPrompt) => void; busy: boolean }) {
  return (
    <div className="rounded-3xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium leading-6">{prompt.wineTitle}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{[prompt.producer, prompt.region, prompt.varietal].filter(Boolean).join(" · ") || "Replenishment candidate"}</p>
        </div>
        <Badge variant={prompt.urgency === "now" ? "default" : "secondary"} className="rounded-full capitalize">{prompt.urgency}</Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">On hand</div><div className="mt-1 text-xl font-semibold">{prompt.quantityOnHand}</div></div>
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Last price</div><div className="mt-1 text-xl font-semibold">{formatCents(prompt.targetPriceCents)}</div></div>
        <div className="rounded-2xl bg-muted/40 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Target qty</div><div className="mt-1 text-xl font-semibold">{prompt.desiredQuantity}</div></div>
      </div>
      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        {prompt.reasons.slice(0, 3).map((reason) => <p key={reason}>• {reason}</p>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {prompt.suppressedReason ? (
          <Badge variant="outline" className="rounded-full">Already on Acquisition Engine</Badge>
        ) : (
          <Button size="sm" onClick={() => onCreate(prompt)} disabled={busy}><ShoppingCart className="mr-2 h-4 w-4" /> Buy this again now</Button>
        )}
        <Button variant="outline" size="sm" asChild><Link href="/intelligence#acquisition-engine">Acquisition Engine</Link></Button>
      </div>
    </div>
  );
}

function Lane({ title, description, icon: Icon, prompts, onCreate, busyId }: { title: string; description: string; icon: typeof Repeat2; prompts: ReplenishmentPrompt[]; onCreate: (prompt: ReplenishmentPrompt) => void; busyId: string | null }) {
  return (
    <div className="rounded-[28px] border bg-muted/20 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-playfair text-2xl font-semibold"><Icon className="h-5 w-5 text-primary" /> {title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="rounded-full">{prompts.length}</Badge>
      </div>
      <div className="space-y-3">
        {prompts.length ? prompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} onCreate={onCreate} busy={busyId === prompt.id} />) : <div className="rounded-3xl border border-dashed bg-background/70 p-6 text-sm text-muted-foreground">No prompts in this lane.</div>}
      </div>
    </div>
  );
}

export function ReplenishmentAutomationPanel() {
  const [automation, setAutomation] = useState<ReplenishmentAutomation>(() => emptyAutomation());
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const visiblePrompts = useMemo(() => automation.summary.buyAgainNowCount + automation.summary.refillPromptCount + automation.summary.watchCount, [automation]);

  async function loadAutomation() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/replenishment", { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        setIsUnauthorized(true);
        setAutomation(emptyAutomation());
        return;
      }
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load replenishment automation");
      setIsUnauthorized(false);
      setAutomation(payload.automation ?? emptyAutomation());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load replenishment automation");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void loadAutomation(); }, []);

  async function createTarget(prompt: ReplenishmentPrompt) {
    setBusyId(prompt.id);
    try {
      const response = await fetch("/api/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Could not create replenishment target");
      toast.success("Replenishment target added to Acquisition Engine.");
      await loadAutomation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create replenishment target");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card id="replenishment" className="rounded-[28px] border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><Repeat2 className="h-7 w-7 text-primary" /> Replenishment Automation</CardTitle>
            <CardDescription>Turns consumed, liked, low-stock, and acquired bottles into proactive refill prompts and one-click “buy this again now” actions.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">{automation.summary.buyAgainNowCount} buy now</Badge>
            <Badge variant="outline" className="rounded-full">{automation.summary.refillPromptCount} refill prompts</Badge>
            <Button variant="outline" size="sm" onClick={loadAutomation} disabled={isLoading}><RefreshCw className="mr-2 h-4 w-4" /> {isLoading ? "Refreshing" : "Refresh"}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{automation.summary.totalSignals}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">signals</div></div>
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{automation.summary.buyAgainNowCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">buy-again now</div></div>
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{automation.summary.refillPromptCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">refill prompts</div></div>
          <div className="rounded-2xl border bg-background/70 p-4"><div className="text-2xl font-semibold">{automation.summary.suppressedCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">already covered</div></div>
        </div>
        {isLoading ? <div className="rounded-3xl border bg-muted/20 p-8 text-center text-muted-foreground">Loading replenishment prompts…</div> : null}
        {!isLoading && isUnauthorized ? <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center"><h3 className="font-semibold">Sign in to run Replenishment Automation.</h3><p className="mt-1 text-sm text-muted-foreground">Prompts are built from Brian&apos;s private cellar, ratings, and acquisition history.</p></div> : null}
        {!isLoading && !isUnauthorized && visiblePrompts === 0 ? <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center"><h3 className="font-semibold">No replenishment prompts yet.</h3><p className="mt-1 text-sm text-muted-foreground">Consumed favorites, low-stock alerts, and receipt closeouts will appear here automatically.</p></div> : null}
        {!isLoading && !isUnauthorized && visiblePrompts > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Lane title="Buy Again Now" description="Liked or consumed bottles that deserve a live acquisition target." icon={ShoppingCart} prompts={automation.lanes.buyAgainNow} onCreate={createTarget} busyId={busyId} />
            <Lane title="Refill Prompts" description="Low-stock bottles that should not quietly run out." icon={BellRing} prompts={automation.lanes.refillPrompts} onCreate={createTarget} busyId={busyId} />
            <Lane title="Watch Later" description="Recent acquisitions or good signals to keep warm without urgent buying pressure." icon={TimerReset} prompts={automation.lanes.watch} onCreate={createTarget} busyId={busyId} />
            <Lane title="Already Covered" description="Signals suppressed because Acquisition Engine already has the bottle." icon={Repeat2} prompts={automation.lanes.suppressed} onCreate={createTarget} busyId={busyId} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
