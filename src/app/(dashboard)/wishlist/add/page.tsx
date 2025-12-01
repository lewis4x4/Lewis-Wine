"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useAddToWishlist } from "@/lib/hooks/use-wishlist";
import { useWineSearch } from "@/lib/hooks/use-wine-search";
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
import type { WineReference, WishlistPriority } from "@/types/database";

const WINE_SOURCES = [
  "Restaurant",
  "Friend Recommendation",
  "Article / Review",
  "Winery Visit",
  "Wine Tasting",
  "Social Media",
  "Wine Shop",
  "Other",
];

export default function AddWishlistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const addToWishlist = useAddToWishlist();

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
  const [priority, setPriority] = useState<WishlistPriority>("medium");
  const [targetPrice, setTargetPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [desiredQuantity, setDesiredQuantity] = useState(1);
  const [source, setSource] = useState("");
  const [sourceDetails, setSourceDetails] = useState("");
  const [notes, setNotes] = useState("");

  const handleSelectWine = (wine: WineReference) => {
    setSelectedWine(wine);
    setWineName(wine.name);
    setProducer(wine.producer || "");
    setRegion(wine.region || "");
    setWineType(wine.wine_type || "");
    setShowResults(false);
    setSearchQuery("");
  };

  const handleClearSelection = () => {
    setSelectedWine(null);
    setWineName("");
    setProducer("");
    setRegion("");
    setWineType("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in to add to wishlist");
      return;
    }

    if (!wineName && !selectedWine) {
      toast.error("Please enter a wine name or select from search");
      return;
    }

    try {
      await addToWishlist.mutateAsync({
        user_id: user.id,
        wine_reference_id: selectedWine?.id || null,
        custom_name: selectedWine ? null : wineName,
        custom_producer: selectedWine ? null : producer || null,
        custom_region: selectedWine ? null : region || null,
        custom_vintage: vintage ? parseInt(vintage) : null,
        custom_wine_type: selectedWine ? null : (wineType as any) || null,
        priority,
        target_price_cents: targetPrice ? Math.round(parseFloat(targetPrice) * 100) : null,
        max_price_cents: maxPrice ? Math.round(parseFloat(maxPrice) * 100) : null,
        desired_quantity: desiredQuantity,
        source: source || null,
        source_details: sourceDetails || null,
        notes: notes || null,
      });

      toast.success(`Added "${wineName || selectedWine?.name}" to wishlist!`);
      router.push("/wishlist");
    } catch {
      toast.error("Failed to add to wishlist");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Add to Wishlist</h1>
          <p className="text-muted-foreground">
            Track a wine you want to buy
          </p>
        </div>
        <Link href="/wishlist">
          <Button variant="outline">Back to Wishlist</Button>
        </Link>
      </div>

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
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                Clear
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search wines by name or producer..."
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
                  {searchResults.map((wine) => (
                    <button
                      key={wine.id}
                      type="button"
                      className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-0"
                      onClick={() => handleSelectWine(wine)}
                    >
                      <p className="font-medium truncate">{wine.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {wine.producer}
                        {wine.region && ` • ${wine.region}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchResults?.length === 0 && searchQuery.length >= 2 && !isSearching && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                  No wines found. Enter details manually below.
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Search our database or enter details manually below.
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
                  disabled={!!selectedWine}
                  required={!selectedWine}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producer">Producer</Label>
                <Input
                  id="producer"
                  placeholder="e.g., Opus One Winery"
                  value={producer}
                  onChange={(e) => setProducer(e.target.value)}
                  disabled={!!selectedWine}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  placeholder="e.g., Napa Valley"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  disabled={!!selectedWine}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Wine Type</Label>
                <Select value={wineType} onValueChange={setWineType} disabled={!!selectedWine}>
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
              <div className="space-y-2">
                <Label htmlFor="vintage">Vintage (optional)</Label>
                <Input
                  id="vintage"
                  type="number"
                  placeholder="2020"
                  value={vintage}
                  onChange={(e) => setVintage(e.target.value)}
                />
              </div>
            </div>

            {/* Priority & Quantity */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as WishlistPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="must-have">Must Have</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Desired Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDesiredQuantity(Math.max(1, desiredQuantity - 1))}
                  >
                    -
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={desiredQuantity}
                    onChange={(e) => setDesiredQuantity(parseInt(e.target.value) || 1)}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDesiredQuantity(desiredQuantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Price Targets */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="targetPrice">Target Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="targetPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice">Max Price (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="maxPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>

            {/* Discovery Source */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source">Where did you discover this wine?</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {WINE_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceDetails">Details (optional)</Label>
                <Input
                  id="sourceDetails"
                  placeholder="e.g., Recommended by sommelier"
                  value={sourceDetails}
                  onChange={(e) => setSourceDetails(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Why do you want this wine? Any specific vintage preferences?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={addToWishlist.isPending}>
            {addToWishlist.isPending ? "Adding..." : "Add to Wishlist"}
          </Button>
        </div>
      </form>
    </div>
  );
}
