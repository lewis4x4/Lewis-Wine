"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, ShoppingBag, TimerReset, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildBuyAgainCommandCenter,
  type BuyAgainAction,
  type BuyAgainCommandItem,
  type BuyAgainQueueRow,
} from "@/lib/buy-again-command-center";

const laneCopy = {
  buyNow: { title: "Buy Now", description: "Good price, buyable availability, and enough confidence to act.", icon: ShoppingBag },
  watch: { title: "Watch", description: "Interesting but needs a better price, clearer source, or fresher evidence.", icon: TimerReset },
  acquired: { title: "Acquired", description: "Bottles you found and bought back.", icon: CheckCircle2 },
  dismissed: { title: "Dismissed", description: "No longer worth chasing.", icon: XCircle },
} as const;

function LaneCard({ item, onAction, busy }: { item: BuyAgainCommandItem; onAction: (id: string, action: BuyAgainAction) => void; busy: boolean }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium leading-6">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
        </div>
        <Badge variant={item.lane === "buyNow" ? "default" : "secondary"} className="rounded-full capitalize">
          {item.lane.replace(/([A-Z])/g, " $1")}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/40 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Best price</div>
          <div className="mt-1 text-xl font-semibold">{item.bestPriceLabel}</div>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Target</div>
          <div className="mt-1 text-xl font-semibold">{item.targetPriceLabel}</div>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</div>
          <div className="mt-1 text-sm font-medium capitalize">{item.confidenceLabel}</div>
          <div className="text-xs text-muted-foreground capitalize">{item.availabilityLabel}</div>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-sm text-muted-foreground">
        {item.reasons.slice(0, 3).map((reason) => <p key={reason}>• {reason}</p>)}
      </div>

      {item.priceHistory.length ? (
        <div className="mt-4 rounded-2xl border bg-muted/20 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Price history</div>
          <div className="space-y-2">
            {item.priceHistory.slice(0, 3).map((price) => (
              <div key={price.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{price.priceLabel}</span>
                <span className="truncate text-muted-foreground">{price.sourceLabel} · {price.observedAtLabel}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {item.sourceUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Source</a>
          </Button>
        ) : null}
        {item.lane !== "acquired" ? <Button size="sm" onClick={() => onAction(item.id, "acquired")} disabled={busy}>Mark acquired</Button> : null}
        {item.lane !== "watch" && item.lane !== "acquired" && item.lane !== "dismissed" ? <Button variant="secondary" size="sm" onClick={() => onAction(item.id, "watch")} disabled={busy}>Watch</Button> : null}
        {item.lane !== "dismissed" ? <Button variant="ghost" size="sm" onClick={() => onAction(item.id, "dismissed")} disabled={busy}>Dismiss</Button> : null}
      </div>
    </div>
  );
}

function Lane({ name, items, onAction, busyId }: { name: keyof ReturnType<typeof buildBuyAgainCommandCenter>["lanes"]; items: BuyAgainCommandItem[]; onAction: (id: string, action: BuyAgainAction) => void; busyId: string | null }) {
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
        {items.length ? items.map((item) => <LaneCard key={item.id} item={item} onAction={onAction} busy={busyId === item.id} />) : (
          <div className="rounded-3xl border border-dashed bg-background/70 p-6 text-sm text-muted-foreground">No bottles in this lane.</div>
        )}
      </div>
    </div>
  );
}

export function BuyAgainLane() {
  const [rows, setRows] = useState<BuyAgainQueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const center = useMemo(() => buildBuyAgainCommandCenter(rows), [rows]);

  async function loadQueue() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/buy-again", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load Buy Again queue");
      setRows(payload.rows ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load Buy Again queue");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function refreshQueue() {
    setIsRefreshing(true);
    await loadQueue();
    setIsRefreshing(false);
  }

  async function updateStatus(id: string, action: BuyAgainAction) {
    setBusyId(id);
    try {
      const response = await fetch("/api/buy-again", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Could not update lane");
      toast.success("Buy Again lane updated.");
      await loadQueue();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update lane");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card id="buy-again" className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><Trophy className="h-7 w-7 text-primary" /> Buy Again Command Center</CardTitle>
            <CardDescription>Operational lanes for bottles worth chasing again: Buy Now, Watch, Acquired, and Dismissed.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full">{center.summary.buyNowCount} buy now</Badge>
            <Badge variant="outline" className="rounded-full">{center.summary.watchCount} watch</Badge>
            <Button variant="outline" size="sm" onClick={refreshQueue} disabled={isRefreshing || isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" /> {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{center.summary.totalActive}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">active targets</div></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{center.summary.buyNowCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">buy now</div></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{center.summary.acquiredCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">acquired</div></div>
          <div className="rounded-2xl border bg-muted/30 p-4"><div className="text-2xl font-semibold">{center.summary.dismissedCount}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">dismissed</div></div>
        </div>

        {isLoading ? <div className="rounded-3xl border bg-muted/20 p-8 text-center text-muted-foreground">Loading Buy Again queue…</div> : null}
        {!isLoading && rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-center">
            <h3 className="font-semibold">No Buy Again targets yet.</h3>
            <p className="mt-1 text-sm text-muted-foreground">Run Find More from a benchmark bottle or save a 94+ capture to populate this command center.</p>
          </div>
        ) : null}
        {!isLoading && rows.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Lane name="buyNow" items={center.lanes.buyNow} onAction={updateStatus} busyId={busyId} />
            <Lane name="watch" items={center.lanes.watch} onAction={updateStatus} busyId={busyId} />
            <Lane name="acquired" items={center.lanes.acquired} onAction={updateStatus} busyId={busyId} />
            <Lane name="dismissed" items={center.lanes.dismissed} onAction={updateStatus} busyId={busyId} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
