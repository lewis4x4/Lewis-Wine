"use client";

import { useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { confidenceLabel, pickBestObservation, type PriceObservationDraft } from "@/lib/pourfolio-intelligence";

const benchmarkWines = [
  {
    id: "tapiz-2021",
    name: "Tapiz Alta Collection Cabernet Sauvignon 2021",
    score: 95,
    reason: "Brian called it one of the best wines ever.",
    observations: [
      { sourceName: "Wine.com fixture", sourceUrl: "https://www.wine.com/", price: 38.99, currency: "USD", availability: "in_stock", confidence: 0.86 },
      { sourceName: "Producer shop fixture", sourceUrl: "https://tapiz.com/", price: 42, currency: "USD", availability: "limited", confidence: 0.78 },
    ] satisfies PriceObservationDraft[],
  },
  {
    id: "lewis-reserve",
    name: "Lewis Cellars Reserve Cabernet",
    score: 94,
    reason: "Prior benchmark Cabernet profile for comparison.",
    observations: [
      { sourceName: "Retailer fixture", sourceUrl: "https://retailer.example/lewis", price: 119, currency: "USD", availability: "unknown", confidence: 0.61 },
    ] satisfies PriceObservationDraft[],
  },
];

export function BuyAgainLane() {
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const rows = useMemo(() => benchmarkWines.map((wine) => ({ ...wine, best: pickBestObservation(wine.observations) })), []);

  async function refreshEvidence(id: string) {
    setRefreshing(id);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setRefreshing(null);
  }

  return (
    <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-playfair text-3xl">Buy Again lane</CardTitle>
            <CardDescription>Benchmark bottles with sourced price evidence, availability, and confidence labels.</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit rounded-full">94+ auto-populated</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {rows.map((wine) => (
          <div key={wine.id} className="rounded-3xl border border-border/70 bg-muted/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium leading-6">{wine.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Score {wine.score} · {wine.reason}</p>
              </div>
              <Badge className="rounded-full">active</Badge>
            </div>
            {wine.best ? (
              <div className="mt-4 rounded-2xl bg-background/80 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold">${wine.best.price.toFixed(2)}</div>
                    <div className="text-muted-foreground">{wine.best.availability.replace("_", " ")} · {confidenceLabel(wine.best.confidence)} confidence</div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={wine.best.sourceUrl ?? "#"} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Source</a>
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => refreshEvidence(wine.id)} disabled={refreshing === wine.id}>
                <RefreshCw className="mr-2 h-4 w-4" /> {refreshing === wine.id ? "Refreshing" : "Refresh evidence"}
              </Button>
              <Button variant="outline" size="sm">Mark acquired</Button>
              <Button variant="ghost" size="sm">Dismiss</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
