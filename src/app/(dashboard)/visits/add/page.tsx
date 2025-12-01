"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { useAddWineryVisit, useRecentWineries, useAddWineryVisitWine } from "@/lib/hooks/use-winery-visits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { VisitType, WineType, WineryVisitWineInsert } from "@/types/database";

const VISIT_TYPES: { value: VisitType; label: string }[] = [
  { value: "tasting", label: "Tasting" },
  { value: "tour", label: "Tour" },
  { value: "tour-and-tasting", label: "Tour & Tasting" },
  { value: "pickup", label: "Wine Pickup" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

type WineTasted = {
  id: string;
  wine_name: string;
  wine_type: WineType | "";
  vintage: string;
  rating: string;
  tasting_notes: string;
  purchased: boolean;
  quantity_purchased: string;
  price_per_bottle: string;
  interested_in_buying: boolean;
};

const createEmptyWine = (): WineTasted => ({
  id: Math.random().toString(36).substring(7),
  wine_name: "",
  wine_type: "",
  vintage: "",
  rating: "",
  tasting_notes: "",
  purchased: false,
  quantity_purchased: "",
  price_per_bottle: "",
  interested_in_buying: false,
});

export default function AddVisitPage() {
  const router = useRouter();
  const { user } = useAuth();
  const addVisit = useAddWineryVisit();
  const addWine = useAddWineryVisitWine();
  const { data: recentWineries } = useRecentWineries();

  // Winery info
  const [wineryName, setWineryName] = useState("");
  const [wineryRegion, setWineryRegion] = useState("");
  const [wineryCountry, setWineryCountry] = useState("");
  const [wineryWebsite, setWineryWebsite] = useState("");
  const [wineryAddress, setWineryAddress] = useState("");

  // Visit details
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [visitType, setVisitType] = useState<VisitType>("tasting");
  const [reservationRequired, setReservationRequired] = useState(false);
  const [tastingFee, setTastingFee] = useState("");
  const [tastingFeeWaived, setTastingFeeWaived] = useState(false);

  // Ratings
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [atmosphereRating, setAtmosphereRating] = useState<number | null>(null);
  const [serviceRating, setServiceRating] = useState<number | null>(null);
  const [wineQualityRating, setWineQualityRating] = useState<number | null>(null);
  const [valueRating, setValueRating] = useState<number | null>(null);

  // Notes
  const [companions, setCompanions] = useState("");
  const [highlights, setHighlights] = useState("");
  const [notes, setNotes] = useState("");
  const [wouldReturn, setWouldReturn] = useState<boolean | null>(null);
  const [recommendedFor, setRecommendedFor] = useState("");

  // Wines tasted
  const [winesTasted, setWinesTasted] = useState<WineTasted[]>([createEmptyWine()]);

  const selectRecentWinery = (winery: { winery_name: string; winery_region: string | null }) => {
    setWineryName(winery.winery_name);
    if (winery.winery_region) setWineryRegion(winery.winery_region);
  };

  const addWineRow = () => {
    setWinesTasted([...winesTasted, createEmptyWine()]);
  };

  const updateWine = (id: string, field: keyof WineTasted, value: any) => {
    setWinesTasted(winesTasted.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  };

  const removeWine = (id: string) => {
    if (winesTasted.length > 1) {
      setWinesTasted(winesTasted.filter((w) => w.id !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please log in");
      return;
    }

    if (!wineryName) {
      toast.error("Please enter a winery name");
      return;
    }

    try {
      // Create the visit
      const visit = await addVisit.mutateAsync({
        user_id: user.id,
        winery_name: wineryName,
        winery_region: wineryRegion || null,
        winery_country: wineryCountry || null,
        winery_website: wineryWebsite || null,
        winery_address: wineryAddress || null,
        visit_date: visitDate,
        visit_type: visitType,
        reservation_required: reservationRequired,
        tasting_fee_cents: tastingFee ? Math.round(parseFloat(tastingFee) * 100) : null,
        tasting_fee_waived: tastingFeeWaived,
        overall_rating: overallRating,
        atmosphere_rating: atmosphereRating,
        service_rating: serviceRating,
        wine_quality_rating: wineQualityRating,
        value_rating: valueRating,
        companions: companions ? companions.split(",").map((c) => c.trim()) : null,
        highlights: highlights || null,
        notes: notes || null,
        would_return: wouldReturn,
        recommended_for: recommendedFor || null,
      });

      // Add wines tasted
      const validWines = winesTasted.filter((w) => w.wine_name.trim());
      for (let i = 0; i < validWines.length; i++) {
        const wine = validWines[i];
        await addWine.mutateAsync({
          visit_id: visit.id,
          user_id: user.id,
          wine_name: wine.wine_name,
          wine_type: wine.wine_type as WineType || null,
          vintage: wine.vintage ? parseInt(wine.vintage) : null,
          rating: wine.rating ? parseInt(wine.rating) : null,
          tasting_notes: wine.tasting_notes || null,
          purchased: wine.purchased,
          quantity_purchased: wine.quantity_purchased ? parseInt(wine.quantity_purchased) : null,
          price_per_bottle_cents: wine.price_per_bottle
            ? Math.round(parseFloat(wine.price_per_bottle) * 100)
            : null,
          interested_in_buying: wine.interested_in_buying,
          tasting_order: i + 1,
        });
      }

      toast.success(`Logged visit to ${wineryName}!`);
      router.push("/visits");
    } catch {
      toast.error("Failed to log visit");
    }
  };

  const RatingSelector = ({
    value,
    onChange,
    label,
  }: {
    value: number | null;
    onChange: (v: number | null) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            className={`text-2xl ${
              value && star <= value ? "text-yellow-500" : "text-gray-300"
            } hover:text-yellow-400 transition-colors`}
          >
            ★
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground ml-2"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Log Winery Visit</h1>
          <p className="text-muted-foreground">Record your winery experience</p>
        </div>
        <Link href="/visits">
          <Button variant="outline">Back to Visits</Button>
        </Link>
      </div>

      {/* Recent Wineries */}
      {recentWineries && recentWineries.length > 0 && !wineryName && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Wineries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentWineries.slice(0, 5).map((winery) => (
                <Badge
                  key={winery.winery_name}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => selectRecentWinery(winery)}
                >
                  {winery.winery_name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Winery Info */}
        <Card>
          <CardHeader>
            <CardTitle>Winery Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="wineryName">Winery Name *</Label>
                <Input
                  id="wineryName"
                  value={wineryName}
                  onChange={(e) => setWineryName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wineryRegion">Region</Label>
                <Input
                  id="wineryRegion"
                  placeholder="e.g., Napa Valley"
                  value={wineryRegion}
                  onChange={(e) => setWineryRegion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wineryCountry">Country</Label>
                <Input
                  id="wineryCountry"
                  placeholder="e.g., USA"
                  value={wineryCountry}
                  onChange={(e) => setWineryCountry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wineryWebsite">Website</Label>
                <Input
                  id="wineryWebsite"
                  type="url"
                  placeholder="https://..."
                  value={wineryWebsite}
                  onChange={(e) => setWineryWebsite(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wineryAddress">Address</Label>
                <Input
                  id="wineryAddress"
                  value={wineryAddress}
                  onChange={(e) => setWineryAddress(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Visit Details */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visitDate">Visit Date *</Label>
                <Input
                  id="visitDate"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitType">Visit Type</Label>
                <Select value={visitType} onValueChange={(v) => setVisitType(v as VisitType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tastingFee">Tasting Fee</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="tastingFee"
                    type="number"
                    step="0.01"
                    value={tastingFee}
                    onChange={(e) => setTastingFee(e.target.value)}
                    className="pl-7"
                    disabled={tastingFeeWaived}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="feeWaived"
                    checked={tastingFeeWaived}
                    onCheckedChange={setTastingFeeWaived}
                  />
                  <Label htmlFor="feeWaived">Fee Waived</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="reservation"
                    checked={reservationRequired}
                    onCheckedChange={setReservationRequired}
                  />
                  <Label htmlFor="reservation">Reservation Required</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Companions</Label>
              <Input
                placeholder="Names separated by commas"
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Wines Tasted */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Wines Tasted</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addWineRow}>
              + Add Wine
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {winesTasted.map((wine, index) => (
              <div
                key={wine.id}
                className="p-4 border rounded-lg space-y-3 relative"
              >
                {winesTasted.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWine(wine.id)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                  >
                    ×
                  </button>
                )}
                <div className="text-sm font-medium text-muted-foreground">
                  Wine #{index + 1}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Wine Name</Label>
                    <Input
                      value={wine.wine_name}
                      onChange={(e) => updateWine(wine.id, "wine_name", e.target.value)}
                      placeholder="Wine name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select
                      value={wine.wine_type}
                      onValueChange={(v) => updateWine(wine.id, "wine_type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
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
                  <div className="space-y-1">
                    <Label>Vintage</Label>
                    <Input
                      type="number"
                      value={wine.vintage}
                      onChange={(e) => updateWine(wine.id, "vintage", e.target.value)}
                      placeholder="Year"
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Rating (1-100)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={wine.rating}
                      onChange={(e) => updateWine(wine.id, "rating", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <Label>Tasting Notes</Label>
                    <Input
                      value={wine.tasting_notes}
                      onChange={(e) => updateWine(wine.id, "tasting_notes", e.target.value)}
                      placeholder="Brief notes..."
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={wine.purchased}
                      onCheckedChange={(v) => updateWine(wine.id, "purchased", v)}
                    />
                    <Label>Purchased</Label>
                  </div>
                  {wine.purchased && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label>Qty:</Label>
                        <Input
                          type="number"
                          min="1"
                          value={wine.quantity_purchased}
                          onChange={(e) =>
                            updateWine(wine.id, "quantity_purchased", e.target.value)
                          }
                          className="w-20"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label>$/bottle:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={wine.price_per_bottle}
                          onChange={(e) =>
                            updateWine(wine.id, "price_per_bottle", e.target.value)
                          }
                          className="w-24"
                        />
                      </div>
                    </>
                  )}
                  {!wine.purchased && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={wine.interested_in_buying}
                        onCheckedChange={(v) =>
                          updateWine(wine.id, "interested_in_buying", v)
                        }
                      />
                      <Label>Interested in Buying</Label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Ratings */}
        <Card>
          <CardHeader>
            <CardTitle>Experience Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <RatingSelector
                value={overallRating}
                onChange={setOverallRating}
                label="Overall Experience"
              />
              <RatingSelector
                value={wineQualityRating}
                onChange={setWineQualityRating}
                label="Wine Quality"
              />
              <RatingSelector
                value={serviceRating}
                onChange={setServiceRating}
                label="Service"
              />
              <RatingSelector
                value={atmosphereRating}
                onChange={setAtmosphereRating}
                label="Atmosphere"
              />
              <RatingSelector
                value={valueRating}
                onChange={setValueRating}
                label="Value"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes & Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="highlights">Highlights</Label>
              <Textarea
                id="highlights"
                placeholder="What stood out about this visit?"
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any other notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Would Return?</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={wouldReturn === true ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWouldReturn(wouldReturn === true ? null : true)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant={wouldReturn === false ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWouldReturn(wouldReturn === false ? null : false)}
                  >
                    No
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recommendedFor">Recommended For</Label>
                <Input
                  id="recommendedFor"
                  placeholder="e.g., couples, groups, collectors"
                  value={recommendedFor}
                  onChange={(e) => setRecommendedFor(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={addVisit.isPending}>
            {addVisit.isPending ? "Saving..." : "Log Visit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
