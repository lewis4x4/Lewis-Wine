"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Default occasion presets
const DEFAULT_OCCASIONS = [
  { slug: "weeknight-dinner", name: "Weeknight Dinner", icon: "🍽️" },
  { slug: "weekend-dinner", name: "Weekend Dinner", icon: "🍷" },
  { slug: "date-night", name: "Date Night", icon: "❤️" },
  { slug: "dinner-party", name: "Dinner Party", icon: "🎉" },
  { slug: "celebration", name: "Special Celebration", icon: "🥂" },
  { slug: "anniversary", name: "Anniversary", icon: "💕" },
  { slug: "birthday", name: "Birthday", icon: "🎂" },
  { slug: "holiday", name: "Holiday", icon: "🎄" },
  { slug: "wine-tasting", name: "Wine Tasting", icon: "🍇" },
  { slug: "solo", name: "Solo Enjoyment", icon: "😌" },
  { slug: "business", name: "Business Dinner", icon: "💼" },
  { slug: "casual", name: "Casual Gathering", icon: "👋" },
];

interface OccasionSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  venue?: string | null;
  onVenueChange?: (venue: string | null) => void;
  className?: string;
}

export function OccasionSelector({
  value,
  onChange,
  venue,
  onVenueChange,
  className,
}: OccasionSelectorProps) {
  const [customOccasion, setCustomOccasion] = useState("");

  const toggleOccasion = (slug: string) => {
    const isSelected = value.includes(slug);
    if (isSelected) {
      onChange(value.filter((v) => v !== slug));
    } else {
      onChange([...value, slug]);
    }
  };

  const addCustomOccasion = () => {
    if (customOccasion.trim() && !value.includes(customOccasion.trim())) {
      onChange([...value, customOccasion.trim()]);
      setCustomOccasion("");
    }
  };

  const removeOccasion = (occasion: string) => {
    onChange(value.filter((v) => v !== occasion));
  };

  // Separate default and custom occasions
  const defaultSlugs = DEFAULT_OCCASIONS.map((o) => o.slug);
  const customOccasions = value.filter((v) => !defaultSlugs.includes(v));

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label className="text-lg font-semibold">Occasion</Label>
        <p className="text-sm text-muted-foreground">
          What was the occasion for this wine?
        </p>
      </div>

      {/* Selected occasions */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((occasion) => {
            const preset = DEFAULT_OCCASIONS.find((o) => o.slug === occasion);
            return (
              <Badge
                key={occasion}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => removeOccasion(occasion)}
              >
                {preset ? `${preset.icon} ${preset.name}` : occasion} &times;
              </Badge>
            );
          })}
        </div>
      )}

      {/* Default occasions grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {DEFAULT_OCCASIONS.map((occasion) => {
          const isSelected = value.includes(occasion.slug);
          return (
            <button
              key={occasion.slug}
              type="button"
              onClick={() => toggleOccasion(occasion.slug)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <span>{occasion.icon}</span>
              <span className="truncate">{occasion.name}</span>
            </button>
          );
        })}
      </div>

      {/* Custom occasion input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add custom occasion..."
          value={customOccasion}
          onChange={(e) => setCustomOccasion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomOccasion();
            }
          }}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addCustomOccasion}
          disabled={!customOccasion.trim()}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            customOccasion.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          Add
        </button>
      </div>

      {/* Custom occasions display */}
      {customOccasions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Custom occasions:
          </Label>
          <div className="flex flex-wrap gap-2">
            {customOccasions.map((occasion) => (
              <Badge
                key={occasion}
                variant="outline"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                onClick={() => removeOccasion(occasion)}
              >
                {occasion} &times;
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Venue input */}
      {onVenueChange && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-sm font-medium">Venue / Location</Label>
          <Input
            placeholder="Where did you enjoy this wine? (e.g., Home, Restaurant name)"
            value={venue || ""}
            onChange={(e) => onVenueChange(e.target.value || null)}
          />
        </div>
      )}
    </div>
  );
}
