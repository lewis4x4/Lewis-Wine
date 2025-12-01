"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useAddToShoppingList } from "@/lib/hooks/use-shopping-list";
import { useCellarInventory } from "@/lib/hooks/use-cellar";
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
import type { WineReference, ShoppingUrgency, CellarInventoryWithWine } from "@/types/database";

const COMMON_REASONS = [
  "Running low",
  "Sold out in cellar",
  "Upcoming dinner party",
  "Holiday gift",
  "Special occasion",
  "Restock favorite",
];

const COMMON_VENDORS = [
  "Wine.com",
  "Total Wine",
  "K&L Wine",
  "Local Wine Shop",
  "Costco",
  "Trader Joe's",
  "Vivino",
];

export default function AddShoppingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const addToShopping = useAddToShoppingList();
  const { data: cellarInventory } = useCellarInventory();

  // Source selection
  const [sourceType, setSourceType] = useState<"search" | "cellar" | "custom">("search");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedWine, setSelectedWine] = useState<WineReference | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<CellarInventoryWithWine | null>(null);
  const { data: searchResults, isLoading: isSearching } = useWineSearch(searchQuery);

  // Form state
  const [wineName, setWineName] = useState("");
  const [producer, setProducer] = useState("");
  const [vintage, setVintage] = useState("");
  const [quantityNeeded, setQuantityNeeded] = useState(1);
  const [urgency, setUrgency] = useState<ShoppingUrgency>("normal");
  const [targetPrice, setTargetPrice] = useState("");
  const [preferredVendors, setPreferredVendors] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const handleSelectWine = (wine: WineReference) => {
    setSelectedWine(wine);
    setSelectedInventory(null);
    setWineName(wine.name);
    setProducer(wine.producer || "");
    setShowResults(false);
    setSearchQuery("");
  };

  const handleSelectInventory = (inv: CellarInventoryWithWine) => {
    setSelectedInventory(inv);
    setSelectedWine(null);
    setWineName(inv.wine_reference?.name || inv.custom_name || "");
    setProducer(inv.wine_reference?.producer || inv.custom_producer || "");
    setVintage(inv.vintage?.toString() || "");
    if (inv.purchase_price_cents) {
      setTargetPrice((inv.purchase_price_cents / 100).toFixed(2));
    }
  };

  const handleClearSelection = () => {
    setSelectedWine(null);
    setSelectedInventory(null);
    setWineName("");
    setProducer("");
    setVintage("");
    setTargetPrice("");
  };

  const toggleVendor = (vendor: string) => {
    if (preferredVendors.includes(vendor)) {
      setPreferredVendors(preferredVendors.filter((v) => v !== vendor));
    } else {
      setPreferredVendors([...preferredVendors, vendor]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in");
      return;
    }

    if (!wineName && !selectedWine && !selectedInventory) {
      toast.error("Please enter a wine name or select a wine");
      return;
    }

    try {
      await addToShopping.mutateAsync({
        user_id: user.id,
        inventory_id: selectedInventory?.id || null,
        wine_reference_id: selectedWine?.id || selectedInventory?.wine_reference_id || null,
        custom_name: selectedWine || selectedInventory ? null : wineName,
        custom_producer: selectedWine || selectedInventory ? null : producer || null,
        custom_vintage: vintage ? parseInt(vintage) : null,
        quantity_needed: quantityNeeded,
        urgency,
        target_price_cents: targetPrice ? Math.round(parseFloat(targetPrice) * 100) : null,
        last_purchase_price_cents: selectedInventory?.purchase_price_cents || null,
        preferred_vendors: preferredVendors.length > 0 ? preferredVendors : null,
        reason: reason || null,
        notes: notes || null,
      });

      toast.success(`Added to shopping list!`);
      router.push("/shopping");
    } catch {
      toast.error("Failed to add to shopping list");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Add to Shopping List</h1>
          <p className="text-muted-foreground">
            Track a wine you need to buy
          </p>
        </div>
        <Link href="/shopping">
          <Button variant="outline">Back to List</Button>
        </Link>
      </div>

      {/* Source Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Wine</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sourceType === "cellar" ? "default" : "outline"}
              size="sm"
              onClick={() => setSourceType("cellar")}
            >
              From My Cellar
            </Button>
            <Button
              type="button"
              variant={sourceType === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setSourceType("search")}
            >
              Search Database
            </Button>
            <Button
              type="button"
              variant={sourceType === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => setSourceType("custom")}
            >
              Custom Entry
            </Button>
          </div>

          {/* Show selected wine */}
          {(selectedWine || selectedInventory) && (
            <div className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-medium">{wineName}</p>
                <p className="text-sm text-muted-foreground">
                  {producer}
                  {vintage && ` • ${vintage}`}
                </p>
                {selectedInventory && (
                  <Badge variant="secondary" className="mt-1">From Cellar</Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                Clear
              </Button>
            </div>
          )}

          {/* Cellar Selection */}
          {sourceType === "cellar" && !selectedInventory && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cellarInventory?.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  className="w-full p-3 text-left hover:bg-gray-50 border rounded-lg"
                  onClick={() => handleSelectInventory(inv as CellarInventoryWithWine)}
                >
                  <p className="font-medium">
                    {inv.wine_reference?.name || inv.custom_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inv.wine_reference?.producer || inv.custom_producer}
                    {inv.vintage && ` • ${inv.vintage}`}
                    {" • "}
                    {inv.quantity} in stock
                  </p>
                </button>
              ))}
              {!cellarInventory?.length && (
                <p className="text-center text-muted-foreground py-4">
                  No wines in your cellar yet.
                </p>
              )}
            </div>
          )}

          {/* Search */}
          {sourceType === "search" && !selectedWine && (
            <div className="relative">
              <Input
                placeholder="Search wines..."
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
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        {/* Custom Wine Details (only show if custom entry) */}
        {sourceType === "custom" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Wine Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Wine Name *</Label>
                  <Input
                    id="name"
                    value={wineName}
                    onChange={(e) => setWineName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="producer">Producer</Label>
                  <Input
                    id="producer"
                    value={producer}
                    onChange={(e) => setProducer(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vintage">Vintage</Label>
                  <Input
                    id="vintage"
                    type="number"
                    value={vintage}
                    onChange={(e) => setVintage(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shopping Details */}
        <Card>
          <CardHeader>
            <CardTitle>Shopping Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quantity & Urgency */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity Needed</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantityNeeded(Math.max(1, quantityNeeded - 1))}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={quantityNeeded}
                    onChange={(e) => setQuantityNeeded(parseInt(e.target.value) || 1)}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantityNeeded(quantityNeeded + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as ShoppingUrgency)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Price */}
            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target Price per Bottle</Label>
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

            {/* Preferred Vendors */}
            <div className="space-y-2">
              <Label>Preferred Vendors</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_VENDORS.map((vendor) => (
                  <Badge
                    key={vendor}
                    variant={preferredVendors.includes(vendor) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleVendor(vendor)}
                  >
                    {vendor}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COMMON_REASONS.map((r) => (
                  <Badge
                    key={r}
                    variant={reason === r ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setReason(reason === r ? "" : r)}
                  >
                    {r}
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Or enter custom reason..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={addToShopping.isPending}>
            {addToShopping.isPending ? "Adding..." : "Add to Shopping List"}
          </Button>
        </div>
      </form>
    </div>
  );
}
