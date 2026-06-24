"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brianFitScore, type AdvisorLineItem, type TasteProfile } from "@/lib/pourfolio-intelligence";

const profile: TasteProfile = {
  lovedDescriptors: ["smooth", "rich", "long finish"],
  preferredRegions: ["Mendoza", "Napa Valley"],
  preferredVarietals: ["Cabernet Sauvignon"],
  preferredProducers: ["Tapiz", "Lewis Cellars"],
  priceBand: { low: 60, typical: 100, high: 150 },
  avoidList: ["Miss Merlot"],
  benchmarkWineIds: ["tapiz-2021"],
  refreshedAt: "2026-06-23T00:00:00.000Z",
};

const sampleList: AdvisorLineItem[] = [
  { producer: "Tapiz", label: "Alta Collection Cabernet Sauvignon", vintage: 2021, varietal: "Cabernet Sauvignon", region: "Mendoza", price: 92, descriptors: ["smooth", "rich"], readiness: "drink_now", valueFlag: "great" },
  { producer: "Lewis Cellars", label: "Reserve Cabernet", vintage: 2020, varietal: "Cabernet Sauvignon", region: "Napa Valley", price: 145, descriptors: ["bold", "polished"], readiness: "drink_now", valueFlag: "fair" },
  { producer: "Willamette Fixture", label: "Pinot Noir", vintage: 2022, varietal: "Pinot Noir", region: "Willamette Valley", price: 74, descriptors: ["silky"], readiness: "unknown", valueFlag: "fair" },
  { producer: "Miss", label: "Merlot", vintage: 2021, varietal: "Merlot", region: "Bordeaux", price: 45, descriptors: ["thin"], readiness: "unknown", valueFlag: "fair" },
];

function tierVariant(tier: string) {
  if (tier === "pour") return "default";
  if (tier === "consider") return "secondary";
  return "outline";
}

export function WineListAdvisor() {
  const [cuisine, setCuisine] = useState("steakhouse dinner");
  const [context, setContext] = useState("impressive but not silly");
  const [items] = useState(sampleList);
  const recommendations = useMemo(() => items.map((item) => ({ item, fit: brianFitScore(item, profile, cuisine) })).sort((a, b) => b.fit.score - a.fit.score), [items, cuisine]);

  return (
    <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="font-playfair text-3xl">Wine List Advisor</CardTitle>
        <CardDescription>Photo of a restaurant list → pour / consider / skip, scored against Brian&apos;s actual benchmark profile.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2"><Label>Cuisine</Label><Input value={cuisine} onChange={(event) => setCuisine(event.target.value)} /></div>
          <div className="space-y-2"><Label>Context</Label><Input value={context} onChange={(event) => setContext(event.target.value)} /></div>
          <div className="flex items-end"><Button type="button">Advise list</Button></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {recommendations.slice(0, 3).map(({ item, fit }) => (
            <div key={`${item.producer}-${item.label}`} className="rounded-3xl border border-border/70 bg-muted/20 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant={tierVariant(fit.tier)} className="rounded-full capitalize">{fit.tier}</Badge>
                <span className="text-2xl font-semibold">{fit.score}</span>
              </div>
              <h3 className="mt-4 font-medium leading-6">{[item.vintage, item.producer, item.label].filter(Boolean).join(" ")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.region} · ${item.price}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{fit.readiness.replace("_", " ")}</Badge>
                <Badge variant="secondary">{fit.valueFlag}</Badge>
                <Badge variant="secondary">Cuisine {fit.cuisineFit}</Badge>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {fit.reasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
          Brian-Fit formula: descriptors 40 · region/varietal 25 · benchmark producer 20 · value 15. Avoid-list matches are hard-capped at 15 and marked skip.
        </div>
      </CardContent>
    </Card>
  );
}
