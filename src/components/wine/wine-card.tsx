"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin } from "lucide-react";
import { getLocationDisplayString } from "@/lib/hooks/use-cellar-locations";
import { cn } from "@/lib/utils";
import { getWineWindowDisplay } from "@/lib/wine-readiness";
import type { CellarInventory, WineReference, Rating, CellarLocation, LocationMode } from "@/types/database";
import type { BrianFitSummary } from "@/lib/brian-fit";

export type WineCardInventory = CellarInventory & {
  wine_reference: WineReference | null;
  ratings: Rating[];
  location?: CellarLocation | null;
  simple_location?: string | null;
};

interface WineCardProps {
  wine: WineCardInventory;
  locationMode?: LocationMode;
  brianFit?: BrianFitSummary | null;
  onQuantityChange?: (id: string, delta: number) => void;
}

export function WineCard({ wine, locationMode = "simple", brianFit, onQuantityChange }: WineCardProps) {
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

  const getRatingColor = (score: number) => {
    if (score >= 95) return "bg-purple-500 text-white";
    if (score >= 90) return "bg-emerald-500 text-white";
    if (score >= 85) return "bg-blue-500 text-white";
    if (score >= 80) return "bg-amber-500 text-white";
    return "bg-gray-400 text-white";
  };

  const drinkingWindow = getWineWindowDisplay(wine);
  const hasNotes = ratings.length > 0;
  const hasValue = wine.current_market_value_cents != null || wine.purchase_price_cents != null;
  const whatMattersNow = drinkingWindow?.status === "ready"
    ? "In drinking window now"
    : drinkingWindow?.status === "late"
      ? "Past peak, decide soon"
      : hasNotes
        ? "Memory exists, timing still matters"
        : "Still missing first memory";
  const nextMove = !hasNotes
    ? "Add first tasting note"
    : !hasValue
      ? "Add value signal"
      : drinkingWindow?.status === "ready"
        ? "Consider for tonight"
        : "Review bottle details";

  return (
    <Card className={cn(
      "group overflow-hidden rounded-[28px] border border-border/60 bg-background/96 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-30px_rgba(15,23,42,0.28)]",
      getTypeBorderColor(wineType)
    )}>
      <CardContent className="p-0">
        {/* Main Content */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              "mt-1 h-12 w-1.5 shrink-0 rounded-full",
              wineType === "red" ? "bg-red-500" : wineType === "white" ? "bg-amber-400" : wineType === "rose" ? "bg-pink-400" : wineType === "sparkling" ? "bg-yellow-400" : "bg-border"
            )} />

            <div className="min-w-0 flex-1">
              <Link href={`/cellar/${wine.id}`} className="block group/link">
                <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover/link:text-primary sm:text-xl">
                  <span className="line-clamp-2">{name}</span>
                </h3>
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {vintage && <span>{vintage}</span>}
                {producer && <span className="font-medium text-foreground/80">{producer}</span>}
                {region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {region}
                  </span>
                )}
              </div>
            </div>

            {/* Rating Badges */}
            {(displayRating || brianFit) && (
              <div className="flex shrink-0 flex-col gap-2">
                {displayRating && (
                  <div className={cn(
                    "flex h-14 min-w-[56px] flex-col items-center justify-center rounded-2xl px-3",
                    getRatingColor(displayRating)
                  )}>
                    <span className="text-xl font-bold leading-none">{displayRating}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.14em] opacity-80 leading-none">
                      {isUserRating ? "You" : "Critic"}
                    </span>
                  </div>
                )}
                {brianFit && (
                  <div className="flex h-14 min-w-[56px] flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 px-3 text-primary">
                    <span className="text-xl font-bold leading-none">{brianFit.score}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.14em] leading-none">
                      Brian-Fit
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-normal">
              {whatMattersNow}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
              {nextMove}
            </Badge>
          </div>
          {brianFit && (
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{brianFit.reason}</p>
          )}

          {/* Drinking Window Progress */}
          {drinkingWindow && (
            <div className="mt-4 border-t border-border/60 pt-4">
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {locationDisplay && (
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-normal">
                {locationDisplay}
              </Badge>
            )}
            {hasValue && (
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-normal">
                {wine.current_market_value_cents != null ? 'Market value tracked' : 'Purchase value tracked'}
              </Badge>
            )}
          </div>
        </div>

        {/* Quantity Controls Footer */}
        {onQuantityChange && (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {wine.quantity} {wine.quantity === 1 ? "bottle" : "bottles"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 hover:bg-background"
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
                className="h-11 w-11 p-0 hover:bg-background"
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
