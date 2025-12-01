"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useConsumeWine, useCellar } from "@/lib/hooks/use-cellar";
import { useAddRating, useRecentCompanions } from "@/lib/hooks/use-ratings";
import { getLocationDisplayString } from "@/lib/hooks/use-cellar-locations";
import { useUpdateLowStockSettings } from "@/lib/hooks/use-low-stock-alerts";
import { LocationSelector } from "@/components/cellar/location-selector";
import { EnhancedTastingForm, EnhancedTastingData } from "@/components/tasting";
import { MarketValueEditor, PricePerGlass } from "@/components/financial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { CellarInventory, WineReference, Rating, LocationMode, CellarLocation, AromaNotes, MarketValueSource } from "@/types/database";

type WineWithDetails = CellarInventory & {
  wine_reference: WineReference | null;
  ratings: Rating[];
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
  const consumeWine = useConsumeWine();
  const addRating = useAddRating();
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
          ratings (*),
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
  const region = wineRef?.region;
  const country = wineRef?.country;
  const vintage = wine.vintage;
  const wineType = wineRef?.wine_type;
  const avgRating = wine.ratings.length > 0
    ? Math.round(wine.ratings.reduce((sum, r) => sum + r.score, 0) / wine.ratings.length)
    : null;

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/cellar"
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← Back to Cellar
          </Link>
          <h1 className="font-playfair text-2xl font-bold">
            {vintage && `${vintage} `}{name}
          </h1>
          {producer && (
            <p className="text-lg text-muted-foreground">{producer}</p>
          )}
        </div>
        {avgRating && (
          <div className={`px-4 py-2 rounded-lg text-white ${getScoreColor(avgRating)}`}>
            <span className="text-2xl font-bold">{avgRating}</span>
          </div>
        )}
      </div>

      {/* Quick Info */}
      <div className="flex flex-wrap gap-2">
        {wineType && (
          <Badge variant="secondary" className={getTypeColor(wineType)}>
            {wineType.charAt(0).toUpperCase() + wineType.slice(1)}
          </Badge>
        )}
        {region && (
          <Badge variant="outline">{region}</Badge>
        )}
        {country && (
          <Badge variant="outline">{country}</Badge>
        )}
        <Badge variant="secondary">
          {wine.quantity} bottle{wine.quantity !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Sheet open={showRatingSheet} onOpenChange={setShowRatingSheet}>
          <SheetTrigger asChild>
            <Button>Add Tasting Notes</Button>
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

        <Dialog open={showConsumeDialog} onOpenChange={setShowConsumeDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">Mark Consumed</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Consumed?</DialogTitle>
              <DialogDescription>
                This will remove the wine from your active cellar inventory.
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
      </div>

      {/* Storage Location Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Storage Location</CardTitle>
          <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" onClick={openLocationDialog}>
                Edit
              </Button>
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
        </CardHeader>
        <CardContent>
          {(() => {
            const locationDisplay = getLocationDisplayString(
              { simple_location: wine.simple_location, location: wine.location },
              locationMode
            );
            return locationDisplay ? (
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span className="font-medium">{locationDisplay}</span>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No location set. Click Edit to add one.
              </p>
            );
          })()}
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
