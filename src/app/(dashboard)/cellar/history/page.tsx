"use client";

import { useState } from "react";
import Link from "next/link";
import { useConsumedWines, useRestoreWine } from "@/lib/hooks/use-cellar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { CellarInventory, WineReference, Rating } from "@/types/database";

type ConsumedWine = CellarInventory & {
  wine_reference: WineReference | null;
  ratings: Rating[];
};

export default function HistoryPage() {
  const { data: consumedWines, isLoading } = useConsumedWines();
  const restoreWine = useRestoreWine();
  const [searchQuery, setSearchQuery] = useState("");
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [wineToRestore, setWineToRestore] = useState<ConsumedWine | null>(null);
  const [restoreQuantity, setRestoreQuantity] = useState(1);

  const filteredWines = consumedWines?.filter((wine) => {
    const name = wine.wine_reference?.name || wine.custom_name || "";
    const producer = wine.wine_reference?.producer || wine.custom_producer || "";
    const query = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      producer.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const getTypeColor = (type: string | null) => {
    switch (type) {
      case "red": return "bg-red-100 text-red-800";
      case "white": return "bg-yellow-100 text-yellow-800";
      case "rose": return "bg-pink-100 text-pink-800";
      case "sparkling": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 95) return "bg-purple-600";
    if (score >= 90) return "bg-green-600";
    if (score >= 85) return "bg-blue-600";
    if (score >= 80) return "bg-yellow-600";
    return "bg-gray-600";
  };

  const openRestoreDialog = (wine: ConsumedWine) => {
    setWineToRestore(wine);
    setRestoreQuantity(1);
    setRestoreDialogOpen(true);
  };

  const handleRestore = async () => {
    if (!wineToRestore) return;
    try {
      await restoreWine.mutateAsync({
        id: wineToRestore.id,
        quantity: restoreQuantity,
      });
      toast.success("Wine restored to cellar!");
      setRestoreDialogOpen(false);
      setWineToRestore(null);
    } catch {
      toast.error("Failed to restore wine");
    }
  };

  // Group by month/year
  const groupedByMonth = filteredWines?.reduce(
    (acc, wine) => {
      const date = wine.consumed_date ? new Date(wine.consumed_date) : null;
      const key = date
        ? date.toLocaleDateString("en-US", { year: "numeric", month: "long" })
        : "Unknown Date";
      if (!acc[key]) acc[key] = [];
      acc[key].push(wine);
      return acc;
    },
    {} as Record<string, ConsumedWine[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/cellar"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            &larr; Back to Cellar
          </Link>
          <h1 className="font-playfair text-3xl font-bold">Drinking History</h1>
          <p className="text-muted-foreground">
            {consumedWines?.length || 0} wines consumed
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search consumed wines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-4xl animate-pulse">🍷</div>
            <p className="mt-2 text-muted-foreground">Loading history...</p>
          </div>
        </div>
      ) : !consumedWines?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">📜</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">
              No drinking history yet
            </h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              When you mark wines as consumed, they&apos;ll appear here so you can
              track your tasting journey.
            </p>
            <Link href="/cellar" className="mt-6">
              <Button>Go to Cellar</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByMonth || {}).map(([month, wines]) => (
            <div key={month}>
              <h2 className="text-lg font-semibold mb-4 text-muted-foreground">
                {month}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {wines.map((wine) => {
                  const wineRef = wine.wine_reference;
                  const name = wineRef?.name || wine.custom_name || "Unknown Wine";
                  const producer = wineRef?.producer || wine.custom_producer;
                  const wineType = wineRef?.wine_type || wine.custom_wine_type;
                  const region = wineRef?.region || wine.custom_region;
                  const avgRating = wine.ratings.length > 0
                    ? Math.round(
                        wine.ratings.reduce((sum, r) => sum + r.score, 0) /
                          wine.ratings.length
                      )
                    : null;

                  return (
                    <Card
                      key={wine.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <Link href={`/cellar/${wine.id}`}>
                              <CardTitle className="text-base font-semibold hover:text-primary truncate">
                                {wine.vintage && `${wine.vintage} `}
                                {name}
                              </CardTitle>
                            </Link>
                            {producer && (
                              <p className="text-sm text-muted-foreground truncate">
                                {producer}
                              </p>
                            )}
                          </div>
                          {avgRating && (
                            <div
                              className={`px-2 py-1 rounded text-white text-sm font-bold shrink-0 ${getScoreColor(avgRating)}`}
                            >
                              {avgRating}
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {wineType && (
                            <Badge
                              variant="secondary"
                              className={getTypeColor(wineType)}
                            >
                              {wineType.charAt(0).toUpperCase() + wineType.slice(1)}
                            </Badge>
                          )}
                          {region && (
                            <Badge variant="outline" className="text-xs">
                              {region}
                            </Badge>
                          )}
                        </div>

                        {/* Details */}
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <span>Consumed:</span>
                            <span className="font-medium text-foreground">
                              {formatDate(wine.consumed_date)}
                            </span>
                          </div>
                          {wine.purchase_price_cents && (
                            <div className="flex items-center gap-2">
                              <span>Paid:</span>
                              <span className="font-medium text-foreground">
                                {formatPrice(wine.purchase_price_cents)}
                              </span>
                            </div>
                          )}
                          {wine.ratings.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span>Tasting notes:</span>
                              <span className="font-medium text-foreground">
                                {wine.ratings.length}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Link href={`/cellar/${wine.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              View Details
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRestoreDialog(wine)}
                          >
                            Restore
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Wine to Cellar</DialogTitle>
            <DialogDescription>
              This will move the wine back to your active cellar inventory.
              {wineToRestore && (
                <span className="block mt-2 font-medium text-foreground">
                  {wineToRestore.vintage && `${wineToRestore.vintage} `}
                  {wineToRestore.wine_reference?.name ||
                    wineToRestore.custom_name}
                </span>
              )}
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
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={restoreWine.isPending}>
              {restoreWine.isPending ? "Restoring..." : "Restore to Cellar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
