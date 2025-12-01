"use client";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface RatingInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function RatingInput({ value, onChange, className }: RatingInputProps) {
  const getColor = (score: number) => {
    if (score >= 95) return "text-purple-600";
    if (score >= 90) return "text-green-600";
    if (score >= 85) return "text-blue-600";
    if (score >= 80) return "text-yellow-600";
    return "text-gray-500";
  };

  const getLabel = (score: number) => {
    if (score >= 95) return "Exceptional";
    if (score >= 90) return "Outstanding";
    if (score >= 85) return "Very Good";
    if (score >= 80) return "Good";
    if (score >= 70) return "Average";
    return "Below Average";
  };

  const getBgColor = (score: number) => {
    if (score >= 95) return "bg-purple-50";
    if (score >= 90) return "bg-green-50";
    if (score >= 85) return "bg-blue-50";
    if (score >= 80) return "bg-yellow-50";
    return "bg-gray-50";
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rating</span>
        <div
          className={cn(
            "text-right px-4 py-2 rounded-lg transition-colors",
            getBgColor(value)
          )}
        >
          <span className={cn("text-4xl font-bold tabular-nums", getColor(value))}>
            {value}
          </span>
          <span className="text-sm text-muted-foreground ml-1">/100</span>
          <p className={cn("text-sm font-medium", getColor(value))}>
            {getLabel(value)}
          </p>
        </div>
      </div>

      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={50}
        max={100}
        step={1}
        className="py-4"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>50</span>
        <span>70</span>
        <span>80</span>
        <span>85</span>
        <span>90</span>
        <span>95</span>
        <span>100</span>
      </div>

      {/* Quick select buttons */}
      <div className="flex flex-wrap gap-2">
        {[75, 80, 85, 88, 90, 92, 95].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium transition-colors",
              value === score
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
