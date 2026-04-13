"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Wine, MapPin, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { getLocationDisplayString } from "@/lib/hooks/use-cellar-locations";
import { cn } from "@/lib/utils";
import type { CellarInventory, WineReference, Rating, CellarLocation, LocationMode } from "@/types/database";

interface WineCardProps {
  wine: CellarInventory & {
    wine_reference: WineReference | null;
    ratings: Rating[];
    location?: CellarLocation | null;
    simple_location?: string | null;
  };
  locationMode?: LocationMode;
  onQuantityChange?: (id: string, delta: number) => void;
  compact?: boolean;
}

export function WineCard({ wine, locationMode = "simple", onQuantityChange, compact = false }: WineCardProps) {
  const name = wine.wine_reference?.name || wine.custom_name || "Unknown Wine";
  const producer = wine.wine_reference?.producer || wine.custom_producer || "";
  const vintage = wine.vintage || wine.custom_vintage;
  const region = wine.wine_reference?.region || wine.custom_region;
  const wineType = wine.wine_reference?.wine_type;
  const locationDisplay = getLocationDisplayString(
    { simple_location: wine.simple_location, location: wine.location },
    locationMode
  );

  // User's ratings
  const ratings = wine.ratings || [];
  const avgRating = ratings.length > 0
    ? Math.round(ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length)
    : null;

  // Critic scores from wine reference (e.g., Vivino)
  const criticScores = wine.wine_reference?.critic_scores as { vivino?: number; ratingsCount?: number } | null;
  const displayRating = avgRating || criticScores?.vivino;
  const isUserRating = !!avgRating;

  // Wine type colors for left border
  const getTypeBorderColor = (type: string | null | undefined) => {
    switch (type) {
      case "red": return "border-l-red-500";
      case "white": return "border-l-amber-400";
      case "rose": return "border-l-pink-400";
      case "sparkling": return "border-l-yellow-400";
      default: return "border-l-gray-300";
    }
  };

  const getTypeIconBg = (type: string | null | undefined) => {
    switch (type) {
      case "red": return "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400";
      case "white": return "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
      case "rose": return "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400";
      case "sparkling": return "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400";
      default: return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getRatingColor = (score: number) => {
    if (score >= 95) return "bg-purple-500 text-white";
    if (score >= 90) return "bg-emerald-500 text-white";
    if (score >= 85) return "bg-blue-500 text-white";
    if (score >= 80) return "bg-amber-500 text-white";
    return "bg-gray-400 text-white";
  };

  // Drinking window calculation
  const getDrinkingWindow = () => {
    if (!wine.drink_after && !wine.drink_before) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const drinkAfterYear = wine.drink_after ? parseInt(wine.drink_after) : currentYear;
    const drinkBeforeYear = wine.drink_before ? parseInt(wine.drink_before) : currentYear + 20;

    // Calculate progress through drinking window
    const windowStart = drinkAfterYear;
    const windowEnd = drinkBeforeYear;
    const windowLength = windowEnd - windowStart;
    const yearsIntoWindow = currentYear - windowStart;
    const progress = windowLength > 0 ? Math.min(100, Math.max(0, (yearsIntoWindow / windowLength) * 100)) : 50;

    let status: "early" | "ready" | "late";
    let label: string;

    if (currentYear < drinkAfterYear) {
      status = "early";
      label = `Ready ${drinkAfterYear}`;
    } else if (currentYear > drinkBeforeYear) {
      status = "late";
      label = "Past peak";
    } else {
      status = "ready";
      label = `${drinkAfterYear}-${drinkBeforeYear}`;
    }

    return { progress, status, label, windowStart, windowEnd };
  };

  const drinkingWindow = getDrinkingWindow();
  const hasNotes = ratings.length > 0;
  const hasValue = wine.current_market_value_cents != null || wine.purchase_price_cents != null;
  const whatMattersNow = drinkingWindow?.status === "ready"
    ? "In drinking window now."
    : drinkingWindow?.status === "late"
      ? "Past peak, decide soon."
      : hasNotes
        ? "Memory exists, but timing still matters."
        : "Still missing first memory.";
  const nextMove = !hasNotes
    ? "Add first tasting"
    : !hasValue
      ? "Add value signal"
      : drinkingWindow?.status === "ready"
        ? "Consider for tonight"
        : "Review bottle";
  const riskLabel = !hasNotes
    ? "Without a note, this stays anonymous in the rack."
    : !locationDisplay
      ? "Without location clarity, it becomes friction when needed."
      : drinkingWindow?.status === "late"
        ? "Waiting longer may cost the best drinking moment."
        : "Low immediate risk, but still needs an intentional decision.";

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-lg border-l-4 group",
      getTypeBorderColor(wineType)
    )}>
      <CardContent className="p-0">
        {/* Main Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Wine Type Icon */}
            <div className={cn(
              "shrink-0 h-10 w-10 rounded-full flex items-center justify-center",
              getTypeIconBg(wineType)
            )}>
              <Wine className="h-5 w-5" />
            </div>

            {/* Wine Info */}
            <div className="flex-1 min-w-0">
              <Link href={`/cellar/${wine.id}`} className="block group/link">
                <h3 className="font-semibold leading-tight group-hover/link:text-primary transition-colors">
                  {vintage && <span className="text-muted-foreground font-normal">{vintage} </span>}
                  <span className="line-clamp-1">{name}</span>
                </h3>
              </Link>
              {producer && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {producer}
                </p>
              )}
              {region && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {region}
                </p>
              )}
            </div>

            {/* Rating Badge */}
            {displayRating && (
              <div className="shrink-0">
                <div className={cn(
                  "h-12 w-12 rounded-lg flex flex-col items-center justify-center",
                  getRatingColor(displayRating)
                )}>
                  <span className="text-lg font-bold leading-none">{displayRating}</span>
                  <span className="text-[10px] opacity-80 leading-none mt-0.5">
                    {isUserRating ? "You" : "Critic"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 grid gap-2 rounded-xl border bg-muted/20 p-3 text-xs">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <div className="font-medium text-foreground">What matters now</div>
                <div className="text-muted-foreground">{whatMattersNow}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <div className="font-medium text-foreground">Best next move</div>
                <div className="text-muted-foreground">{nextMove}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-primary" />
              <div>
                <div className="font-medium text-foreground">Risk if ignored</div>
                <div className="text-muted-foreground">{riskLabel}</div>
              </div>
            </div>
          </div>

          {/* Drinking Window Progress */}
          {drinkingWindow && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={cn(
                  "font-medium",
                  drinkingWindow.status === "ready" && "text-emerald-600 dark:text-emerald-400",
                  drinkingWindow.status === "early" && "text-blue-600 dark:text-blue-400",
                  drinkingWindow.status === "late" && "text-orange-600 dark:text-orange-400"
                )}>
                  {drinkingWindow.status === "ready" ? "In drinking window" :
                   drinkingWindow.status === "early" ? "Aging" : "Past peak"}
                </span>
                <span className="text-muted-foreground">{drinkingWindow.label}</span>
              </div>
              <Progress
                value={drinkingWindow.progress}
                className={cn(
                  "h-1.5",
                  drinkingWindow.status === "ready" && "[&>div]:bg-emerald-500",
                  drinkingWindow.status === "early" && "[&>div]:bg-blue-500",
                  drinkingWindow.status === "late" && "[&>div]:bg-orange-500"
                )}
              />
            </div>
          )}

          {/* Location Badge */}
          {locationDisplay && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs font-normal">
                📍 {locationDisplay}
              </Badge>
            </div>
          )}
        </div>

        {/* Quantity Controls Footer */}
        {onQuantityChange && (
          <div className="px-4 py-2 bg-muted/30 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {wine.quantity} {wine.quantity === 1 ? "bottle" : "bottles"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-background"
                onClick={() => onQuantityChange(wine.id, -1)}
                disabled={wine.quantity <= 0}
              >
                -
              </Button>
              <span className="w-6 text-center text-sm font-medium tabular-nums">
                {wine.quantity}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-background"
                onClick={() => onQuantityChange(wine.id, 1)}
              >
                +
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
