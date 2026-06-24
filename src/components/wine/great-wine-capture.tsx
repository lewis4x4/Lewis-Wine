"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compareBenchmarkTasting, normalizeCaptureExtraction, type BenchmarkInput, type CaptureExtraction } from "@/lib/pourfolio-intelligence";

const priorBenchmarks: BenchmarkInput[] = [
  { id: "tapiz-2021", producer: "Tapiz", label: "Alta Collection Cabernet Sauvignon", score: 95, region: "Mendoza", varietal: "Cabernet Sauvignon", descriptors: ["smooth", "rich", "long finish"] },
  { id: "lewis-reserve", producer: "Lewis Cellars", label: "Reserve Cabernet", score: 94, region: "Napa Valley", varietal: "Cabernet Sauvignon", descriptors: ["bold", "polished", "dark fruit"] },
];

const sampleExtraction = {
  producer: "Tapiz",
  label: "Alta Collection Cabernet Sauvignon",
  vintage: 2021,
  region: "Mendoza",
  subregion: "San Pablo Vineyard, Uco Valley",
  country: "Argentina",
  varietal: "Cabernet Sauvignon",
  wine_type: "red",
  confidence: { producer: 0.95, label: 0.9, vintage: 0.92, region: 0.86, varietal: 0.94 },
  ambiguous_fields: [],
};

export function GreatWineCapture() {
  const [candidate, setCandidate] = useState<CaptureExtraction>(() => normalizeCaptureExtraction(sampleExtraction));
  const [score, setScore] = useState(95);
  const [descriptors, setDescriptors] = useState("smooth, rich, long finish");
  const [notes, setNotes] = useState("One of the best wines ever.");
  const descriptorList = useMemo(() => descriptors.split(",").map((item) => item.trim()).filter(Boolean), [descriptors]);
  const comparisons = useMemo(() => compareBenchmarkTasting({ score, region: candidate.region, varietal: candidate.varietal, descriptors: descriptorList }, priorBenchmarks), [candidate.region, candidate.varietal, descriptorList, score]);

  async function loadFixture() {
    const response = await fetch("/functions/v1/capture-wine", { method: "POST", body: JSON.stringify({ fixture: true }) }).catch(() => null);
    if (response?.ok) {
      const body = await response.json();
      setCandidate(normalizeCaptureExtraction(body.candidate));
      return;
    }
    setCandidate(normalizeCaptureExtraction(sampleExtraction));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="font-playfair text-3xl">Great Wine Capture</CardTitle>
              <CardDescription>Photo → structured bottle → tasting memory with the why preserved.</CardDescription>
            </div>
            {score >= 94 ? <Badge className="rounded-full">Benchmark</Badge> : <Badge variant="secondary">Tasting</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-3xl border border-dashed border-border bg-muted/25 p-6 text-center">
            <p className="text-sm text-muted-foreground">Bottle image intake is wired for the Supabase `capture-wine` function. Fixture mode keeps demos deterministic.</p>
            <Button type="button" className="mt-4" onClick={loadFixture}>Parse sample bottle</Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Producer</Label><Input value={candidate.producer ?? ""} onChange={(event) => setCandidate({ ...candidate, producer: event.target.value })} /></div>
            <div className="space-y-2"><Label>Vintage</Label><Input value={candidate.vintage ?? ""} onChange={(event) => setCandidate({ ...candidate, vintage: Number(event.target.value) || null })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Label</Label><Input value={candidate.label ?? ""} onChange={(event) => setCandidate({ ...candidate, label: event.target.value })} /></div>
            <div className="space-y-2"><Label>Region</Label><Input value={candidate.region ?? ""} onChange={(event) => setCandidate({ ...candidate, region: event.target.value })} /></div>
            <div className="space-y-2"><Label>Varietal</Label><Input value={candidate.varietal ?? ""} onChange={(event) => setCandidate({ ...candidate, varietal: event.target.value })} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <div className="space-y-2"><Label>Score</Label><Input type="number" min={50} max={100} value={score} onChange={(event) => setScore(Number(event.target.value))} /></div>
            <div className="space-y-2"><Label>Descriptors</Label><Input value={descriptors} onChange={(event) => setDescriptors(event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <Button type="button">Save tasting memory</Button>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl">Benchmark comparison</CardTitle>
          <CardDescription>94+ wines are treated as reference points, not just ratings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {comparisons.slice(0, 3).map((comparison) => (
            <div key={comparison.id} className="rounded-3xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{comparison.displayName}</div>
                <Badge variant="secondary">{comparison.scoreDelta >= 0 ? "+" : ""}{comparison.scoreDelta}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Score {comparison.score} · similarity {comparison.similarity}</p>
              {comparison.sharedDescriptors.length ? <p className="mt-2 text-sm">Shared: {comparison.sharedDescriptors.join(", ")}</p> : null}
            </div>
          ))}
          <div className="rounded-3xl bg-primary/5 p-4 text-sm text-primary">This is the behaviour we want: top bottles become memory anchors for future buying and restaurant-list decisions.</div>
        </CardContent>
      </Card>
    </div>
  );
}
