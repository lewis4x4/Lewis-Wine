"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RatingInput } from "@/components/wine/rating-input";
import { WineCharacteristics, WineCharacteristicsData } from "./wine-characteristics";
import { AromaSelector } from "./aroma-selector";
import { FoodPairingInput, FoodPairingData } from "./food-pairing-input";
import { OccasionSelector } from "./occasion-selector";
import { CompanionSelector } from "./companion-selector";
import type { AromaNotes } from "@/types/database";

export interface EnhancedTastingData {
  // Core rating
  score: number;
  tasting_notes: string | null;

  // Structured notes
  appearance_notes: string | null;
  nose_notes: string | null;
  palate_notes: string | null;

  // Wine characteristics
  characteristics: WineCharacteristicsData;

  // Aromas
  aroma_notes: AromaNotes;

  // Food pairings
  food_pairings: FoodPairingData[];

  // Social context
  occasion_tags: string[];
  venue: string | null;
  companions: string[];
}

interface EnhancedTastingFormProps {
  initialData?: Partial<EnhancedTastingData>;
  wineType?: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
  recentCompanions?: string[];
  onSubmit: (data: EnhancedTastingData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const DEFAULT_DATA: EnhancedTastingData = {
  score: 85,
  tasting_notes: null,
  appearance_notes: null,
  nose_notes: null,
  palate_notes: null,
  characteristics: {
    body: null,
    tannins: null,
    acidity: null,
    sweetness: null,
    finish: null,
    intensity: null,
    quality_level: null,
  },
  aroma_notes: {},
  food_pairings: [],
  occasion_tags: [],
  venue: null,
  companions: [],
};

export function EnhancedTastingForm({
  initialData,
  wineType,
  recentCompanions = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: EnhancedTastingFormProps) {
  const [data, setData] = useState<EnhancedTastingData>({
    ...DEFAULT_DATA,
    ...initialData,
  });
  const [activeTab, setActiveTab] = useState("rating");

  const updateData = <K extends keyof EnhancedTastingData>(
    key: K,
    value: EnhancedTastingData[K]
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="rating">Rating</TabsTrigger>
          <TabsTrigger value="characteristics">Palate</TabsTrigger>
          <TabsTrigger value="aromas">Aromas</TabsTrigger>
          <TabsTrigger value="pairings">Food</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
        </TabsList>

        {/* Rating Tab */}
        <TabsContent value="rating" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Overall Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <RatingInput
                value={data.score}
                onChange={(score) => updateData("score", score)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasting Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Overall Impressions</Label>
                <Textarea
                  placeholder="Your overall thoughts on this wine..."
                  value={data.tasting_notes || ""}
                  onChange={(e) => updateData("tasting_notes", e.target.value || null)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Appearance</Label>
                  <Textarea
                    placeholder="Color, clarity, viscosity..."
                    value={data.appearance_notes || ""}
                    onChange={(e) =>
                      updateData("appearance_notes", e.target.value || null)
                    }
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nose</Label>
                  <Textarea
                    placeholder="Aromas on the nose..."
                    value={data.nose_notes || ""}
                    onChange={(e) => updateData("nose_notes", e.target.value || null)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Palate</Label>
                  <Textarea
                    placeholder="Flavors on the palate..."
                    value={data.palate_notes || ""}
                    onChange={(e) => updateData("palate_notes", e.target.value || null)}
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Characteristics Tab */}
        <TabsContent value="characteristics" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <WineCharacteristics
                value={data.characteristics}
                onChange={(characteristics) =>
                  updateData("characteristics", characteristics)
                }
                wineType={wineType}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aromas Tab */}
        <TabsContent value="aromas" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <AromaSelector
                value={data.aroma_notes}
                onChange={(aroma_notes) => updateData("aroma_notes", aroma_notes)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Food Pairings Tab */}
        <TabsContent value="pairings" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <FoodPairingInput
                value={data.food_pairings}
                onChange={(food_pairings) => updateData("food_pairings", food_pairings)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Context Tab */}
        <TabsContent value="context" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <OccasionSelector
                value={data.occasion_tags}
                onChange={(occasion_tags) => updateData("occasion_tags", occasion_tags)}
                venue={data.venue}
                onVenueChange={(venue) => updateData("venue", venue)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <CompanionSelector
                value={data.companions}
                onChange={(companions) => updateData("companions", companions)}
                recentCompanions={recentCompanions}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Tasting Notes"}
        </Button>
      </div>
    </form>
  );
}
