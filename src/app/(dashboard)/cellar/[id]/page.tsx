"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useConsumeWine, useRestoreWine, useCellar } from "@/lib/hooks/use-cellar";
import { getBrianFitForRatings, useBrianTasteProfile, type RatingWithSignals } from "@/lib/hooks/use-brian-fit";
import { useAddRating, useRecentCompanions } from "@/lib/hooks/use-ratings";
import { getLocationDisplayString } from "@/lib/hooks/use-cellar-locations";
import { buildBottleIntelligence, type BottleIntelligence } from "@/lib/bottle-intelligence";
import { useUpdateLowStockSettings } from "@/lib/hooks/use-low-stock-alerts";
import { LocationSelector } from "@/components/cellar/location-selector";
import { EnhancedTastingForm, EnhancedTastingData } from "@/components/tasting";
import { MarketValueEditor, PricePerGlass } from "@/components/financial";
import { PhotoGallery } from "@/components/photos";
import { QRCodeGenerator } from "@/components/wine/qr-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowRight, AlertTriangle, Clock3, Sparkles, Wine as WineIcon, Camera, BadgeDollarSign, BookHeart, Wrench, Link as LinkIcon, Mic, Gauge, ShieldCheck, MapPin, Star, GlassWater, MoonStar } from "lucide-react";
import type { CellarInventory, WineReference, LocationMode, CellarLocation, AromaNotes, MarketValueSource } from "@/types/database";
import {
  getTonightSelectionStatus,
  parseTonightSelection,
  TONIGHT_SELECTION_STORAGE_KEY,
  type TonightSelection,
} from "@/lib/tonight-selection";

type WineWithDetails = CellarInventory & {
  wine_reference: WineReference | null;
  ratings: RatingWithSignals[];
  location?: CellarLocation | null;
  simple_location?: string | null;
  low_stock_threshold?: number | null;
  low_stock_alert_enabled?: boolean;
  // Financial fields
  current_market_value_cents?: number | null;
  market_value_source?: MarketValueSource | null;
  market_value_updated_at?: string | null;
  is_opened?: boolean;
  opened_date?: string | null;
  glasses_poured?: number;
  glasses_per_bottle?: number;
};

function getInitialTonightSelection(inventoryId: string) {
  if (typeof window === "undefined") return null;
  const storedSelection = parseTonightSelection(window.localStorage.getItem(TONIGHT_SELECTION_STORAGE_KEY));
  if (!storedSelection) return null;
  const status = getTonightSelectionStatus(storedSelection, inventoryId);
  if (!status.isActive) {
    window.localStorage.removeItem(TONIGHT_SELECTION_STORAGE_KEY);
    return null;
  }
  return storedSelection;
}

export default function WineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [showConsumeDialog, setShowConsumeDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [editLocation, setEditLocation] = useState<string | null>(null);
  const [editLocationId, setEditLocationId] = useState<string | null>(null);

  const { data: cellar } = useCellar();
  const { data: brianTasteProfile } = useBrianTasteProfile();
  const consumeWine = useConsumeWine();
  const restoreWine = useRestoreWine();
  const addRating = useAddRating();
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreQuantity, setRestoreQuantity] = useState(1);
  const [tonightSelection] = useState<TonightSelection | null>(() => getInitialTonightSelection(id));
  const updateLowStockSettings = useUpdateLowStockSettings();
  const { data: recentCompanions = [] } = useRecentCompanions();
  const locationMode: LocationMode = (cellar?.location_mode as LocationMode) || "simple";

  // Low stock alert state
  const [lowStockEnabled, setLowStockEnabled] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(1);

  const { data: wine, isLoading, refetch: refetchWine } = useQuery({
    queryKey: ["wine-detail", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*),
          ratings (
            *,
            rating_signals (*)
          ),
          location:cellar_locations (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as WineWithDetails;
    },
  });

  const handleConsume = async () => {
    try {
      await consumeWine.mutateAsync(id);
      toast.success("Wine marked as consumed!");
      setShowConsumeDialog(false);
      router.push("/cellar");
    } catch {
      toast.error("Failed to mark wine as consumed");
    }
  };

  const handleRestore = async () => {
    try {
      await restoreWine.mutateAsync({ id, quantity: restoreQuantity });
      toast.success("Wine restored to cellar!");
      setShowRestoreDialog(false);
      refetchWine();
    } catch {
      toast.error("Failed to restore wine");
    }
  };

  const isConsumed = wine?.status === "consumed";

  const handleAddRating = async (data: EnhancedTastingData) => {
    try {
      await addRating.mutateAsync({
        inventory_id: id,
        wine_reference_id: wine?.wine_reference_id || null,
        score: data.score,
        tasting_notes: data.tasting_notes,
        appearance_notes: data.appearance_notes,
        nose_notes: data.nose_notes,
        palate_notes: data.palate_notes,
        aroma_notes: data.aroma_notes as AromaNotes,
        body: data.characteristics.body,
        tannins: data.characteristics.tannins,
        acidity: data.characteristics.acidity,
        sweetness: data.characteristics.sweetness,
        finish: data.characteristics.finish,
        intensity: data.characteristics.intensity,
        quality_level: data.characteristics.quality_level,
        occasion_tags: data.occasion_tags.length > 0 ? data.occasion_tags : null,
        venue: data.venue,
        companions: data.companions.length > 0 ? data.companions : null,
        food_pairings: data.food_pairings,
      });
      toast.success("Tasting notes saved!");
      setShowRatingSheet(false);
    } catch {
      toast.error("Failed to save tasting notes");
    }
  };

  const handleSaveLocation = async () => {
    try {
      const updateData: Record<string, unknown> = {};
      if (locationMode === "simple") {
        updateData.simple_location = editLocation;
      } else {
        updateData.location_id = editLocationId;
      }

      const { error } = await supabase
        .from("cellar_inventory")
        .update(updateData as never)
        .eq("id", id);

      if (error) throw error;
      toast.success("Location updated!");
      setShowLocationDialog(false);
      refetchWine();
    } catch {
      toast.error("Failed to update location");
    }
  };

  const openLocationDialog = () => {
    // Initialize with current values
    setEditLocation((wine?.simple_location as string) || null);
    setEditLocationId(wine?.location_id || null);
    setShowLocationDialog(true);
  };

  // Sync low stock settings from wine data
  useEffect(() => {
    if (wine) {
      setLowStockEnabled(wine.low_stock_alert_enabled ?? false);
      setLowStockThreshold(wine.low_stock_threshold ?? 1);
    }
  }, [wine]);

  const handleSaveLowStockSettings = async () => {
    try {
      await updateLowStockSettings.mutateAsync({
        inventoryId: id,
        threshold: lowStockEnabled ? lowStockThreshold : null,
        alertEnabled: lowStockEnabled,
      });
      toast.success("Low stock alert settings updated!");
      refetchWine();
    } catch {
      toast.error("Failed to update low stock settings");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-4xl animate-pulse">🍷</div>
          <p className="mt-2 text-muted-foreground">Loading wine details...</p>
        </div>
      </div>
    );
  }

  if (!wine) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Wine not found</p>
        <Link href="/cellar">
          <Button variant="outline" className="mt-4">
            Back to Cellar
          </Button>
        </Link>
      </div>
    );
  }

  const wineRef = wine.wine_reference;
  const name = wineRef?.name || wine.custom_name || "Unknown Wine";
  const producer = wineRef?.producer || wine.custom_producer;
  const region = wineRef?.region || wine.custom_region;
  const country = wineRef?.country;
  const vintage = wine.vintage || wine.custom_vintage;
  const wineType = wineRef?.wine_type || wine.custom_wine_type;
  const avgRating = wine.ratings.length > 0
    ? Math.round(wine.ratings.reduce((sum, r) => sum + r.score, 0) / wine.ratings.length)
    : null;
  const locationDisplay = getLocationDisplayString(
    { simple_location: wine.simple_location, location: wine.location },
    locationMode
  );
  const hasValue = wine.current_market_value_cents != null || wine.purchase_price_cents != null;
  const hasDrinkWindow = !!wine.drink_after || !!wine.drink_before;
  const hasNotes = wine.ratings.length > 0;
  const likelyPremium = (wine.current_market_value_cents ?? wine.purchase_price_cents ?? 0) >= 10000;
  const recommendation = wine.is_opened
    ? {
        label: "Finish soon",
        tone: "amber",
        reason: "This bottle is already opened, so the highest-leverage move is to enjoy it while it is still showing well.",
      }
    : !hasNotes
      ? {
          label: "Add first tasting",
          tone: "violet",
          reason: "You own this bottle, but you have not captured what you think of it yet.",
        }
      : !hasValue && likelyPremium
        ? {
            label: "Add value estimate",
            tone: "blue",
            reason: "This looks like a meaningful bottle, and the portfolio layer gets stronger once value is known.",
          }
        : !hasDrinkWindow
          ? {
              label: "Revisit readiness",
              tone: "slate",
              reason: "There is not enough aging guidance yet, so this bottle needs a readiness decision rather than blind waiting.",
            }
          : {
              label: "Hold and watch",
              tone: "green",
              reason: "This bottle has enough context to keep, monitor, and open with intention.",
            };
  const heroKicker = wineRef ? "Reference-backed bottle" : "Custom cellar bottle";
  const whatMattersNow = wine.is_opened
    ? `This bottle is already opened${wine.glasses_poured ? ` and ${wine.glasses_poured} glass${wine.glasses_poured === 1 ? '' : 'es'} have been poured` : ''}.`
    : !hasNotes
      ? "You have not logged a tasting yet, so this bottle has value but very little memory."
      : hasValue
        ? `You have ${wine.quantity} bottle${wine.quantity === 1 ? '' : 's'} on hand with a tracked value signal.`
        : `You have ${wine.quantity} bottle${wine.quantity === 1 ? '' : 's'} on hand, but the value picture is still incomplete.`;
  const bestNextMove = recommendation.label === "Add first tasting"
    ? "Taste this bottle and capture what you actually think, so Pourfolio can start learning from it."
    : recommendation.label === "Add value estimate"
      ? "Add a market value estimate so this bottle contributes honestly to portfolio intelligence."
      : recommendation.label === "Finish soon"
        ? "Plan the next pour and finish this opened bottle while the experience is still fresh."
        : recommendation.label === "Revisit readiness"
          ? "Set a drinking-window judgment or note whether this is a drink-now or hold bottle."
          : "Keep this bottle in rotation and revisit it intentionally rather than letting it disappear into the rack.";
  const riskIfIgnored = !hasNotes
    ? "Without a tasting memory, this becomes another bottle you vaguely remember owning instead of truly understanding."
    : !hasValue && likelyPremium
      ? "Without a value signal, the portfolio layer understates what matters and what deserves attention."
      : !locationDisplay
        ? "Without a location, a good bottle becomes friction when you actually want it."
        : "If this bottle sits without a decision, it risks becoming passive inventory instead of an intentional experience.";
  const latestRating = wine.ratings.length > 0
    ? [...wine.ratings].sort((a, b) => new Date(b.tasting_date).getTime() - new Date(a.tasting_date).getTime())[0]
    : null;
  const brianFit = getBrianFitForRatings({
    profile: brianTasteProfile,
    ratings: wine.ratings,
    fallbackScore: avgRating,
  });
  const bottleIntelligence = buildBottleIntelligence({
    id: wine.id,
    name,
    producer,
    vintage,
    region,
    country,
    wineType,
    grapeVarieties: wineRef?.grape_varieties ?? null,
    alcoholPercentage: wineRef?.alcohol_percentage ?? null,
    quantity: wine.quantity,
    bottleSizeMl: wine.bottle_size_ml,
    drinkAfter: wine.drink_after,
    drinkBefore: wine.drink_before,
    purchasePriceCents: wine.purchase_price_cents,
    currentMarketValueCents: wine.current_market_value_cents,
    marketValueSource: wine.market_value_source,
    simpleLocation: locationDisplay || wine.simple_location,
    brianFit,
    isOpened: wine.is_opened,
    criticScores: wineRef?.critic_scores,
    ratings: wine.ratings.map((rating) => ({
      score: rating.score,
      tastingDate: rating.tasting_date,
      tastingNotes: rating.tasting_notes,
      noseNotes: rating.nose_notes,
      palateNotes: rating.palate_notes,
      body: rating.body,
      tannins: rating.tannins,
      acidity: rating.acidity,
      sweetness: rating.sweetness,
      finish: rating.finish,
    })),
  });
  const tonightSelectionStatus = getTonightSelectionStatus(tonightSelection, id);
  const tonightEngineSelected = tonightSelectionStatus.isActiveForBottle;
  const latestMemory = latestRating?.tasting_notes || latestRating?.nose_notes || latestRating?.palate_notes || null;
  const memoryHeadline = latestRating
    ? `${latestRating.score}/100` 
    : "No tasting memory yet";
  const memorySubhead = latestRating
    ? latestMemory || "You have a tasting on file, but the emotional memory is still thin."
    : "The first tasting note is where this bottle stops being inventory and starts becoming part of your wine life.";
  const valueSourceLabel = wine.market_value_source
    ? wine.market_value_source === 'manual'
      ? 'Manual value'
      : wine.market_value_source === 'estimate'
        ? 'Estimated value'
        : wine.market_value_source === 'vivino'
          ? 'Vivino value'
          : 'Wine-Searcher value'
    : null;
  const purchaseValue = wine.purchase_price_cents;
  const marketValue = wine.current_market_value_cents;
  const valueConfidence = marketValue != null
    ? (wine.market_value_source === 'manual' || wine.market_value_source === 'estimate' ? 'Tracked with moderate confidence' : 'Tracked with source confidence')
    : purchaseValue != null
      ? 'Only purchase price is known'
      : 'Value is still unknown';
  const gainLoss = purchaseValue != null && marketValue != null ? marketValue - purchaseValue : null;
  const vintageLooksInvalid = vintage != null && (vintage < 1000 || vintage > new Date().getFullYear() + 1);
  const improvementPrompts = [
    !wineRef && {
      title: 'Link to wine reference',
      body: 'This bottle is running as a custom record. That is acceptable, but linking it later will strengthen discovery and intelligence.',
      priority: 'medium',
    },
    !hasNotes && {
      title: 'Capture first tasting memory',
      body: 'Without a tasting note, this bottle cannot teach Pourfolio anything about your palate.',
      priority: 'high',
    },
    !hasValue && {
      title: 'Add a value signal',
      body: 'Purchase or market value is still missing, so portfolio truth is incomplete.',
      priority: likelyPremium ? 'high' : 'medium',
    },
    !locationDisplay && {
      title: 'Set storage location',
      body: 'A bottle that cannot be found quickly becomes friction when the moment is right.',
      priority: 'medium',
    },
    !hasDrinkWindow && {
      title: 'Decide readiness window',
      body: 'No drink-after or drink-before guidance exists yet, so future recommendations are weaker.',
      priority: 'medium',
    },
    vintageLooksInvalid && {
      title: 'Fix vintage data',
      body: `The current vintage reads as ${vintage}, which looks malformed and will distort cellar intelligence.`,
      priority: 'high',
    },
  ].filter(Boolean) as { title: string; body: string; priority: 'high' | 'medium' }[];

  const getScoreColor = (score: number) => {
    if (score >= 95) return "bg-purple-600";
    if (score >= 90) return "bg-green-600";
    if (score >= 85) return "bg-blue-600";
    if (score >= 80) return "bg-yellow-600";
    return "bg-gray-600";
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "red": return "bg-red-100 text-red-800";
      case "white": return "bg-yellow-100 text-yellow-800";
      case "rose": return "bg-pink-100 text-pink-800";
      case "sparkling": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Consumed Banner */}
      {isConsumed && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍷</span>
            <div>
              <p className="font-medium text-amber-900">Wine Consumed</p>
              <p className="text-sm text-amber-700">
                {wine.consumed_date && `on ${formatDate(wine.consumed_date)}`}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRestoreQuantity(1);
              setShowRestoreDialog(true);
            }}
          >
            Restore to Cellar
          </Button>
        </div>
      )}

      {/* Bottle Brain Hero */}
      <div className="rounded-3xl border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div>
              <Link
                href={isConsumed ? "/cellar/history" : "/cellar"}
                className="text-sm text-muted-foreground hover:text-foreground mb-3 inline-block"
              >
                &larr; {isConsumed ? "Back to History" : "Back to Cellar"}
              </Link>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="outline">{heroKicker}</Badge>
                {wineType && (
                  <Badge variant="secondary" className={getTypeColor(wineType)}>
                    {wineType.charAt(0).toUpperCase() + wineType.slice(1)}
                  </Badge>
                )}
                <Badge variant="secondary">
                  {wine.quantity} bottle{wine.quantity !== 1 ? "s" : ""}
                </Badge>
                {locationDisplay && <Badge variant="outline">📍 {locationDisplay}</Badge>}
              </div>
              <h1 className="font-playfair text-3xl font-bold tracking-tight sm:text-4xl">
                {vintage && `${vintage} `}{name}
              </h1>
              {producer && (
                <p className="mt-2 text-lg text-muted-foreground">{producer}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                {region && <span>{region}</span>}
                {region && country && <span>•</span>}
                {country && <span>{country}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[240px]">
            {avgRating && (
              <div className={cn("rounded-2xl px-5 py-4 text-white shadow-sm", getScoreColor(avgRating))}>
                <p className="text-xs uppercase tracking-[0.2em] text-white/80">Average rating</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold leading-none">{avgRating}</span>
                  <span className="pb-1 text-sm text-white/80">/100</span>
                </div>
              </div>
            )}
            {brianFit && (
              <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-4 text-primary shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Brian-Fit</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold leading-none">{brianFit.score}</span>
                  <span className="pb-1 text-sm text-primary/80">/100</span>
                </div>
                <p className="mt-2 text-xs text-primary/80">{brianFit.confidence}% confidence</p>
                <p className="mt-3 text-sm leading-6 text-foreground">{brianFit.reason}</p>
              </div>
            )}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-background/80 p-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bottle Brain says</p>
                    <p className="mt-2 font-medium text-foreground">{recommendation.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {tonightEngineSelected && tonightSelection && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-xl bg-background/80 p-2">
              <MoonStar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tonight Engine</p>
              <p className="mt-2 font-medium text-foreground">Selected for tonight at {tonightSelection.confidence}% confidence.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Context: {tonightSelection.context.meal || "anything"}, {tonightSelection.context.occasion || "occasion open"}, {tonightSelection.context.mood || "mood open"}. This marker expires this evening instead of pretending to be a permanent note.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operator brief */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <WineIcon className="h-4 w-4" />
            What matters now
          </div>
          <p className="mt-3 text-sm text-foreground">{whatMattersNow}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ArrowRight className="h-4 w-4" />
            Best next move
          </div>
          <p className="mt-3 text-sm text-foreground">{bestNextMove}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Risk if ignored
          </div>
          <p className="mt-3 text-sm text-foreground">{riskIfIgnored}</p>
        </Card>
      </div>

      <BottleIntelligencePanel intelligence={bottleIntelligence} formatPrice={formatPrice} />

      {/* Readiness rail */}
      <Card className="border-muted/80 bg-muted/30">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Readiness
            </div>
            <p className="text-lg font-semibold text-foreground">{recommendation.label}</p>
            <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
        <Sheet open={showRatingSheet} onOpenChange={setShowRatingSheet}>
          <SheetTrigger asChild>
            <Button>{hasNotes ? 'Add another tasting' : 'Add first tasting'}</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Tasting Notes</SheetTitle>
              <SheetDescription>
                {vintage && `${vintage} `}{name}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <EnhancedTastingForm
                wineType={wineType}
                recentCompanions={recentCompanions}
                onSubmit={handleAddRating}
                onCancel={() => setShowRatingSheet(false)}
                isSubmitting={addRating.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>

        <Link href={`/jarvis/voice?inventoryId=${encodeURIComponent(id)}`}>
          <Button variant="outline">
            <Mic className="h-4 w-4" />
            Capture voice tasting
          </Button>
        </Link>

        <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={openLocationDialog}>Update location</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Storage Location</DialogTitle>
              <DialogDescription>
                Where is this wine stored in your cellar?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {cellar && (
                <LocationSelector
                  cellarId={cellar.id}
                  mode={locationMode}
                  value={editLocation}
                  locationId={editLocationId}
                  onChange={setEditLocation}
                  onLocationIdChange={setEditLocationId}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveLocation}>
                Save Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!isConsumed && (
          <Dialog open={showConsumeDialog} onOpenChange={setShowConsumeDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">Mark Consumed</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark as Consumed?</DialogTitle>
                <DialogDescription>
                  This will remove the wine from your active cellar inventory.
                  You can still view it in your drinking history.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConsumeDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConsume} disabled={consumeWine.isPending}>
                  {consumeWine.isPending ? "Updating..." : "Confirm"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Restore Dialog */}
        <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore Wine to Cellar</DialogTitle>
              <DialogDescription>
                This will move the wine back to your active cellar inventory.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium">Quantity to restore</label>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestoreQuantity(Math.max(1, restoreQuantity - 1))}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={restoreQuantity}
                  onChange={(e) => setRestoreQuantity(parseInt(e.target.value) || 1)}
                  className="text-center w-20"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestoreQuantity(restoreQuantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRestore} disabled={restoreWine.isPending}>
                {restoreWine.isPending ? "Restoring..." : "Restore to Cellar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Storage Location Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Storage Location</CardTitle>
        </CardHeader>
        <CardContent>
          {locationDisplay ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">📍</span>
              <span className="font-medium">{locationDisplay}</span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No location set yet. Use the action rail above to place this bottle.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {wine.purchase_date && (
              <div>
                <p className="text-sm text-muted-foreground">Purchased</p>
                <p className="font-medium">{formatDate(wine.purchase_date)}</p>
              </div>
            )}
            {wine.purchase_price_cents && (
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="font-medium">{formatPrice(wine.purchase_price_cents)}</p>
              </div>
            )}
            {wine.purchase_location && (
              <div>
                <p className="text-sm text-muted-foreground">Where</p>
                <p className="font-medium">{wine.purchase_location}</p>
              </div>
            )}
            {wine.bottle_size_ml && wine.bottle_size_ml !== 750 && (
              <div>
                <p className="text-sm text-muted-foreground">Bottle Size</p>
                <p className="font-medium">{wine.bottle_size_ml}ml</p>
              </div>
            )}
          </div>
          {wine.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="mt-1">{wine.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory rail */}
      <Card className="border-primary/15 bg-gradient-to-br from-card to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookHeart className="h-4 w-4 text-primary" />
            Memory rail
          </CardTitle>
          <CardDescription>
            What this bottle means so far, not just what fields are filled in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current memory</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{memoryHeadline}</p>
            {latestRating && <p className="mt-1 text-xs text-muted-foreground">{formatDate(latestRating.tasting_date)}</p>}
            <p className="mt-2 text-sm text-muted-foreground">{memorySubhead}</p>
            {latestRating && ((latestRating.occasion_tags && latestRating.occasion_tags.length > 0) || (latestRating.companions && latestRating.companions.length > 0)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {latestRating.occasion_tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
                {latestRating.companions?.map((companion: string) => (
                  <Badge key={companion} variant="outline" className="text-xs">👤 {companion}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Value truth rail */}
      <Card className="border-muted/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BadgeDollarSign className="h-4 w-4 text-primary" />
            Value truth
          </CardTitle>
          <CardDescription>
            Honest portfolio context for this bottle, with confidence instead of fake precision.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchase value</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{purchaseValue != null ? formatPrice(purchaseValue) : 'Unknown'}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current value</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{marketValue != null ? formatPrice(marketValue) : 'Unknown'}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Confidence</p>
              <p className="mt-2 text-sm font-medium text-foreground">{valueConfidence}</p>
              {valueSourceLabel && <p className="mt-1 text-xs text-muted-foreground">{valueSourceLabel}</p>}
            </div>
          </div>
          {gainLoss != null && (
            <div className={cn('rounded-2xl p-4', gainLoss >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gain / loss</p>
              <p className={cn('mt-2 text-lg font-semibold', gainLoss >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                {gainLoss >= 0 ? '+' : ''}{formatPrice(gainLoss)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Gallery */}
      <Card className="border-muted/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Visual record
          </CardTitle>
          <CardDescription>
            Label, bottle, and tasting imagery that make this bottle feel real.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-6 pb-6">
            <PhotoGallery inventoryId={id} />
          </div>
        </CardContent>
      </Card>

      {/* Improve this bottle */}
      <Card className="border-muted/80 bg-gradient-to-br from-card to-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-primary" />
            Improve this bottle
          </CardTitle>
          <CardDescription>
            High-leverage upgrades that make this record smarter, easier to trust, and more useful later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {improvementPrompts.length === 0 ? (
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-medium text-foreground">This bottle is in strong shape.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                It has enough identity, memory, and value context to behave like a first-class Bottle Brain record.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {improvementPrompts.map((item) => (
                <div key={item.title} className="rounded-2xl border bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                    <Badge variant={item.priority === 'high' ? 'destructive' : 'secondary'}>
                      {item.priority === 'high' ? 'High priority' : 'Worth doing'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record posture */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-4 w-4 text-primary" />
            Record posture
          </CardTitle>
          <CardDescription>
            How this bottle is currently represented in Pourfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant={wineRef ? 'secondary' : 'outline'}>{wineRef ? 'Reference linked' : 'Custom-first record'}</Badge>
          <Badge variant={hasNotes ? 'secondary' : 'outline'}>{hasNotes ? 'Memory captured' : 'Memory thin'}</Badge>
          <Badge variant={hasValue ? 'secondary' : 'outline'}>{hasValue ? 'Value tracked' : 'Value missing'}</Badge>
          <Badge variant={locationDisplay ? 'secondary' : 'outline'}>{locationDisplay ? 'Location set' : 'Location missing'}</Badge>
        </CardContent>
      </Card>

      {/* Low Stock Alert Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Low Stock Alert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="low-stock-enabled">Enable alert</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when stock falls below threshold
              </p>
            </div>
            <Switch
              id="low-stock-enabled"
              checked={lowStockEnabled}
              onCheckedChange={setLowStockEnabled}
            />
          </div>

          {lowStockEnabled && (
            <div className="space-y-2">
              <Label htmlFor="threshold">Alert when bottles remaining is</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">or fewer</span>
              </div>
              {wine.quantity <= lowStockThreshold && (
                <p className="text-sm text-orange-600">
                  Current stock ({wine.quantity}) is at or below threshold
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleSaveLowStockSettings}
            disabled={updateLowStockSettings.isPending}
            size="sm"
          >
            {updateLowStockSettings.isPending ? "Saving..." : "Save Alert Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Financial Tracking */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Market Value Editor */}
        <MarketValueEditor
          inventoryId={id}
          currentValue={wine.current_market_value_cents ?? null}
          purchasePrice={wine.purchase_price_cents}
          source={wine.market_value_source ?? null}
          lastUpdated={wine.market_value_updated_at ?? null}
        />

        {/* Price Per Glass */}
        <PricePerGlass
          inventoryId={id}
          bottlePrice={wine.current_market_value_cents || wine.purchase_price_cents}
          bottleSizeMl={wine.bottle_size_ml || 750}
          isOpened={wine.is_opened ?? false}
          openedDate={wine.opened_date ?? null}
          glassesPoured={wine.glasses_poured ?? 0}
          glassesPerBottle={wine.glasses_per_bottle ?? 5}
        />
      </div>

      {/* Asset Tagging */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Tag</CardTitle>
          <CardDescription>Generated QR code for physical bottle tagging.</CardDescription>
        </CardHeader>
        <CardContent>
          <QRCodeGenerator id={id} name={name} producer={producer || ""} />
        </CardContent>
      </Card>

      {/* Ratings History */}
      <Card>
        <CardHeader>
          <CardTitle>Tasting History</CardTitle>
        </CardHeader>
        <CardContent>
          {wine.ratings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No tasting notes yet. Add your first tasting experience!
            </p>
          ) : (
            <div className="space-y-6">
              {wine.ratings
                .sort((a, b) => new Date(b.tasting_date).getTime() - new Date(a.tasting_date).getTime())
                .map((r) => (
                  <div key={r.id} className="pb-6 border-b last:border-0">
                    {/* Header with score and date */}
                    <div className="flex items-start gap-4 mb-3">
                      <div className={`px-3 py-1 rounded text-white text-lg font-bold ${getScoreColor(r.score)}`}>
                        {r.score}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {formatDate(r.tasting_date)}
                        </p>
                        {r.venue && (
                          <p className="text-sm">📍 {r.venue}</p>
                        )}
                      </div>
                    </div>

                    {/* Occasion and companions */}
                    {((r.occasion_tags && r.occasion_tags.length > 0) || (r.companions && r.companions.length > 0)) && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {r.occasion_tags?.map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {r.companions?.map((companion: string) => (
                          <Badge key={companion} variant="outline" className="text-xs">
                            👤 {companion}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Tasting notes */}
                    {r.tasting_notes && (
                      <p className="text-sm mb-3">{r.tasting_notes}</p>
                    )}

                    {/* Wine characteristics */}
                    {(r.body || r.tannins || r.acidity || r.sweetness || r.finish) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {r.body && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Body: {r.body}
                          </span>
                        )}
                        {r.tannins && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Tannins: {r.tannins}
                          </span>
                        )}
                        {r.acidity && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Acidity: {r.acidity}
                          </span>
                        )}
                        {r.sweetness && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Sweetness: {r.sweetness}
                          </span>
                        )}
                        {r.finish && (
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Finish: {r.finish}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Aromas */}
                    {r.aroma_notes && (
                      <div className="mb-3">
                        {((r.aroma_notes as AromaNotes).primary?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            <span className="text-xs text-muted-foreground">Aromas:</span>
                            {(r.aroma_notes as AromaNotes).primary?.map((aroma: string) => (
                              <Badge key={aroma} variant="outline" className="text-xs">
                                {aroma}
                              </Badge>
                            ))}
                            {(r.aroma_notes as AromaNotes).secondary?.map((aroma: string) => (
                              <Badge key={aroma} variant="outline" className="text-xs">
                                {aroma}
                              </Badge>
                            ))}
                            {(r.aroma_notes as AromaNotes).tertiary?.map((aroma: string) => (
                              <Badge key={aroma} variant="outline" className="text-xs">
                                {aroma}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quality level */}
                    {r.quality_level && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Quality:</span>{" "}
                        <span className="font-medium capitalize">{r.quality_level.replace("-", " ")}</span>
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BottleIntelligencePanel({
  intelligence,
  formatPrice,
}: {
  intelligence: BottleIntelligence;
  formatPrice: (cents: number) => string;
}) {
  const readinessTone = intelligence.readiness.state === "past_peak"
    ? "border-red-200 bg-red-50 text-red-900"
    : intelligence.readiness.state === "drink_soon"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : intelligence.readiness.state === "hold"
        ? "border-slate-200 bg-slate-50 text-slate-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const glassTone = intelligence.identity.visualType === "white"
    ? "from-amber-50 to-yellow-100 text-amber-700"
    : intelligence.identity.visualType === "sparkling"
      ? "from-yellow-50 to-stone-100 text-yellow-700"
      : intelligence.identity.visualType === "rose"
        ? "from-rose-50 to-pink-100 text-rose-700"
        : "from-red-950 to-red-700 text-red-50";

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardHeader className="border-b bg-background/60">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Bottle Intelligence
            </div>
            <CardTitle className="mt-2 text-2xl">{intelligence.identity.title}</CardTitle>
            <CardDescription className="mt-1">{intelligence.identity.subtitle}</CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              {intelligence.identity.meta.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
            </div>
          </div>
          <div className={cn("flex h-28 w-28 shrink-0 items-center justify-center rounded-[2rem] bg-gradient-to-br shadow-inner", glassTone)}>
            <GlassWater className="h-14 w-14" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className={cn("rounded-2xl border p-4", readinessTone)}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
              <Clock3 className="h-4 w-4" />
              Readiness
            </div>
            <p className="mt-2 text-xl font-semibold">{intelligence.readiness.label}</p>
            <p className="mt-1 text-sm opacity-80">{intelligence.readiness.windowLabel}</p>
            <p className="mt-2 text-xs opacity-70">{intelligence.readiness.confidence.replace("-", " ")} window</p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <BookHeart className="h-4 w-4" />
              Memory
            </div>
            <p className="mt-2 text-xl font-semibold text-foreground">{intelligence.memoryDensity.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {intelligence.memoryDensity.ratingCount} tasting{intelligence.memoryDensity.ratingCount === 1 ? "" : "s"}
              {intelligence.memoryDensity.averageScore ? ` • ${intelligence.memoryDensity.averageScore}/100 avg` : ""}
            </p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Bottle Brain role
            </div>
            <p className="mt-2 text-xl font-semibold text-foreground">{intelligence.bottleBrainRole.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{intelligence.bottleBrainRole.reason}</p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Location
            </div>
            <p className="mt-2 text-xl font-semibold text-foreground">{intelligence.location.status === "set" ? "Findable" : "Missing"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{intelligence.location.label}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Gauge className="h-4 w-4" />
                  Structure profile
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{intelligence.structure.summary}</p>
              </div>
              <Badge variant="outline" className="capitalize">{intelligence.structure.profileSource.replace("_", " ")}</Badge>
            </div>
            {intelligence.structure.traits.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {intelligence.structure.traits.map((trait) => (
                  <div key={trait.key} className="rounded-2xl bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{trait.label}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{trait.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">No structure profile yet. A tasting note or reference enrichment will unlock it.</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border bg-background p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <BadgeDollarSign className="h-4 w-4" />
                Value / review
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">{intelligence.value.label}</p>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>Market: {intelligence.value.marketValueCents != null ? formatPrice(intelligence.value.marketValueCents) : "Unknown"}</p>
                <p>Purchase: {intelligence.value.purchasePriceCents != null ? formatPrice(intelligence.value.purchasePriceCents) : "Unknown"}</p>
                {intelligence.value.gainLossCents != null && <p>Gain/loss: {intelligence.value.gainLossCents >= 0 ? "+" : ""}{formatPrice(intelligence.value.gainLossCents)}</p>}
                {intelligence.value.sourceLabel && <p>Source: {intelligence.value.sourceLabel}</p>}
              </div>
              {intelligence.criticScores.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {intelligence.criticScores.map((score) => <Badge key={score.label} variant="secondary"><Star className="mr-1 h-3 w-3" />{score.label}</Badge>)}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No critic score on file yet.</p>
              )}
            </div>

            <div className="rounded-3xl border bg-background p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Wrench className="h-4 w-4" />
                Next signals
              </div>
              <div className="mt-3 space-y-2">
                {intelligence.nextSignals.slice(0, 4).map((signal) => (
                  <div key={`${signal.kind}-${signal.label}`} className="rounded-2xl bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{signal.label}</p>
                      <Badge variant={signal.priority === "high" ? "destructive" : "secondary"} className="text-[10px] uppercase">{signal.priority}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{signal.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {intelligence.memoryDensity.latestMemory && (
          <div className="rounded-3xl border bg-background p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest personal memory</div>
            <p className="mt-2 text-sm leading-6 text-foreground">{intelligence.memoryDensity.latestMemory}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
