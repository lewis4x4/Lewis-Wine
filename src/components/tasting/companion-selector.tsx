"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CompanionSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  recentCompanions?: string[];
  className?: string;
}

export function CompanionSelector({
  value,
  onChange,
  recentCompanions = [],
  className,
}: CompanionSelectorProps) {
  const [inputValue, setInputValue] = useState("");

  const addCompanion = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue("");
    }
  };

  const removeCompanion = (companion: string) => {
    onChange(value.filter((v) => v !== companion));
  };

  const toggleCompanion = (companion: string) => {
    if (value.includes(companion)) {
      removeCompanion(companion);
    } else {
      onChange([...value, companion]);
    }
  };

  // Get suggested companions (recent ones not already selected)
  const suggestions = recentCompanions.filter((c) => !value.includes(c));

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Label className="text-lg font-semibold">Who You Drank With</Label>
        <p className="text-sm text-muted-foreground">
          Add the people you shared this wine with
        </p>
      </div>

      {/* Selected companions */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          {value.map((companion) => (
            <Badge
              key={companion}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
              onClick={() => removeCompanion(companion)}
            >
              👤 {companion} &times;
            </Badge>
          ))}
        </div>
      )}

      {/* Quick select for common options */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleCompanion("Solo")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            value.includes("Solo")
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          😌 Solo
        </button>
        <button
          type="button"
          onClick={() => toggleCompanion("Partner")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            value.includes("Partner")
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          ❤️ Partner
        </button>
        <button
          type="button"
          onClick={() => toggleCompanion("Family")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            value.includes("Family")
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          👨‍👩‍👧 Family
        </button>
        <button
          type="button"
          onClick={() => toggleCompanion("Friends")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            value.includes("Friends")
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          👥 Friends
        </button>
        <button
          type="button"
          onClick={() => toggleCompanion("Wine Club")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            value.includes("Wine Club")
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          🍷 Wine Club
        </button>
        <button
          type="button"
          onClick={() => toggleCompanion("Colleagues")}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm transition-colors",
            value.includes("Colleagues")
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          💼 Colleagues
        </button>
      </div>

      {/* Add specific names */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a name (e.g., Sarah, John)..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCompanion();
            }
          }}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addCompanion}
          disabled={!inputValue.trim()}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition-colors",
            inputValue.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          Add
        </button>
      </div>

      {/* Recent companions suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Recent companions:
          </Label>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((companion) => (
              <button
                key={companion}
                type="button"
                onClick={() => toggleCompanion(companion)}
                className="px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-muted/80 transition-colors"
              >
                + {companion}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No companions added - drinking solo is perfectly fine!
        </p>
      )}
    </div>
  );
}
