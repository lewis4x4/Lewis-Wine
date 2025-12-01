"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DishCategory } from "@/types/database";

export interface FoodPairingData {
  dish_name: string;
  dish_category: DishCategory | null;
  cuisine_type: string | null;
  pairing_rating: number | null;
  pairing_notes: string | null;
  would_recommend: boolean;
}

interface FoodPairingInputProps {
  value: FoodPairingData[];
  onChange: (value: FoodPairingData[]) => void;
  className?: string;
}

const DISH_CATEGORIES: { value: DishCategory; label: string }[] = [
  { value: "appetizer", label: "Appetizer" },
  { value: "soup", label: "Soup" },
  { value: "salad", label: "Salad" },
  { value: "pasta", label: "Pasta" },
  { value: "seafood", label: "Seafood" },
  { value: "poultry", label: "Poultry" },
  { value: "beef", label: "Beef" },
  { value: "pork", label: "Pork" },
  { value: "lamb", label: "Lamb" },
  { value: "game", label: "Game" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "cheese", label: "Cheese" },
  { value: "dessert", label: "Dessert" },
  { value: "other", label: "Other" },
];

const CUISINE_TYPES = [
  "American",
  "Chinese",
  "French",
  "Greek",
  "Indian",
  "Italian",
  "Japanese",
  "Korean",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Spanish",
  "Thai",
  "Vietnamese",
  "Other",
];

const PAIRING_RATINGS = [
  { value: 1, label: "Poor Match", emoji: "😕" },
  { value: 2, label: "Below Average", emoji: "😐" },
  { value: 3, label: "Good", emoji: "🙂" },
  { value: 4, label: "Very Good", emoji: "😊" },
  { value: 5, label: "Perfect Match", emoji: "🤩" },
];

function PairingCard({
  pairing,
  onUpdate,
  onRemove,
}: {
  pairing: FoodPairingData;
  onUpdate: (data: Partial<FoodPairingData>) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="What did you eat?"
              value={pairing.dish_name}
              onChange={(e) => onUpdate({ dish_name: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            Remove
          </Button>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-sm">Category</Label>
          <div className="flex flex-wrap gap-1">
            {DISH_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() =>
                  onUpdate({
                    dish_category:
                      pairing.dish_category === cat.value ? null : cat.value,
                  })
                }
                className={cn(
                  "px-2 py-1 rounded text-xs transition-colors",
                  pairing.dish_category === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cuisine type */}
        <div className="space-y-2">
          <Label className="text-sm">Cuisine</Label>
          <div className="flex flex-wrap gap-1">
            {CUISINE_TYPES.map((cuisine) => (
              <button
                key={cuisine}
                type="button"
                onClick={() =>
                  onUpdate({
                    cuisine_type:
                      pairing.cuisine_type === cuisine ? null : cuisine,
                  })
                }
                className={cn(
                  "px-2 py-1 rounded text-xs transition-colors",
                  pairing.cuisine_type === cuisine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {cuisine}
              </button>
            ))}
          </div>
        </div>

        {/* Pairing Rating */}
        <div className="space-y-2">
          <Label className="text-sm">How was the pairing?</Label>
          <div className="flex gap-2">
            {PAIRING_RATINGS.map((rating) => (
              <button
                key={rating.value}
                type="button"
                onClick={() => onUpdate({ pairing_rating: rating.value })}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                  pairing.pairing_rating === rating.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                <span className="text-lg">{rating.emoji}</span>
                <span className="text-xs">{rating.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-sm">Pairing Notes (optional)</Label>
          <Textarea
            placeholder="Why did this work (or not)?"
            value={pairing.pairing_notes || ""}
            onChange={(e) => onUpdate({ pairing_notes: e.target.value || null })}
            rows={2}
          />
        </div>

        {/* Would Recommend */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pairing.would_recommend}
            onChange={(e) => onUpdate({ would_recommend: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm">Would recommend this pairing</span>
        </label>
      </CardContent>
    </Card>
  );
}

export function FoodPairingInput({
  value,
  onChange,
  className,
}: FoodPairingInputProps) {
  const addPairing = () => {
    onChange([
      ...value,
      {
        dish_name: "",
        dish_category: null,
        cuisine_type: null,
        pairing_rating: null,
        pairing_notes: null,
        would_recommend: true,
      },
    ]);
  };

  const updatePairing = (index: number, data: Partial<FoodPairingData>) => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], ...data };
    onChange(newValue);
  };

  const removePairing = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-lg font-semibold">Food Pairings</Label>
          <p className="text-sm text-muted-foreground">
            What did you pair with this wine?
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPairing}>
          + Add Pairing
        </Button>
      </div>

      {value.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-2">🍽️</div>
            <p className="text-muted-foreground">No food pairings added yet</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPairing}
              className="mt-4"
            >
              Add Your First Pairing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {value.map((pairing, index) => (
            <PairingCard
              key={index}
              pairing={pairing}
              onUpdate={(data) => updatePairing(index, data)}
              onRemove={() => removePairing(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
