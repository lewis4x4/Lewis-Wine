"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, RefreshCw, ShoppingBag, Target, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildShoppingMode,
  parseRetailerWineText,
  shoppingPickToAcquisitionTarget,
  type ShoppingRecommendation,
} from "@/lib/shopping-mode";
import type { TasteProfile } from "@/lib/pourfolio-intelligence";

const demoText = `2021 Tapiz Alta Collection Cabernet Sauvignon Mendoza $92 available
2020 Lewis Cellars Reserve Cabernet Napa Valley $210 limited
2021 Miss Merlot Bordeaux $45 in stock
2022 Willamette Fixture Pinot Noir $68 sold out`;

const demoProfile: TasteProfile = {
  lovedDescriptors: ["smooth", "rich", "black fruit", "long finish"],
  preferredRegions: ["Mendoza", "Napa Valley"],
  preferredVarietals: ["Cabernet Sauvignon", "Malbec"],
  preferredProducers: ["Tapiz", "Lewis Cellars"],
  priceBand: { low: 60, typical: 100, high: 180 },
  avoidList: ["Miss Merlot"],
  benchmarkWineIds: ["tapiz-95"],
  refreshedAt: new Date(0).toISOString(),
};

function cents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function PickCard({ label, pick, onAdd, busy }: { label: string; pick: ShoppingRecommendation | null; onAdd: (pick: ShoppingRecommendation) => void; busy: boolean }) {
  if (!pick) {
    return <div className="rounded-3xl border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">No {label.toLowerCase()} pick yet.</div>;
  }
  const name = [pick.item.vintage, pick.item.producer, pick.item.label].filter(Boolean).join(" ");
  return (
    <div className="rounded-3xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</div><h3 className="mt-1 font-playfair text-xl font-semibold">{name}</h3><p className="text-sm text-muted-foreground">{[pick.item.region, pick.item.varietal].filter(Boolean).join(" · ")}</p></div>
        <Badge variant={pick.decision === "Buy Now" ? "default" : pick.decision === "Skip" ? "destructive" : "secondary"}>{pick.decision}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Brian-Fit {pick.fit.score}</Badge>
        <Badge variant="outline">{pick.item.price ? `$${pick.item.price}` : "price unknown"}</Badge>
        <Badge variant="outline">{pick.item.availability.replace("_", " ")}</Badge>
        {pick.quantityToBuy ? <Badge variant="secondary">Buy {pick.quantityToBuy}</Badge> : null}
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">{pick.why.slice(0, 3).map((why) => <p key={why}>• {why}</p>)}</div>
      {pick.decision !== "Skip" ? <Button className="mt-4" size="sm" onClick={() => onAdd(pick)} disabled={busy}>Add to Acquisition Engine</Button> : null}
    </div>
  );
}

export function ShoppingModePanel() {
  const [retailer, setRetailer] = useState("Benchmark Wine Shop");
  const [context, setContext] = useState("stocking the house before a steak dinner");
  const [desiredQuantity, setDesiredQuantity] = useState(6);
  const [budget, setBudget] = useState("650");
  const [text, setText] = useState(demoText);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);

  const localResult = useMemo(() => buildShoppingMode({
    retailer,
    context,
    desiredQuantity,
    maxBudgetCents: budget ? Math.round(Number(budget) * 100) : null,
    profile: demoProfile,
    items: parseRetailerWineText(text),
  }), [retailer, context, desiredQuantity, budget, text]);

  async function rankWithPrivateProfile() {
    setServerBusy(true);
    setServerNotice(null);
    try {
      const response = await fetch("/api/shopping-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailer, context, desiredQuantity, maxBudgetCents: budget ? Math.round(Number(budget) * 100) : null, pastedText: text }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        setServerNotice("Private Taste Genome ranking requires sign-in; showing deterministic demo profile instead.");
        return;
      }
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to rank shopping list");
      setServerNotice("Ranked against private Taste Genome.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rank shopping list");
    } finally {
      setServerBusy(false);
    }
  }

  async function addToAcquisition(pick: ShoppingRecommendation) {
    setBusyId(pick.id);
    try {
      const response = await fetch("/api/acquisition-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shoppingPickToAcquisitionTarget(pick, retailer)),
      });
      const payload = await response.json();
      if (response.status === 401) throw new Error("Sign in before saving acquisition targets.");
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to add acquisition target");
      toast.success("Added to Acquisition Engine.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add acquisition target");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card id="shopping-mode" className="rounded-[28px] border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><ShoppingBag className="h-7 w-7 text-primary" /> Shopping Mode</CardTitle>
            <CardDescription>Paste a retailer shelf, allocation email, or shop list and turn it into acquisition-ready targets.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{localResult.summary.buyNow} buy now</Badge><Badge variant="outline">{localResult.summary.total} parsed</Badge><Badge variant="outline">{cents(localResult.summary.estimatedSpendCents)} planned</Badge></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_140px_140px_auto]">
          <div className="space-y-2"><Label>Retailer</Label><Input value={retailer} onChange={(event) => setRetailer(event.target.value)} /></div>
          <div className="space-y-2"><Label>Context</Label><Input value={context} onChange={(event) => setContext(event.target.value)} /></div>
          <div className="space-y-2"><Label>Qty target</Label><Input type="number" min={1} value={desiredQuantity} onChange={(event) => setDesiredQuantity(Math.max(1, Number(event.target.value) || 1))} /></div>
          <div className="space-y-2"><Label>Budget</Label><Input value={budget} onChange={(event) => setBudget(event.target.value)} /></div>
          <div className="flex items-end"><Button onClick={rankWithPrivateProfile} disabled={serverBusy}><RefreshCw className="mr-2 h-4 w-4" /> {serverBusy ? "Ranking" : "Rank"}</Button></div>
        </div>
        <Textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border bg-background/70 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-primary">Shopping brief</div><p className="mt-2 text-lg font-medium">{localResult.shoppingBrief}</p>{localResult.budgetWarning ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{localResult.budgetWarning}</p> : null}{serverNotice ? <p className="mt-2 text-sm text-muted-foreground">{serverNotice}</p> : null}</div>
          <div className="rounded-3xl border bg-background/70 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-primary">Photo-first path</div><p className="mt-2 text-sm text-muted-foreground">Upload/OCR gets wired through the same parser next; paste mode is the deterministic backbone.</p><Label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground"><Upload className="h-4 w-4" /> Photo import staged<input type="file" accept="image/*" className="hidden" onChange={() => toast.info("Photo shopping import is staged; paste OCR text for this slice.")} /></Label></div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <PickCard label="Best buy" pick={localResult.picks.bestBuy} onAdd={addToAcquisition} busy={busyId === localResult.picks.bestBuy?.id} />
          <PickCard label="Best value" pick={localResult.picks.bestValue} onAdd={addToAcquisition} busy={busyId === localResult.picks.bestValue?.id} />
          <PickCard label="Splurge-worthy" pick={localResult.picks.splurge} onAdd={addToAcquisition} busy={busyId === localResult.picks.splurge?.id} />
          <PickCard label="Skip" pick={localResult.picks.skip} onAdd={addToAcquisition} busy={busyId === localResult.picks.skip?.id} />
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" asChild><Link href="/intelligence#acquisition-engine"><Target className="mr-2 h-4 w-4" /> Open Acquisition Engine</Link></Button><Button variant="outline" size="sm" asChild><Link href="/shopping/add"><Camera className="mr-2 h-4 w-4" /> Manual shopping item</Link></Button></div>
      </CardContent>
    </Card>
  );
}
