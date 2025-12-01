"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUpdateMarketValue } from "@/lib/hooks/use-portfolio-value";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MarketValueSource } from "@/types/database";

interface MarketValueEditorProps {
  inventoryId: string;
  currentValue: number | null;
  purchasePrice: number | null;
  source: MarketValueSource | null;
  lastUpdated: string | null;
  onClose?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const SOURCE_LABELS: Record<MarketValueSource, string> = {
  manual: "Manual Entry",
  "wine-searcher": "Wine-Searcher",
  vivino: "Vivino",
  estimate: "Estimate",
};

export function MarketValueEditor({
  inventoryId,
  currentValue,
  purchasePrice,
  source,
  lastUpdated,
  onClose,
}: MarketValueEditorProps) {
  const [value, setValue] = useState(currentValue ? (currentValue / 100).toString() : "");
  const [selectedSource, setSelectedSource] = useState<MarketValueSource>(source || "manual");
  const updateMarketValue = useUpdateMarketValue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cents = Math.round(parseFloat(value) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    try {
      await updateMarketValue.mutateAsync({
        inventoryId,
        valueCents: cents,
        source: selectedSource,
      });
      toast.success("Market value updated");
      onClose?.();
    } catch {
      toast.error("Failed to update market value");
    }
  };

  const gainLoss = currentValue && purchasePrice
    ? currentValue - purchasePrice
    : null;
  const gainLossPercentage = gainLoss && purchasePrice
    ? (gainLoss / purchasePrice) * 100
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Market Value</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current values display */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground">Purchase Price</div>
            <div className="font-medium">
              {purchasePrice ? formatCurrency(purchasePrice) : "Not set"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Current Value</div>
            <div className="font-medium">
              {currentValue ? formatCurrency(currentValue) : "Not set"}
            </div>
          </div>
        </div>

        {/* Gain/Loss display */}
        {gainLoss !== null && (
          <div className={cn(
            "p-3 rounded-lg text-center",
            gainLoss >= 0 ? "bg-green-50" : "bg-red-50"
          )}>
            <div className={cn(
              "text-lg font-bold",
              gainLoss >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {gainLoss >= 0 ? "+" : ""}{formatCurrency(gainLoss)}
            </div>
            {gainLossPercentage !== null && (
              <div className={cn(
                "text-sm",
                gainLoss >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {gainLossPercentage >= 0 ? "+" : ""}{gainLossPercentage.toFixed(1)}%
              </div>
            )}
          </div>
        )}

        {/* Source and last updated */}
        {source && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {SOURCE_LABELS[source]}
            </Badge>
            {lastUpdated && (
              <span>
                Updated {new Date(lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* Edit form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t">
          <div className="space-y-2">
            <Label htmlFor="market-value">Update Market Value</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="market-value"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Source</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SOURCE_LABELS) as MarketValueSource[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSource(s)}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm transition-colors",
                    selectedSource === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={updateMarketValue.isPending}>
              {updateMarketValue.isPending ? "Saving..." : "Update Value"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
