"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Compass,
  Gauge,
  MoonStar,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import type { RecommendationsResponse, TonightContext, TonightRecommendation } from "@/app/api/recommendations/route";

const mealOptions = [
  { value: "anything", label: "Anything" },
  { value: "steak", label: "Steak or beef" },
  { value: "bbq", label: "BBQ" },
  { value: "seafood", label: "Seafood" },
  { value: "chicken", label: "Chicken" },
  { value: "salad", label: "Salad or lighter plate" },
  { value: "dessert", label: "Dessert" },
];

const occasionOptions = [
  { value: "weeknight", label: "Weeknight" },
  { value: "date-night", label: "Date night" },
  { value: "celebration", label: "Celebration" },
  { value: "dinner-party", label: "Dinner party" },
  { value: "solo-reset", label: "Solo reset" },
];

const moodOptions = [
  { value: "cozy", label: "Cozy" },
  { value: "bright", label: "Bright" },
  { value: "impressive", label: "Impressive" },
  { value: "easy", label: "Easygoing" },
];

const adventurousOptions = [
  { value: "safe", label: "Play it safe" },
  { value: "balanced", label: "Balanced" },
  { value: "adventurous", label: "Surprise me" },
];

async function fetchRecommendations(context: TonightContext): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  if (context.meal && context.meal !== "anything") params.set("meal", context.meal);
  if (context.occasion) params.set("occasion", context.occasion);
  if (context.mood) params.set("mood", context.mood);
  if (context.adventurous) params.set("adventurous", context.adventurous);

  const response = await fetch(`/api/recommendations?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch tonight recommendations");
  return response.json();
}

export default function RecommendationsPage() {
  const [context, setContext] = useState<TonightContext>({
    meal: "anything",
    occasion: "weeknight",
    mood: "cozy",
    adventurous: "balanced",
  });
  const [selectedTonightId, setSelectedTonightId] = useState<string | null>(null);
  const queryKey = useMemo(() => ["tonight-engine", context], [context]);

  function selectTonightBottle(recommendation: TonightRecommendation) {
    setSelectedTonightId(recommendation.inventory_id);
    toast.success("Tonight's bottle selected for this session.");
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchRecommendations(context),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <TonightEngineHeader />
        <TonightContextBar context={context} onChange={setContext} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </div>
            <p className="mt-4 text-lg font-medium">Choosing tonight’s bottle...</p>
            <p className="text-muted-foreground">Scanning your real cellar, not a generic wine list.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="space-y-6">
        <TonightEngineHeader />
        <TonightContextBar context={context} onChange={setContext} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl">🍷</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">Tonight Engine hit a snag</h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              {data?.error || "We couldn’t score the cellar right now."}
            </p>
            <Button onClick={() => refetch()} className="mt-4">Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(120,24,40,0.10),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.94),rgba(250,247,241,0.74))] px-6 py-6 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.42)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <TonightEngineHeader />
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="h-11 rounded-full border-border/70 bg-background/70 px-5 backdrop-blur">
            <RefreshCw className={isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            {isFetching ? "Re-scoring" : "Re-score tonight"}
          </Button>
        </div>

        <div className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[28px] border border-border/60 bg-background/86 shadow-sm backdrop-blur">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary">Cellar-first</Badge>
                <Badge variant="outline" className="rounded-full">{data.primary ? `${data.primary.confidence}% confidence` : "No pick yet"}</Badge>
                <Badge variant="outline" className="rounded-full">{data.alternates.length} alternate{data.alternates.length === 1 ? "" : "s"}</Badge>
              </div>
              <div>
                <CardTitle className="font-playfair text-3xl tracking-tight sm:text-4xl">{data.headline}</CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">{data.summary}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
              <DecisionNote icon={<ShieldCheck className="h-4 w-4" />} label="Trust read" text={data.confidence_note} />
              <DecisionNote
                icon={data.fallback_prompt ? <AlertTriangle className="h-4 w-4" /> : <Gauge className="h-4 w-4" />}
                label={data.fallback_prompt ? "Sharpen next pick" : "Data posture"}
                text={data.fallback_prompt || "Enough signal is present to keep the decision crisp without pretending to know more than the cellar says."}
              />
            </CardContent>
          </Card>

          <TonightContextBar context={context} onChange={setContext} />
        </div>
      </section>

      {data.primary ? (
        <TonightPrimaryCard
          recommendation={data.primary}
          isSelected={selectedTonightId === data.primary.inventory_id}
          isSaving={false}
          onMarkTonight={() => {
            if (data.primary) selectTonightBottle(data.primary);
          }}
        />
      ) : (
        <Card className="rounded-3xl border border-border/60 bg-background/88 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Tonight Engine could not find a primary bottle yet.</p>
            {data.fallback_prompt && <p className="mt-3 text-sm">{data.fallback_prompt}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border border-border/60 bg-background/88 shadow-sm">
          <CardHeader>
            <CardTitle className="tracking-tight">Alternates</CardTitle>
            <CardDescription>Two credible backups. The badge shows confidence; Brian-Fit is separate when known.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.alternates.length > 0 ? (
              data.alternates.map((recommendation, index) => (
                <TonightAlternateCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  rank={index + 1}
                  isSelected={selectedTonightId === recommendation.inventory_id}
                  isSaving={false}
                  onMarkTonight={() => selectTonightBottle(recommendation)}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No alternates yet. The cellar is thin, but the primary pick still stands.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-background/88 shadow-sm">
          <CardHeader>
            <CardTitle className="tracking-tight">Critical read</CardTitle>
            <CardDescription>What the engine is allowed to claim — and where it should stay humble.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <WhyRow icon={<ShieldCheck className="h-4 w-4" />} label="Grounded" text="Every pick comes from bottles actually in the cellar, with one primary recommendation instead of a vague list." />
            <WhyRow icon={<Scale className="h-4 w-4" />} label="Tradeoff-aware" text="Confidence, Brian-Fit, value, and scarcity are visible as separate signals rather than collapsed into fake certainty." />
            <WhyRow icon={<AlertTriangle className="h-4 w-4" />} label="Still thin" text="Sparse custom bottles remain useful but are labelled cautiously until tasting, value, or drink-window data improves." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TonightEngineHeader() {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Tonight decision layer
      </div>
      <div className="space-y-2">
        <h1 className="font-playfair text-5xl font-semibold tracking-tight text-foreground">Tonight Engine</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">Choose what to open with calm confidence, from the bottles you already own.</p>
      </div>
    </div>
  );
}

function TonightContextBar({
  context,
  onChange,
}: {
  context: TonightContext;
  onChange: (next: TonightContext) => void;
}) {
  return (
    <Card className="rounded-3xl border border-border/60 bg-background/88 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
          <MoonStar className="h-5 w-5 text-primary" /> Tonight’s context
        </CardTitle>
        <CardDescription>Give the engine just enough signal to make a smarter call.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select value={context.meal || "anything"} onValueChange={(meal) => onChange({ ...context, meal })}>
          <SelectTrigger className="h-12 rounded-full border-border/60 bg-background">
            <SelectValue placeholder="Meal" />
          </SelectTrigger>
          <SelectContent>
            {mealOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={context.occasion || "weeknight"} onValueChange={(occasion) => onChange({ ...context, occasion })}>
          <SelectTrigger className="h-12 rounded-full border-border/60 bg-background">
            <SelectValue placeholder="Occasion" />
          </SelectTrigger>
          <SelectContent>
            {occasionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={context.mood || "cozy"} onValueChange={(mood) => onChange({ ...context, mood })}>
          <SelectTrigger className="h-12 rounded-full border-border/60 bg-background">
            <SelectValue placeholder="Mood" />
          </SelectTrigger>
          <SelectContent>
            {moodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={context.adventurous || "balanced"} onValueChange={(adventurous) => onChange({ ...context, adventurous: adventurous as TonightContext["adventurous"] })}>
          <SelectTrigger className="h-12 rounded-full border-border/60 bg-background">
            <SelectValue placeholder="Style" />
          </SelectTrigger>
          <SelectContent>
            {adventurousOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

function TonightPrimaryCard({
  recommendation,
  isSelected,
  isSaving,
  onMarkTonight,
}: {
  recommendation: TonightRecommendation;
  isSelected: boolean;
  isSaving: boolean;
  onMarkTonight: () => void;
}) {
  const scoreSignals = getScoreSignals(recommendation);

  return (
    <Card className="overflow-hidden rounded-[32px] border border-border/60 bg-background/96 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
      <CardHeader className="border-b border-border/50 bg-[linear-gradient(135deg,rgba(120,24,40,0.08),transparent_42%)] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary px-3 py-1 text-primary-foreground">Best bottle now</Badge>
              <Badge variant="outline" className="rounded-full bg-background/70">{recommendation.confidence}% decision confidence</Badge>
              {recommendation.brian_fit_score ? (
                <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                  Brian-Fit {recommendation.brian_fit_score}
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full bg-background/70">Brian-Fit thin</Badge>
              )}
              <Badge variant="outline" className="rounded-full bg-background/70">{formatWineType(recommendation.wine_type)}</Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="max-w-4xl font-playfair text-4xl tracking-tight sm:text-5xl">
                {recommendation.vintage_label !== "Vintage unknown" ? `${recommendation.vintage_label} ` : ""}
                {recommendation.name}
              </CardTitle>
              <CardDescription className="text-base leading-7">
                {recommendation.producer} • {recommendation.region} • {recommendation.quantity} bottle{recommendation.quantity === 1 ? "" : "s"} left • {recommendation.price_context}
              </CardDescription>
            </div>
          </div>

          <div className="min-w-[160px] rounded-3xl border border-border/60 bg-background/82 p-4 text-center shadow-sm">
            <div className="font-playfair text-5xl font-semibold tracking-tight text-primary">{recommendation.confidence}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">confidence</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <SignalCard icon={<UtensilsCrossed className="h-4 w-4" />} label="Decision reason" value={recommendation.reason} featured />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SignalCard icon={<Compass className="h-4 w-4" />} label="Best moment" value={recommendation.best_for} />
            <SignalCard icon={<AlertTriangle className="h-4 w-4" />} label="Watch-out" value={recommendation.caution} tone={recommendation.caution.includes("Low structural risk") ? "calm" : "warning"} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          {recommendation.brian_fit_reason ? (
            <SignalCard icon={<Sparkles className="h-4 w-4" />} label="Brian-Fit evidence" value={recommendation.brian_fit_reason} />
          ) : (
            <SignalCard icon={<Sparkles className="h-4 w-4" />} label="Brian-Fit evidence" value="No strong Brian-Fit explanation yet. This pick leans on context and cellar practicality rather than pretending a taste profile match exists." tone="warning" />
          )}
          <div className="rounded-3xl border border-border/60 bg-muted/15 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">Why it won</div>
                <div className="text-xs text-muted-foreground">Transparent scoring, not black-box recommendation theatre.</div>
              </div>
              <Gauge className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-3">
              {scoreSignals.map((signal) => <ScoreBar key={signal.label} {...signal} />)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border/50 pt-6">
          <Button asChild className="rounded-full px-5">
            <Link href={`/cellar/${recommendation.inventory_id}`}>
              Open Bottle Brain <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant={isSelected ? "secondary" : "outline"} onClick={onMarkTonight} disabled={isSaving} className="rounded-full px-5">
            {isSelected ? <CheckCircle2 className="mr-2 h-4 w-4" /> : null}
            {isSaving ? "Saving..." : isSelected ? "Tonight’s bottle selected" : "Select for tonight"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TonightAlternateCard({
  recommendation,
  rank,
  isSelected,
  isSaving,
  onMarkTonight,
}: {
  recommendation: TonightRecommendation;
  rank: number;
  isSelected: boolean;
  isSaving: boolean;
  onMarkTonight: () => void;
}) {
  const scoreSignals = getScoreSignals(recommendation).slice(0, 3);

  return (
    <div className="rounded-3xl border border-border/60 bg-background/88 p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Badge variant="outline" className="rounded-full bg-muted/30">Alternate {rank}</Badge>
          <div>
            <h3 className="text-lg font-medium tracking-tight text-foreground">
              {recommendation.vintage_label !== "Vintage unknown" ? `${recommendation.vintage_label} ` : ""}
              {recommendation.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{recommendation.producer} • {recommendation.region}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className="rounded-full">
            {recommendation.confidence}% confidence
          </Badge>
          {recommendation.brian_fit_score ? (
            <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
              Brian-Fit {recommendation.brian_fit_score}
            </Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{recommendation.reason}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {scoreSignals.map((signal) => (
          <div key={signal.label} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{signal.label}</div>
            <div className="mt-1 text-sm font-medium text-foreground">{signal.value > 0 ? "+" : ""}{signal.value}</div>
          </div>
        ))}
      </div>
      <div className={recommendation.caution.includes("Low structural risk") ? "mt-4 rounded-2xl border border-border/60 bg-muted/15 p-3 text-xs leading-5 text-muted-foreground" : "mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900"}>
        {recommendation.caution}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Alternate path</div>
        <div className="flex items-center gap-2">
          <Button variant={isSelected ? "secondary" : "outline"} size="sm" onClick={onMarkTonight} disabled={isSaving} className="rounded-full px-4">
            {isSelected ? "Selected" : "Pick this"}
          </Button>
          <Button asChild variant="ghost" size="sm" className="rounded-full px-4">
            <Link href={`/cellar/${recommendation.inventory_id}`}>View bottle</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DecisionNote({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/72 p-4 text-sm text-muted-foreground">
      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="leading-6">{text}</p>
    </div>
  );
}

function SignalCard({
  icon,
  label,
  value,
  featured = false,
  tone = "calm",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  featured?: boolean;
  tone?: "calm" | "warning";
}) {
  const toneClass = tone === "warning"
    ? "border-amber-500/25 bg-amber-500/10 text-amber-950"
    : featured
      ? "border-border/60 bg-background shadow-sm"
      : "border-border/60 bg-muted/20";

  return (
    <div className={`rounded-3xl border p-4 ${featured ? "sm:p-5" : ""} ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <span className={tone === "warning" ? "text-amber-700" : "text-primary"}>{icon}</span>
        {label}
      </div>
      <p className={tone === "warning" ? "text-sm leading-6 text-amber-900" : "text-sm leading-6 text-muted-foreground"}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const width = Math.min(100, Math.max(8, Math.abs(value) * 5));
  const isPositive = value >= 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className={isPositive ? "text-primary" : "text-amber-700"}>{isPositive ? "+" : ""}{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={isPositive ? "h-full rounded-full bg-primary/70" : "h-full rounded-full bg-amber-500/70"} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function WhyRow({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border/50 bg-muted/15 p-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-1 leading-6">{text}</div>
      </div>
    </div>
  );
}

function getScoreSignals(recommendation: TonightRecommendation) {
  return [
    { label: "Readiness", value: recommendation.score_breakdown.readiness },
    { label: "Meal", value: recommendation.score_breakdown.meal_fit },
    { label: "Occasion", value: recommendation.score_breakdown.occasion_fit },
    { label: "Taste", value: recommendation.score_breakdown.taste_fit },
    { label: "Confidence", value: recommendation.score_breakdown.confidence },
    { label: "Adventure", value: recommendation.score_breakdown.adventure_fit },
    { label: "Cellar", value: recommendation.score_breakdown.cellar_practicality },
    { label: "Value", value: recommendation.score_breakdown.value_fit },
  ];
}

function formatWineType(value: TonightRecommendation["wine_type"]) {
  if (value === "unknown") return "Unknown style";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
