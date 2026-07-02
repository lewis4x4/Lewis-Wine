"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Grape, History, Loader2, Search, ShoppingBag, Sparkles, Wine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const nf = new Intl.NumberFormat("en-US");

type WineRow = {
  id: string;
  producer: string | null;
  label: string | null;
  vintage: number | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  varietal: string | null;
  wine_type: string | null;
};

type TastingRow = {
  id: string;
  score: number | null;
  buy_again: string | null;
  occasion: string | null;
  descriptors: string[] | null;
  notes: string | null;
  is_benchmark: boolean;
  evidence_path: string | null;
  created_at: string;
};

type HistoryRow = {
  id: string;
  score: number | null;
  buy_again: string | null;
  occasion: string | null;
  descriptors: unknown[];
  notes: string | null;
  is_benchmark: boolean;
  created_at: string | null;
  current: boolean;
};

type ConfirmationPayload = {
  success: boolean;
  error?: string;
  confirmation: {
    title: string;
    saved_at: string;
    save_mode: string;
    inventory_id: string | null;
    rating_id: string | null;
  };
  wine: WineRow;
  tasting: TastingRow;
  stats: {
    tasting_count: number;
    average_score: number | null;
    high_score: number | null;
    buy_again_count: number;
    benchmark_count: number;
    latest_score: number | null;
    evidence_saved: boolean;
  };
  history: HistoryRow[];
  downstream: {
    buy_again_queue: { id: string; status: string; note: string | null } | null;
    acquisition_target: { id: string; status: string; priority: string; desired_quantity: number | null; next_refresh_at: string | null } | null;
    price_observations: Array<{ id: string; source_name: string; price: number; currency: string; availability: string; observed_at: string }>;
  };
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function compact(values: Array<string | number | null | undefined>) {
  return values.filter((value) => value !== null && value !== undefined && value !== "").join(" · ");
}

function wineStory(wine: WineRow, tasting: TastingRow) {
  const region = compact([wine.subregion, wine.region, wine.country]);
  const grape = wine.varietal ?? wine.label ?? "this bottle";
  const producer = wine.producer ?? "the producer";
  const notes = tasting.notes?.trim();
  if (notes) return notes;
  return `${producer} ${grape}${region ? ` from ${region}` : ""} is now part of your tasting memory. Use this page as the bridge from capture into Buy Again, cellar context, and future price intelligence.`;
}

function saveModeLabel(mode: string) {
  if (mode === "add_to_cellar") return "Added one bottle to cellar";
  if (mode === "link_existing_inventory") return "Linked to cellar bottle";
  return "Saved as tasting memory";
}

export default function CaptureSavedPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ConfirmationPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/field-capture/confirmation/${params.id}`, { credentials: "include" });
        const payload = await response.json() as ConfirmationPayload;
        if (!response.ok || !payload.success) throw new Error(payload.error || "Could not load saved tasting");
        if (active) setData(payload);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load saved tasting");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (params.id) void load();
    return () => { active = false; };
  }, [params.id]);

  const descriptors = useMemo(() => data?.tasting.descriptors?.filter(Boolean) ?? [], [data]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading saved tasting…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Could not open saved tasting</CardTitle>
            <CardDescription>{error ?? "The saved capture could not be loaded."}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild><Link href="/capture">Back to capture</Link></Button></CardContent>
        </Card>
      </div>
    );
  }

  const { wine, tasting, stats, downstream } = data;
  const hasBuyAgain = tasting.buy_again === "yes";
  const bottleHref = data.confirmation.inventory_id ? `/cellar/${data.confirmation.inventory_id}?tasting=${data.confirmation.rating_id ?? tasting.id}` : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      <section className="overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_36%),linear-gradient(135deg,var(--background),color-mix(in_oklab,var(--muted)_55%,transparent))] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Badge className="rounded-full px-3 py-1"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Saved tasting memory</Badge>
            <div>
              <h1 className="font-playfair text-4xl font-bold tracking-tight md:text-6xl">{data.confirmation.title}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">{wineStory(wine, tasting)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full">{saveModeLabel(data.confirmation.save_mode)}</Badge>
              {stats.evidence_saved ? <Badge variant="secondary" className="rounded-full">Photo evidence stored</Badge> : null}
              {hasBuyAgain ? <Badge variant="secondary" className="rounded-full">Buy Again target created</Badge> : null}
              {tasting.is_benchmark ? <Badge variant="secondary" className="rounded-full">Benchmark bottle</Badge> : null}
            </div>
          </div>
          <Card className="min-w-full border-primary/20 bg-background/85 lg:min-w-[320px]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wine className="h-5 w-5 text-primary" /> Capture confirmed</CardTitle>
              <CardDescription>{fmtDate(data.confirmation.saved_at)}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border p-3"><div className="text-2xl font-semibold">{stats.latest_score ?? "—"}</div><div className="text-xs text-muted-foreground">Score</div></div>
              <div className="rounded-2xl border p-3"><div className="text-2xl font-semibold">{stats.tasting_count}</div><div className="text-xs text-muted-foreground">Tastings</div></div>
              <div className="rounded-2xl border p-3"><div className="text-2xl font-semibold">{stats.high_score ?? "—"}</div><div className="text-xs text-muted-foreground">High</div></div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Grape className="h-5 w-5 text-primary" /> Wine profile</CardTitle>
            <CardDescription>Identity and context captured from the bottle.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["Producer", wine.producer],
              ["Label", wine.label],
              ["Vintage", wine.vintage],
              ["Region", compact([wine.subregion, wine.region])],
              ["Country", wine.country],
              ["Varietal", wine.varietal],
              ["Type", wine.wine_type],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
                <div className="mt-1 font-medium">{String(value || "—")}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Your signal</CardTitle>
            <CardDescription>Why this bottle matters to Pourfolio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="text-sm font-medium">Occasion / pairing</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{tasting.occasion || "No occasion captured."}</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="text-sm font-medium">Descriptors</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {descriptors.length ? descriptors.map((descriptor) => <Badge key={descriptor} variant="outline" className="rounded-full">{descriptor}</Badge>) : <span className="text-sm text-muted-foreground">No descriptors captured.</span>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border p-3"><div className="text-xl font-semibold">{stats.average_score ?? "—"}</div><div className="text-xs text-muted-foreground">Average score</div></div>
              <div className="rounded-2xl border p-3"><div className="text-xl font-semibold">{stats.buy_again_count}</div><div className="text-xs text-muted-foreground">Buy Again votes</div></div>
              <div className="rounded-2xl border p-3"><div className="text-xl font-semibold">{stats.benchmark_count}</div><div className="text-xs text-muted-foreground">Benchmarks</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" /> Next useful action</CardTitle>
            <CardDescription>Capture should end with a decision surface, not a dead-end toast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {downstream.acquisition_target ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="font-medium">Acquisition target is live</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Priority {downstream.acquisition_target.priority}; desired quantity {downstream.acquisition_target.desired_quantity ?? "—"}. Price refresh is the next enrichment step.
                </p>
              </div>
            ) : hasBuyAgain ? (
              <div className="rounded-2xl border bg-muted/20 p-4">Buy Again was requested; price enrichment is ready to run next.</div>
            ) : (
              <div className="rounded-2xl border bg-muted/20 p-4">No Buy Again action requested for this tasting.</div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild className="justify-between"><Link href={`/intelligence?wine_id=${wine.id}&action=find-more`}>Find price evidence <Search className="h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="justify-between"><Link href={`/intelligence?wine_id=${wine.id}#buy-again`}>Buy Again lane <ArrowRight className="h-4 w-4" /></Link></Button>
              {bottleHref ? <Button asChild variant="outline" className="justify-between"><Link href={bottleHref}>Open cellar bottle <ArrowRight className="h-4 w-4" /></Link></Button> : null}
              <Button asChild variant="outline" className="justify-between"><Link href="/capture">Capture another <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
            {downstream.price_observations.length ? (
              <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Latest observed price: {downstream.price_observations[0].currency} {nf.format(downstream.price_observations[0].price)} from {downstream.price_observations[0].source_name}.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Tasting history</CardTitle>
            <CardDescription>This wine’s Pourfolio memory, newest first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.history.map((row) => (
              <div key={row.id} className={row.current ? "rounded-2xl border border-primary/30 bg-primary/5 p-4" : "rounded-2xl border bg-muted/20 p-4"}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4 text-primary" /> {fmtDate(row.created_at)}</div>
                  <Badge variant={row.current ? "default" : "outline"} className="rounded-full">{row.current ? "Just saved" : "Past"}</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">Score {row.score ?? "—"} · Buy again {row.buy_again ?? "—"}</div>
                {row.occasion ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.occasion}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
