"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useTrackGlasses } from "@/lib/hooks/use-portfolio-value";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PricePerGlassProps {
  inventoryId: string;
  bottlePrice: number | null; // in cents
  bottleSizeMl: number;
  isOpened: boolean;
  openedDate: string | null;
  glassesPoured: number;
  glassesPerBottle: number;
  onClose?: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// Standard pour is 5oz (148ml)
const STANDARD_POUR_ML = 148;

export function PricePerGlass({
  inventoryId,
  bottlePrice,
  bottleSizeMl,
  isOpened,
  openedDate,
  glassesPoured,
  glassesPerBottle,
  onClose,
}: PricePerGlassProps) {
  const [glasses, setGlasses] = useState(glassesPoured);
  const [totalGlasses, setTotalGlasses] = useState(glassesPerBottle);
  const trackGlasses = useTrackGlasses();

  // Calculate glasses from bottle size
  const calculatedGlasses = Math.floor(bottleSizeMl / STANDARD_POUR_ML);

  // Price per glass
  const pricePerGlass = bottlePrice && totalGlasses > 0
    ? bottlePrice / totalGlasses
    : null;

  // Cost of glasses poured so far
  const costPoured = pricePerGlass
    ? pricePerGlass * glasses
    : null;

  // Remaining value in bottle
  const remainingValue = pricePerGlass && bottlePrice
    ? bottlePrice - (pricePerGlass * glasses)
    : null;

  // Percentage consumed
  const percentConsumed = totalGlasses > 0
    ? (glasses / totalGlasses) * 100
    : 0;

  const handlePourGlass = async () => {
    const newCount = glasses + 1;
    setGlasses(newCount);

    try {
      await trackGlasses.mutateAsync({
        inventoryId,
        glassesPoured: newCount,
        isOpened: true,
      });
      toast.success("Glass poured!");
    } catch {
      setGlasses(glasses); // Revert
      toast.error("Failed to track glass");
    }
  };

  const handleUpdateGlasses = async () => {
    try {
      await trackGlasses.mutateAsync({
        inventoryId,
        glassesPoured: glasses,
        isOpened: glasses > 0,
      });
      toast.success("Updated");
      onClose?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Price Per Glass</span>
          {isOpened && (
            <Badge variant="secondary" className="text-xs">
              Opened {openedDate ? new Date(openedDate).toLocaleDateString() : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visual bottle representation */}
        <div className="relative h-48 w-12 mx-auto bg-muted rounded-b-full rounded-t-lg overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 bg-wine-600 transition-all duration-300"
            style={{ height: `${100 - percentConsumed}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm drop-shadow">
              {Math.round(100 - percentConsumed)}%
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-2xl font-bold">{glasses}</div>
            <div className="text-xs text-muted-foreground">Poured</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-2xl font-bold">{totalGlasses - glasses}</div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-2xl font-bold">{totalGlasses}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>

        {/* Price breakdown */}
        {bottlePrice && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bottle Cost</span>
              <span className="font-medium">{formatCurrency(bottlePrice)}</span>
            </div>
            {pricePerGlass && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price Per Glass</span>
                <span className="font-medium">{formatCurrency(pricePerGlass)}</span>
              </div>
            )}
            {costPoured !== null && costPoured > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cost Poured</span>
                <span className="font-medium text-orange-600">{formatCurrency(costPoured)}</span>
              </div>
            )}
            {remainingValue !== null && (
              <div className="flex justify-between text-sm border-t pt-2 mt-2">
                <span className="text-muted-foreground">Remaining Value</span>
                <span className="font-bold">{formatCurrency(remainingValue)}</span>
              </div>
            )}
          </div>
        )}

        {/* Pour a glass button */}
        <Button
          onClick={handlePourGlass}
          className="w-full"
          size="lg"
          disabled={glasses >= totalGlasses || trackGlasses.isPending}
        >
          {trackGlasses.isPending ? "Pouring..." : "Pour a Glass 🍷"}
        </Button>

        {/* Manual adjustment */}
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label>Adjust Glasses Poured</Label>
            <Slider
              value={[glasses]}
              onValueChange={([v]) => setGlasses(v)}
              min={0}
              max={totalGlasses}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{glasses} glasses</span>
              <span>{totalGlasses}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total-glasses">Glasses Per Bottle</Label>
            <div className="flex items-center gap-2">
              <Input
                id="total-glasses"
                type="number"
                min={1}
                max={20}
                value={totalGlasses}
                onChange={(e) => setTotalGlasses(parseInt(e.target.value) || calculatedGlasses)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                (Standard: {calculatedGlasses} for {bottleSizeMl}ml)
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleUpdateGlasses}
              disabled={trackGlasses.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
