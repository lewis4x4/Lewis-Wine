"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { WineRecommendation, RecommendationsResponse } from "@/app/api/recommendations/route";

async function fetchRecommendations(): Promise<RecommendationsResponse> {
  const response = await fetch("/api/recommendations");
  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }
  return response.json();
}

export default function RecommendationsPage() {
  const [selectedWine, setSelectedWine] = useState<WineRecommendation | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["recommendations"],
    queryFn: fetchRecommendations,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Wine Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions based on your taste profile
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-6xl animate-pulse">🍷</div>
          <p className="mt-4 text-lg font-medium">Analyzing your taste profile...</p>
          <p className="text-muted-foreground">
            Our sommelier AI is reviewing your ratings and cellar
          </p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Wine Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions based on your taste profile
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">😔</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">
              Unable to Generate Recommendations
            </h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              {data?.error || "Please rate some wines first so we can understand your preferences."}
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { recommendations, taste_summary } = data;

  if (recommendations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Wine Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions based on your taste profile
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">📝</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">
              Build Your Taste Profile
            </h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Rate some wines in your cellar and add items to your wishlist so our AI
              sommelier can learn your preferences and make personalized recommendations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Wine Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered suggestions based on your taste profile
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          disabled={isFetching}
        >
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Taste Summary */}
      {taste_summary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span>🎯</span> Your Taste Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">{taste_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Recommendations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((wine) => (
          <WineRecommendationCard
            key={wine.id}
            wine={wine}
            onClick={() => setSelectedWine(wine)}
          />
        ))}
      </div>

      {/* Selected Wine Details Modal/Drawer */}
      {selectedWine && (
        <WineDetailSheet
          wine={selectedWine}
          onClose={() => setSelectedWine(null)}
        />
      )}
    </div>
  );
}

function WineRecommendationCard({
  wine,
  onClick,
}: {
  wine: WineRecommendation;
  onClick: () => void;
}) {
  const typeColors: Record<string, string> = {
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    white: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    rose: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    sparkling: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dessert: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    fortified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge className={typeColors[wine.wine_type] || "bg-gray-100 text-gray-800"}>
            {wine.wine_type}
          </Badge>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Match:</span>
            <span className="font-semibold">{wine.confidence}%</span>
          </div>
        </div>
        <CardTitle className="text-lg mt-2 line-clamp-2">{wine.name}</CardTitle>
        <CardDescription className="line-clamp-1">{wine.producer}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>📍</span>
          <span>{wine.region}, {wine.country}</span>
        </div>

        {wine.grape_varieties.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {wine.grape_varieties.slice(0, 3).map((grape) => (
              <Badge key={grape} variant="outline" className="text-xs">
                {grape}
              </Badge>
            ))}
            {wine.grape_varieties.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{wine.grape_varieties.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">{wine.vintage_suggestion}</span>
          <span className="font-semibold text-primary">{wine.price_range}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function WineDetailSheet({
  wine,
  onClose,
}: {
  wine: WineRecommendation;
  onClose: () => void;
}) {
  const typeColors: Record<string, string> = {
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    white: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    rose: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    sparkling: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dessert: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    fortified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-background shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background">
          <h2 className="font-playfair text-xl font-bold">Wine Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <Badge className={typeColors[wine.wine_type] || "bg-gray-100 text-gray-800"}>
              {wine.wine_type}
            </Badge>
            <h3 className="font-playfair text-2xl font-bold mt-2">{wine.name}</h3>
            <p className="text-lg text-muted-foreground">{wine.producer}</p>
          </div>

          {/* Match Score */}
          <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
            <div className="text-4xl">🎯</div>
            <div>
              <div className="text-2xl font-bold">{wine.confidence}% Match</div>
              <div className="text-sm text-muted-foreground">Based on your taste profile</div>
            </div>
          </div>

          <Separator />

          {/* Why Recommended */}
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span>💡</span> Why We Recommend This
            </h4>
            <p className="text-muted-foreground">{wine.why_recommended}</p>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Region</div>
              <div className="font-medium">{wine.region}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Country</div>
              <div className="font-medium">{wine.country}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Vintage</div>
              <div className="font-medium">{wine.vintage_suggestion}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Price Range</div>
              <div className="font-medium text-primary">{wine.price_range}</div>
            </div>
          </div>

          {/* Grape Varieties */}
          {wine.grape_varieties.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Grape Varieties</h4>
              <div className="flex flex-wrap gap-2">
                {wine.grape_varieties.map((grape) => (
                  <Badge key={grape} variant="secondary">
                    {grape}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Flavor Profile */}
          {wine.flavor_profile.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Flavor Profile</h4>
              <div className="flex flex-wrap gap-2">
                {wine.flavor_profile.map((flavor) => (
                  <Badge key={flavor} variant="outline">
                    {flavor}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Food Pairings */}
          {wine.food_pairings.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span>🍽️</span> Food Pairings
              </h4>
              <div className="flex flex-wrap gap-2">
                {wine.food_pairings.map((food) => (
                  <Badge key={food} variant="secondary">
                    {food}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
