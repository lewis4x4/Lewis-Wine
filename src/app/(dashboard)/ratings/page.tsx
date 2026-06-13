"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonRatingItem, SkeletonStatCard } from "@/components/ui/skeleton";
import type { Rating } from "@/types/database";

type RatingWithInventory = Rating & {
  cellar_inventory: {
    custom_name: string | null;
    vintage: number | null;
    wine_reference: {
      name: string;
      producer: string | null;
      region: string | null;
    } | null;
  } | null;
};

type RatingInventory = {
  vintage?: number | null;
  custom_name?: string | null;
  wine_reference?: {
    name?: string | null;
    producer?: string | null;
  } | null;
};

export default function RatingsPage() {
  const supabase = createClient();

  const { data: ratings, isLoading } = useQuery({
    queryKey: ["ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select(`
          *,
          cellar_inventory:inventory_id (
            custom_name,
            vintage,
            wine_reference (
              name,
              producer,
              region
            )
          )
        `)
        .order("tasting_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as RatingWithInventory[];
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 95) return "text-purple-600 bg-purple-50";
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 85) return "text-blue-600 bg-blue-50";
    if (score >= 80) return "text-yellow-600 bg-yellow-50";
    return "text-gray-600 bg-gray-50";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-bold">Ratings</h1>
        <p className="text-muted-foreground">
          Your taste memory, not just a score log.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          <Card>
            <CardHeader>
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRatingItem key={i} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : !ratings?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">⭐</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">
              No ratings yet
            </h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Start rating wines to track your tasting journey and discover your
              preferences over time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
            <CardHeader>
              <CardTitle className="font-playfair text-2xl">Taste operating view</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-background/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What matters now</div>
                <p className="mt-2 text-sm text-foreground">
                  {ratings.length} rating{ratings.length === 1 ? "" : "s"} now shape your taste memory, with {ratings.filter((r) => r.score >= 90).length} standout bottle{ratings.filter((r) => r.score >= 90).length === 1 ? "" : "s"} at 90+.
                </p>
              </div>
              <div className="rounded-xl border bg-background/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next move</div>
                <p className="mt-2 text-sm text-foreground">
                  Review the highest and lowest ratings together so Pourfolio learns what actually separates favorites from misses.
                </p>
              </div>
              <div className="rounded-xl border bg-background/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk if ignored</div>
                <p className="mt-2 text-sm text-foreground">
                  If ratings stay buried as a feed, your cellar can track events without ever getting smarter about your taste.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-3xl font-bold">{ratings.length}</p>
                <p className="text-sm text-muted-foreground">Total Ratings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-3xl font-bold">
                  {Math.round(
                    ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Average Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-3xl font-bold">
                  {Math.max(...ratings.map((r) => r.score))}
                </p>
                <p className="text-sm text-muted-foreground">Highest Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-3xl font-bold">
                  {ratings.filter((r) => r.score >= 90).length}
                </p>
                <p className="text-sm text-muted-foreground">90+ Wines</p>
              </CardContent>
            </Card>
          </div>

          {/* Ratings List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent taste signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {ratings.map((rating) => {
                  const inventory = rating.cellar_inventory as RatingInventory | null;
                  const wine = inventory?.wine_reference;
                  const name = wine?.name || inventory?.custom_name || "Unknown Wine";
                  const producer = wine?.producer || "";

                  return (
                    <div
                      key={rating.id}
                      className="py-4 flex items-start gap-4"
                    >
                      <div
                        className={`px-3 py-2 rounded-lg ${getScoreColor(rating.score)}`}
                      >
                        <span className="text-2xl font-bold">{rating.score}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {inventory?.vintage && `${inventory.vintage} `}
                          {name}
                        </h3>
                        {producer && (
                          <p className="text-sm text-muted-foreground">
                            {producer}
                          </p>
                        )}
                        {rating.tasting_notes && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {rating.tasting_notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground shrink-0">
                        {formatDate(rating.tasting_date)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
