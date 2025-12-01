"use client";

import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AromaNotes } from "@/types/database";

// Common aromas by category
const AROMA_CATEGORIES = {
  primary: {
    label: "Primary Aromas",
    description: "Aromas from the grape variety",
    subcategories: {
      fruit: {
        label: "Fruit",
        aromas: [
          "Cherry",
          "Raspberry",
          "Strawberry",
          "Blackberry",
          "Plum",
          "Cassis",
          "Blueberry",
          "Apple",
          "Pear",
          "Citrus",
          "Lemon",
          "Lime",
          "Grapefruit",
          "Peach",
          "Apricot",
          "Tropical Fruit",
          "Melon",
        ],
      },
      floral: {
        label: "Floral",
        aromas: ["Rose", "Violet", "Jasmine", "Orange Blossom", "Honeysuckle"],
      },
      herbal: {
        label: "Herbal",
        aromas: ["Green Bell Pepper", "Mint", "Eucalyptus", "Grass", "Herbs"],
      },
    },
  },
  secondary: {
    label: "Secondary Aromas",
    description: "Aromas from fermentation and oak",
    subcategories: {
      oak: {
        label: "Oak",
        aromas: [
          "Vanilla",
          "Toast",
          "Cedar",
          "Smoke",
          "Coconut",
          "Chocolate",
          "Coffee",
          "Caramel",
        ],
      },
      fermentation: {
        label: "Fermentation",
        aromas: ["Butter", "Cream", "Bread/Yeast", "Brioche"],
      },
    },
  },
  tertiary: {
    label: "Tertiary Aromas",
    description: "Aromas from bottle aging",
    subcategories: {
      aged: {
        label: "Aged",
        aromas: [
          "Leather",
          "Tobacco",
          "Earth",
          "Mushroom",
          "Dried Fruit",
          "Honey",
          "Nuts",
        ],
      },
      earth: {
        label: "Earth & Mineral",
        aromas: ["Mineral", "Wet Stone", "Petrol", "Sherry"],
      },
    },
  },
} as const;

type AromaCategory = "primary" | "secondary" | "tertiary";

interface AromaSelectorProps {
  value: AromaNotes;
  onChange: (value: AromaNotes) => void;
  className?: string;
}

export function AromaSelector({ value, onChange, className }: AromaSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<AromaCategory>("primary");
  const [searchQuery, setSearchQuery] = useState("");

  const toggleAroma = (category: AromaCategory, aroma: string) => {
    const currentAromas = value[category] || [];
    const isSelected = currentAromas.includes(aroma);

    const newAromas = isSelected
      ? currentAromas.filter((a) => a !== aroma)
      : [...currentAromas, aroma];

    onChange({
      ...value,
      [category]: newAromas.length > 0 ? newAromas : undefined,
    });
  };

  const removeAroma = (category: AromaCategory, aroma: string) => {
    const currentAromas = value[category] || [];
    const newAromas = currentAromas.filter((a) => a !== aroma);

    onChange({
      ...value,
      [category]: newAromas.length > 0 ? newAromas : undefined,
    });
  };

  const selectedCount = useMemo(() => {
    return (
      (value.primary?.length || 0) +
      (value.secondary?.length || 0) +
      (value.tertiary?.length || 0)
    );
  }, [value]);

  const filteredAromas = useMemo(() => {
    if (!searchQuery) return null;

    const query = searchQuery.toLowerCase();
    const results: { category: AromaCategory; aroma: string }[] = [];

    (Object.keys(AROMA_CATEGORIES) as AromaCategory[]).forEach((category) => {
      const subcategories = AROMA_CATEGORIES[category].subcategories;
      Object.values(subcategories).forEach((subcat: { label: string; aromas: readonly string[] }) => {
        subcat.aromas.forEach((aroma: string) => {
          if (aroma.toLowerCase().includes(query)) {
            results.push({ category, aroma });
          }
        });
      });
    });

    return results;
  }, [searchQuery]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-lg font-semibold">Aromas</Label>
          <p className="text-sm text-muted-foreground">
            Select the aromas you detected ({selectedCount} selected)
          </p>
        </div>
      </div>

      {/* Selected aromas display */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          {(["primary", "secondary", "tertiary"] as const).map((category) =>
            value[category]?.map((aroma) => (
              <Badge
                key={`${category}-${aroma}`}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => removeAroma(category, aroma)}
              >
                {aroma} &times;
              </Badge>
            ))
          )}
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Search aromas..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-xs"
      />

      {/* Search results */}
      {filteredAromas ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {filteredAromas.length} results for &quot;{searchQuery}&quot;
          </p>
          <div className="flex flex-wrap gap-2">
            {filteredAromas.map(({ category, aroma }) => {
              const isSelected = value[category]?.includes(aroma);
              return (
                <button
                  key={`${category}-${aroma}`}
                  type="button"
                  onClick={() => toggleAroma(category, aroma)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {aroma}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-2 border-b">
            {(Object.keys(AROMA_CATEGORIES) as AromaCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                  activeCategory === category
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {AROMA_CATEGORIES[category].label}
                {value[category]?.length ? ` (${value[category]?.length})` : ""}
              </button>
            ))}
          </div>

          {/* Category content */}
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {AROMA_CATEGORIES[activeCategory].description}
            </p>

            {Object.entries(AROMA_CATEGORIES[activeCategory].subcategories).map(
              ([subKey, subcat]: [string, { label: string; aromas: readonly string[] }]) => (
                <div key={subKey} className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {subcat.label}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {subcat.aromas.map((aroma: string) => {
                      const isSelected = value[activeCategory]?.includes(aroma);
                      return (
                        <button
                          key={aroma}
                          type="button"
                          onClick={() => toggleAroma(activeCategory, aroma)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          )}
                        >
                          {aroma}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
