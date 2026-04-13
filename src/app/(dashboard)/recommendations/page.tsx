"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, GlassWater, UtensilsCrossed, MoonStar, ChevronRight, CheckCircle2 } from "lucide-react";
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
  const queryClient = useQueryClient();
  const supabase = createClient();

  const queryKey = useMemo(() => ["tonight-engine", context], [context]);

  const markTonightBottle = useMutation({
    mutationFn: async (recommendation: TonightRecommendation) => {
      const existingNote = `Tonight Engine pick · ${new Date().toISOString()} · ${context.meal || "anything"} · ${context.occasion || "weeknight"} · ${context.mood || "cozy"} · ${context.adventurous || "balanced"}`;
      const { error } = await supabase
        .from("cellar_inventory")
        .update({ notes: existingNote } as never)
        .eq("id", recommendation.inventory_id);

      if (error) throw error;
      return recommendation.inventory_id;
    },
    onSuccess: (inventoryId) => {
      setSelectedTonightId(inventoryId);
      toast.success("Tonight's bottle locked in.");
      queryClient.invalidateQueries({ queryKey: ["wine-detail", inventoryId] });
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
    },
    onError: () => {
      toast.error("Could not save tonight's bottle.");
    },
  });

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <TonightEngineHeader />
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing..." : "Re-score tonight"}
        </Button>
      </div>

      <TonightContextBar context={context} onChange={setContext} />

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <CardTitle className="font-playfair text-2xl">{data.headline}</CardTitle>
          <CardDescription className="text-base text-muted-foreground">{data.summary}</CardDescription>
        </CardHeader>
      </Card>

      {data.primary ? (
        <TonightPrimaryCard
          recommendation={data.primary}
          isSelected={selectedTonightId === data.primary.inventory_id}
          isSaving={markTonightBottle.isPending}
          onMarkTonight={() => {
            if (data.primary) markTonightBottle.mutate(data.primary);
          }}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Tonight Engine could not find a primary bottle yet.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Alternates</CardTitle>
            <CardDescription>Two credible backups with different tradeoffs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.alternates.length > 0 ? (
              data.alternates.map((recommendation) => (
                <TonightAlternateCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  isSelected={selectedTonightId === recommendation.inventory_id}
                  isSaving={markTonightBottle.isPending}
                  onMarkTonight={() => markTonightBottle.mutate(recommendation)}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No alternates yet. The cellar is thin, but the primary pick still stands.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why tonight’s picks work</CardTitle>
            <CardDescription>Fast operator framing, not sommelier theater.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <WhyRow label="Safe choice" text="Leans toward bottles with either proven taste signals or low-regret cellar fit." />
            <WhyRow label="Interesting choice" text="Rewards unknown or underused bottles when you ask for more adventure." />
            <WhyRow label="Special bottle" text="Elevates higher-value or scarcer bottles when the moment looks worth it." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TonightEngineHeader() {
  return (
    <div>
      <h1 className="font-playfair text-3xl font-bold">Tonight Engine</h1>
      <p className="text-muted-foreground">What should you open tonight, from the bottles you already own?</p>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MoonStar className="h-5 w-5 text-primary" /> Tonight’s context
        </CardTitle>
        <CardDescription>Give the engine just enough signal to make a smarter call.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select value={context.meal || "anything"} onValueChange={(meal) => onChange({ ...context, meal })}>
          <SelectTrigger>
            <SelectValue placeholder="Meal" />
          </SelectTrigger>
          <SelectContent>
            {mealOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={context.occasion || "weeknight"} onValueChange={(occasion) => onChange({ ...context, occasion })}>
          <SelectTrigger>
            <SelectValue placeholder="Occasion" />
          </SelectTrigger>
          <SelectContent>
            {occasionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={context.mood || "cozy"} onValueChange={(mood) => onChange({ ...context, mood })}>
          <SelectTrigger>
            <SelectValue placeholder="Mood" />
          </SelectTrigger>
          <SelectContent>
            {moodOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={context.adventurous || "balanced"} onValueChange={(adventurous) => onChange({ ...context, adventurous: adventurous as TonightContext["adventurous"] })}>
          <SelectTrigger>
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
  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-primary text-primary-foreground">Best bottle now</Badge>
          <Badge variant="outline">Confidence {recommendation.confidence}%</Badge>
          <Badge variant="outline">{formatWineType(recommendation.wine_type)}</Badge>
        </div>
        <CardTitle className="font-playfair text-3xl">
          {recommendation.vintage_label !== "Vintage unknown" ? `${recommendation.vintage_label} ` : ""}
          {recommendation.name}
        </CardTitle>
        <CardDescription className="text-base">{recommendation.producer} • {recommendation.region}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <SignalCard icon={<UtensilsCrossed className="h-4 w-4" />} label="Why this fits" value={recommendation.reason} />
          <SignalCard icon={<Sparkles className="h-4 w-4" />} label="Best for" value={recommendation.best_for} />
          <SignalCard icon={<GlassWater className="h-4 w-4" />} label="Watch out for" value={recommendation.caution} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{recommendation.quantity} bottle{recommendation.quantity === 1 ? "" : "s"} left</span>
          <span>•</span>
          <span>{recommendation.price_context}</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/cellar/${recommendation.inventory_id}`}>
              Open Bottle Brain <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant={isSelected ? "secondary" : "outline"} onClick={onMarkTonight} disabled={isSaving}>
            {isSelected ? <CheckCircle2 className="mr-2 h-4 w-4" /> : null}
            {isSaving ? "Saving..." : isSelected ? "Tonight’s bottle selected" : "Mark as tonight’s bottle"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TonightAlternateCard({
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
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">
            {recommendation.vintage_label !== "Vintage unknown" ? `${recommendation.vintage_label} ` : ""}
            {recommendation.name}
          </h3>
          <p className="text-sm text-muted-foreground">{recommendation.producer} • {recommendation.region}</p>
        </div>
        <Badge variant="outline">{recommendation.confidence}% fit</Badge>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{recommendation.reason}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{recommendation.caution}</div>
        <div className="flex items-center gap-2">
          <Button variant={isSelected ? "secondary" : "outline"} size="sm" onClick={onMarkTonight} disabled={isSaving}>
            {isSelected ? "Selected" : "Pick this"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/cellar/${recommendation.inventory_id}`}>View bottle</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function SignalCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function WhyRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="font-medium text-foreground">{label}</div>
      <div>{text}</div>
    </div>
  );
}

function formatWineType(value: TonightRecommendation["wine_type"]) {
  if (value === "unknown") return "Unknown style";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
