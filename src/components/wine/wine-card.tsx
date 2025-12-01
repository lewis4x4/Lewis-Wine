"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLocationDisplayString } from "@/lib/hooks/use-cellar-locations";
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
}

export function WineCard({ wine, locationMode = "simple", onQuantityChange }: WineCardProps) {
  const name = wine.wine_reference?.name || wine.custom_name || "Unknown Wine";
  const producer = wine.wine_reference?.producer || wine.custom_producer || "";
  const vintage = wine.vintage || wine.custom_vintage;
  const region = wine.wine_reference?.region;
  const wineType = wine.wine_reference?.wine_type;
  const locationDisplay = getLocationDisplayString(
    { simple_location: wine.simple_location, location: wine.location },
    locationMode
  );

  // User's ratings
  const ratings = wine.ratings || [];
  const latestRating = ratings[0];
  const avgRating = ratings.length > 0
    ? Math.round(ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length)
    : null;

  // Critic scores from wine reference (e.g., Vivino)
  const criticScores = wine.wine_reference?.critic_scores as { vivino?: number; ratingsCount?: number } | null;

  const getTypeColor = (type: string | null | undefined) => {
    switch (type) {
      case "red":
        return "bg-red-100 text-red-800";
      case "white":
        return "bg-yellow-100 text-yellow-800";
      case "rose":
        return "bg-pink-100 text-pink-800";
      case "sparkling":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDrinkingStatus = () => {
    if (!wine.drink_after && !wine.drink_before) return null;

    const now = new Date();
    const drinkAfter = wine.drink_after ? new Date(wine.drink_after) : null;
    const drinkBefore = wine.drink_before ? new Date(wine.drink_before) : null;

    if (drinkAfter && now < drinkAfter) {
      return { label: "Too Young", color: "bg-blue-100 text-blue-800" };
    }
    if (drinkBefore && now > drinkBefore) {
      return { label: "Past Peak", color: "bg-orange-100 text-orange-800" };
    }
    return { label: "Ready", color: "bg-green-100 text-green-800" };
  };

  const drinkingStatus = getDrinkingStatus();

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Link href={`/cellar/${wine.id}`} className="block">
              <h3 className="font-semibold truncate hover:text-primary">
                {vintage && `${vintage} `}
                {name}
              </h3>
              {producer && (
                <p className="text-sm text-muted-foreground truncate">
                  {producer}
                </p>
              )}
              {region && (
                <p className="text-xs text-muted-foreground">{region}</p>
              )}
            </Link>

            <div className="mt-2 flex flex-wrap gap-1">
              {wineType && (
                <Badge variant="secondary" className={getTypeColor(wineType)}>
                  {wineType}
                </Badge>
              )}
              {drinkingStatus && (
                <Badge variant="secondary" className={drinkingStatus.color}>
                  {drinkingStatus.label}
                </Badge>
              )}
              {locationDisplay && (
                <Badge variant="outline" className="text-xs">
                  <span className="mr-1">📍</span>
                  {locationDisplay}
                </Badge>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            {/* User's rating */}
            {avgRating && (
              <div className="mb-2">
                <span className="text-2xl font-bold text-primary">
                  {avgRating}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
                {ratings.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    ({ratings.length} tastings)
                  </p>
                )}
              </div>
            )}

            {/* Critic score (Vivino) - only show if no user rating */}
            {!avgRating && criticScores?.vivino && (
              <div className="mb-2">
                <span className="text-lg font-semibold text-purple-600">
                  {criticScores.vivino}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
                <p className="text-xs text-muted-foreground">Vivino</p>
              </div>
            )}

            {onQuantityChange && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onQuantityChange(wine.id, -1)}
                  disabled={wine.quantity <= 0}
                >
                  -
                </Button>
                <span className="w-8 text-center text-sm font-medium">
                  {wine.quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onQuantityChange(wine.id, 1)}
                >
                  +
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
