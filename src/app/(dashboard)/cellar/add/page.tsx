"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCellar, useAddToInventory } from "@/lib/hooks/use-cellar";
import { useWineSearch } from "@/lib/hooks/use-wine-search";
import { RatingInput } from "@/components/wine/rating-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { LocationSelector } from "@/components/cellar/location-selector";
import type { WineReference, LocationMode } from "@/types/database";

const COMMON_REGIONS = [
  "Napa Valley",
  "Sonoma",
  "Bordeaux",
  "Burgundy",
  "Champagne",
  "Tuscany",
  "Piedmont",
  "Rioja",
  "Barossa Valley",
  "Marlborough",
  "Mendoza",
  "Willamette Valley",
  "Mosel",
  "Rhône Valley",
  "Loire Valley",
];

function AddWineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const barcodeFromUrl = searchParams.get("barcode");

  const { data: cellar } = useCellar();
  const addToInventory = useAddToInventory();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedWine, setSelectedWine] = useState<WineReference | null>(null);
  const { data: searchResults, isLoading: isSearching } = useWineSearch(searchQuery);

  // Form state
  const [wineName, setWineName] = useState("");
  const [producer, setProducer] = useState("");
  const [vintage, setVintage] = useState("");
  const [wineType, setWineType] = useState("");
  const [region, setRegion] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseLocation, setPurchaseLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(85);
  const [includeRating, setIncludeRating] = useState(false);

  // Storage location state
  const [storageLocation, setStorageLocation] = useState<string | null>(null);
  const [storageLocationId, setStorageLocationId] = useState<string | null>(null);
  const locationMode: LocationMode = (cellar?.location_mode as LocationMode) || "simple";

  // Handle selecting a wine from search
  const handleSelectWine = (wine: WineReference) => {
    setSelectedWine(wine);
    setWineName(wine.name);
    setProducer(wine.producer || "");
    setRegion(wine.region || "");
    setWineType(wine.wine_type || "");
    setShowResults(false);
    setSearchQuery("");

    // Show rating if wine has one
    const criticScore = wine.critic_scores as { wine_enthusiast?: number } | null;
    if (criticScore?.wine_enthusiast) {
      setRating(criticScore.wine_enthusiast);
      setIncludeRating(true);
    }
  };

  // Clear selected wine
  const handleClearSelection = () => {
    setSelectedWine(null);
    setWineName("");
    setProducer("");
    setRegion("");
    setWineType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cellar) {
      toast.error("No cellar found");
      return;
    }

    if (!wineName) {
      toast.error("Please enter a wine name");
      return;
    }

    try {
      await addToInventory.mutateAsync({
        cellar_id: cellar.id,
        wine_reference_id: selectedWine?.id || null,
        custom_name: selectedWine ? null : wineName,
        custom_producer: selectedWine ? null : (producer || null),
        custom_vintage: vintage ? parseInt(vintage) : null,
        custom_wine_type: selectedWine ? null : (wineType ? (wineType as "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified") : null),
        custom_region: selectedWine ? null : (region || null),
        vintage: vintage ? parseInt(vintage) : null,
        quantity,
        purchase_price_cents: purchasePrice ? Math.round(parseFloat(purchasePrice) * 100) : null,
        purchase_location: purchaseLocation || null,
        purchase_date: new Date().toISOString().split("T")[0],
        notes: notes || null,
        simple_location: locationMode === "simple" ? storageLocation : null,
        location_id: locationMode !== "simple" ? storageLocationId : null,
      });

      toast.success(`Added ${wineName} to your cellar!`);
      router.push("/cellar");
    } catch {
      toast.error("Failed to add wine");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Add Wine</h1>
          <p className="text-muted-foreground">
            Add a new wine to your collection
          </p>
        </div>
        <Link href="/scan">
          <Button variant="outline">📱 Scan Instead</Button>
        </Link>
      </div>

      {barcodeFromUrl && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3">
            <p className="text-sm">
              Barcode scanned: <code className="bg-white px-2 py-1 rounded">{barcodeFromUrl}</code>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Wine Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Wine Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedWine ? (
            <div className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-medium">{selectedWine.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedWine.producer}
                  {selectedWine.region && ` • ${selectedWine.region}`}
                </p>
                {(selectedWine.critic_scores as { wine_enthusiast?: number } | null)?.wine_enthusiast && (
                  <Badge variant="secondary" className="mt-2">
                    {(selectedWine.critic_scores as { wine_enthusiast?: number }).wine_enthusiast} pts
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                Clear
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search 80,000+ wines by name or producer..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowResults(e.target.value.length >= 2);
                }}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}

              {showResults && searchResults && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map((wine) => {
                    const criticScore = wine.critic_scores as { wine_enthusiast?: number; description?: string } | null;
                    return (
                      <button
                        key={wine.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-0"
                        onClick={() => handleSelectWine(wine)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{wine.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {wine.producer}
                              {wine.region && ` • ${wine.region}`}
                              {wine.country && ` • ${wine.country}`}
                            </p>
                          </div>
                          {criticScore?.wine_enthusiast && (
                            <Badge variant="secondary" className="ml-2 shrink-0">
                              {criticScore.wine_enthusiast} pts
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {showResults && searchResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                  No wines found. Try a different search or enter details manually below.
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Search our database of 80,000+ wines with ratings, or enter details manually below.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Wine Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Wine Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Wine Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Opus One, Château Margaux"
                  value={wineName}
                  onChange={(e) => setWineName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer">Producer / Winery</Label>
                <Input
                  id="producer"
                  placeholder="e.g., Opus One Winery"
                  value={producer}
                  onChange={(e) => setProducer(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select or type region" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Wine Type</Label>
                <Select value={wineType} onValueChange={setWineType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="rose">Rosé</SelectItem>
                    <SelectItem value="sparkling">Sparkling</SelectItem>
                    <SelectItem value="dessert">Dessert</SelectItem>
                    <SelectItem value="fortified">Fortified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vintage, Quantity, Price */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="vintage">Vintage</Label>
                <Input
                  id="vintage"
                  type="number"
                  placeholder="2020"
                  value={vintage}
                  onChange={(e) => setVintage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per bottle</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase-location">Purchase Location</Label>
              <Input
                id="purchase-location"
                placeholder="e.g., Wine.com, Local Wine Shop"
                value={purchaseLocation}
                onChange={(e) => setPurchaseLocation(e.target.value)}
              />
            </div>

            {/* Storage Location */}
            {cellar && (
              <LocationSelector
                cellarId={cellar.id}
                mode={locationMode}
                value={storageLocation}
                locationId={storageLocationId}
                onChange={setStorageLocation}
                onLocationIdChange={setStorageLocationId}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this wine..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Rating Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeRating"
                  checked={includeRating}
                  onChange={(e) => setIncludeRating(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="includeRating" className="font-normal">
                  Add a rating now
                </Label>
              </div>

              {includeRating && (
                <RatingInput value={rating} onChange={setRating} />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={addToInventory.isPending}>
            {addToInventory.isPending ? "Adding..." : "Add to Cellar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AddWineLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Add Wine</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-12">
          <div className="flex justify-center">
            <div className="animate-pulse text-4xl">🍷</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddWinePage() {
  return (
    <Suspense fallback={<AddWineLoading />}>
      <AddWineContent />
    </Suspense>
  );
}
