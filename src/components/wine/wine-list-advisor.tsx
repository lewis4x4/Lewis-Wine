"use client";

import { useMemo, useState } from "react";
import { Camera, Crown, RefreshCw, Sparkles, Upload, Wine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildRestaurantMode, parseRestaurantWineText, type RestaurantModeResult, type RestaurantRecommendation } from "@/lib/restaurant-mode";
import type { TasteProfile } from "@/lib/pourfolio-intelligence";

const sampleText = `2021 Tapiz Alta Collection Cabernet Sauvignon, Mendoza 92
2020 Lewis Cellars Reserve Cabernet, Napa Valley 175
2022 Willamette Fixture Pinot Noir, Willamette Valley 74
2021 Miss Merlot, Bordeaux 45`;

const fallbackProfile: TasteProfile = {
  lovedDescriptors: ["smooth", "rich", "long finish", "black fruit"],
  preferredRegions: ["Mendoza", "Napa Valley"],
  preferredVarietals: ["Cabernet Sauvignon"],
  preferredProducers: ["Tapiz", "Lewis Cellars"],
  priceBand: { low: 60, typical: 100, high: 150 },
  avoidList: ["Miss Merlot"],
  benchmarkWineIds: ["tapiz-2021"],
  refreshedAt: "2026-06-24T00:00:00.000Z",
};

function emptyResult(): RestaurantModeResult {
  return buildRestaurantMode({ restaurant: "", cuisine: "steakhouse dinner", context: "impressive but not silly", profile: fallbackProfile, items: [] });
}

function decisionVariant(decision: string) {
  if (decision === "Pour") return "default";
  if (decision === "Consider") return "secondary";
  return "outline";
}

function PickCard({ title, pick, icon }: { title: string; pick: RestaurantRecommendation | null; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-background/85 p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{icon}{title}</div>
      {pick ? (
        <div className="mt-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-6">{[pick.item.vintage, pick.item.producer, pick.item.label].filter(Boolean).join(" ")}</h3>
            <Badge variant={decisionVariant(pick.decision)}>{pick.decision}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{[pick.item.region, pick.item.varietal].filter(Boolean).join(" · ")}{pick.item.price ? ` · $${pick.item.price}` : ""}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Brian-Fit {pick.fit.score}</Badge>
            <Badge variant="outline">{pick.confidence.label} confidence</Badge>
          </div>
        </div>
      ) : <p className="mt-3 text-sm text-muted-foreground">No pick yet.</p>}
    </div>
  );
}

function RecommendationRow({ recommendation }: { recommendation: RestaurantRecommendation }) {
  return (
    <div className="rounded-3xl border bg-background/80 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={decisionVariant(recommendation.decision)}>{recommendation.decision}</Badge>
            <Badge variant="outline">{recommendation.confidence.label} confidence</Badge>
            <Badge variant="secondary">{recommendation.fit.valueFlag}</Badge>
          </div>
          <h3 className="mt-3 font-semibold leading-6">{[recommendation.item.vintage, recommendation.item.producer, recommendation.item.label].filter(Boolean).join(" ")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{[recommendation.item.region, recommendation.item.varietal].filter(Boolean).join(" · ")}{recommendation.item.price ? ` · $${recommendation.item.price}` : ""}</p>
        </div>
        <div className="text-left md:text-right">
          <div className="text-3xl font-semibold">{recommendation.fit.score}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Brian-Fit</div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {recommendation.why.slice(0, 4).map((reason) => <p key={reason} className="rounded-xl bg-muted/40 p-3 text-sm leading-5 text-muted-foreground">{reason}</p>)}
      </div>
    </div>
  );
}

export function WineListAdvisor() {
  const [restaurant, setRestaurant] = useState("Fixture Steakhouse");
  const [cuisine, setCuisine] = useState("steakhouse dinner");
  const [context, setContext] = useState("impressive but not silly");
  const [pastedText, setPastedText] = useState(sampleText);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RestaurantModeResult>(() => buildRestaurantMode({ restaurant: "Fixture Steakhouse", cuisine: "steakhouse dinner", context: "impressive but not silly", profile: fallbackProfile, items: parseRestaurantWineText(sampleText) }));

  const primaryCount = useMemo(() => `${result.summary.pour} pour · ${result.summary.consider} consider · ${result.summary.skip} skip`, [result.summary]);

  async function advise() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/restaurant-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restaurant, cuisine, context, pastedText, imageBase64, mediaType }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Restaurant Mode failed");
      setResult(payload.result);
      toast.success("Restaurant list ranked");
    } catch (error) {
      const localItems = parseRestaurantWineText(pastedText);
      if (localItems.length) {
        setResult(buildRestaurantMode({ restaurant, cuisine, context, profile: fallbackProfile, items: localItems }));
        toast.warning("Using local demo profile; sign in to save and use the live Taste Genome.");
      } else {
        setResult(emptyResult());
        toast.error(error instanceof Error ? error.message : "Could not rank wine list");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a photo of the wine list.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const [, base64] = dataUrl.split(",");
    setImageBase64(base64 ?? null);
    setMediaType(file.type);
    toast.success("Wine-list photo staged");
  }

  return (
    <Card className="rounded-[28px] border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl"><Wine className="h-7 w-7 text-primary" /> Restaurant Mode</CardTitle>
            <CardDescription>Upload or paste a restaurant wine list → Pourfolio ranks it → choose Pour / Consider / Skip.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full">{primaryCount}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-2"><Label>Restaurant</Label><Input value={restaurant} onChange={(event) => setRestaurant(event.target.value)} /></div>
          <div className="space-y-2"><Label>Cuisine / occasion</Label><Input value={cuisine} onChange={(event) => setCuisine(event.target.value)} /></div>
          <div className="space-y-2"><Label>Decision style</Label><Input value={context} onChange={(event) => setContext(event.target.value)} /></div>
          <div className="flex items-end"><Button type="button" onClick={advise} disabled={isLoading} className="w-full"><RefreshCw className="mr-2 h-4 w-4" />{isLoading ? "Ranking" : "Rank list"}</Button></div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <Label>Paste wine list text</Label>
            <textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} className="min-h-40 w-full rounded-2xl border bg-background p-4 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="rounded-3xl border border-dashed bg-background/70 p-5">
            <div className="flex items-center gap-2 font-medium"><Camera className="h-5 w-5" /> Photo-first flow</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Upload a wine-list photo. The API routes image OCR through the Supabase Edge Function so LLM credentials stay server-side.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border bg-muted/30 p-5 text-sm font-medium hover:bg-muted/50">
              <Upload className="mr-2 h-4 w-4" /> {imageBase64 ? "Photo staged" : "Upload wine-list photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
            </label>
            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
              <p>• Text paste works instantly for demos and menus copied from PDFs.</p>
              <p>• Photo mode saves the analyzed list when authenticated.</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-background/85 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best answer</div>
          <p className="mt-2 text-2xl font-semibold leading-8">{result.headline}</p>
          <p className="mt-3 rounded-2xl bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">{result.sommQuestion}</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          <PickCard title="Best bottle tonight" pick={result.picks.bestBottleTonight} icon={<Sparkles className="h-4 w-4" />} />
          <PickCard title="Best value" pick={result.picks.bestValue} icon={<Wine className="h-4 w-4" />} />
          <PickCard title="Splurge pick" pick={result.picks.splurgePick} icon={<Crown className="h-4 w-4" />} />
          <PickCard title="Avoid / skip" pick={result.picks.skip} icon={<XCircle className="h-4 w-4" />} />
        </div>

        <div className="space-y-3">
          {result.recommendations.length ? result.recommendations.map((recommendation) => <RecommendationRow key={recommendation.id} recommendation={recommendation} />) : <div className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">Paste or photograph a restaurant list to rank it.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
