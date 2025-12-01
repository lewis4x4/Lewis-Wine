"use client";

import { useState } from "react";
import Link from "next/link";
import { useCellar, useCellarInventory, useUpdateInventory } from "@/lib/hooks/use-cellar";
import { useCellarValue } from "@/lib/hooks/use-portfolio-value";
import { WineCard } from "@/components/wine/wine-card";
import { AlertsDashboard } from "@/components/cellar/alerts-dashboard";
import { PortfolioDashboard } from "@/components/financial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { LocationMode } from "@/types/database";

export default function CellarPage() {
  const [showPortfolio, setShowPortfolio] = useState(false);
  const { data: cellar, isLoading: cellarLoading } = useCellar();
  const { data: inventory, isLoading: inventoryLoading } = useCellarInventory();
  const { data: cellarValue } = useCellarValue();
  const updateInventory = useUpdateInventory();
  const locationMode: LocationMode = (cellar?.location_mode as LocationMode) || "simple";

  const handleQuantityChange = (id: string, delta: number) => {
    const wine = inventory?.find((w) => w.id === id);
    if (!wine) return;

    const newQuantity = Math.max(0, wine.quantity + delta);
    updateInventory.mutate({ id, quantity: newQuantity });
  };

  const isLoading = cellarLoading || inventoryLoading;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Group wines by type
  const winesByType = inventory?.reduce(
    (acc, wine) => {
      const type = wine.wine_reference?.wine_type || "other";
      if (!acc[type]) acc[type] = [];
      acc[type].push(wine);
      return acc;
    },
    {} as Record<string, typeof inventory>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">My Cellar</h1>
          <p className="text-muted-foreground">
            {cellar?.total_bottles || 0} bottles
            {cellar?.total_value_cents
              ? ` • ${formatCurrency(cellar.total_value_cents)}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/scan">
            <Button variant="outline">📱 Scan</Button>
          </Link>
          <Link href="/cellar/add">
            <Button>+ Add Wine</Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards with Financial Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Total Bottles"
          value={cellar?.total_bottles?.toString() || "0"}
          icon="🍾"
        />
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowPortfolio(!showPortfolio)}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="text-3xl">💰</div>
            <div className="flex-1">
              <p className="text-2xl font-bold">
                {cellarValue?.total_market_cents
                  ? formatCurrency(cellarValue.total_market_cents)
                  : formatCurrency(cellar?.total_value_cents || 0)}
              </p>
              <p className="text-sm text-muted-foreground">Market Value</p>
            </div>
            {cellarValue?.gain_loss_cents !== undefined && cellarValue.gain_loss_cents !== 0 && (
              <div className={cn(
                "text-right",
                cellarValue.gain_loss_cents >= 0 ? "text-green-600" : "text-red-600"
              )}>
                <div className="text-sm font-medium">
                  {cellarValue.gain_loss_cents >= 0 ? "+" : ""}
                  {formatCurrency(cellarValue.gain_loss_cents)}
                </div>
                <div className="text-xs">
                  {cellarValue.gain_loss_percentage >= 0 ? "+" : ""}
                  {cellarValue.gain_loss_percentage.toFixed(1)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <StatCard
          label="Ready to Drink"
          value={inventory?.filter((w) => {
            if (!w.drink_after && !w.drink_before) return true;
            const now = new Date();
            const after = w.drink_after ? new Date(w.drink_after) : null;
            const before = w.drink_before ? new Date(w.drink_before) : null;
            return (!after || now >= after) && (!before || now <= before);
          }).length.toString() || "0"}
          icon="✅"
        />
        <StatCard
          label="Wines Rated"
          value={inventory?.filter((w) => w.ratings?.length > 0).length.toString() || "0"}
          icon="⭐"
        />
      </div>

      {/* Portfolio Dashboard (collapsible) */}
      {showPortfolio && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Portfolio Analytics</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowPortfolio(false)}>
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <PortfolioDashboard />
          </CardContent>
        </Card>
      )}

      {/* Alerts Dashboard */}
      <AlertsDashboard />

      {/* Wine List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-4xl animate-pulse">🍷</div>
            <p className="mt-2 text-muted-foreground">Loading your cellar...</p>
          </div>
        </div>
      ) : !inventory?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">🍷</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">
              Your cellar is empty
            </h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Start building your collection by scanning a wine barcode or adding
              one manually.
            </p>
            <div className="mt-6 flex gap-2">
              <Link href="/scan">
                <Button variant="outline">📱 Scan Wine</Button>
              </Link>
              <Link href="/cellar/add">
                <Button>+ Add Manually</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({inventory.length})</TabsTrigger>
            {winesByType?.red && (
              <TabsTrigger value="red">Red ({winesByType.red.length})</TabsTrigger>
            )}
            {winesByType?.white && (
              <TabsTrigger value="white">
                White ({winesByType.white.length})
              </TabsTrigger>
            )}
            {winesByType?.sparkling && (
              <TabsTrigger value="sparkling">
                Sparkling ({winesByType.sparkling.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inventory.map((wine) => (
                <WineCard
                  key={wine.id}
                  wine={wine as any}
                  locationMode={locationMode}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
            </div>
          </TabsContent>

          {Object.entries(winesByType || {}).map(([type, wines]) => (
            <TabsContent key={type} value={type} className="mt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {wines?.map((wine) => (
                  <WineCard
                    key={wine.id}
                    wine={wine as any}
                    locationMode={locationMode}
                    onQuantityChange={handleQuantityChange}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="text-3xl">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
