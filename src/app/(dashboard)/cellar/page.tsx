"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useCellar, useCellarInventory, useUpdateInventory } from "@/lib/hooks/use-cellar";
import { useCellarValue } from "@/lib/hooks/use-portfolio-value";
import { WineCard } from "@/components/wine/wine-card";
import { AlertsDashboard } from "@/components/cellar/alerts-dashboard";
import { PortfolioDashboard } from "@/components/financial";
import { SearchFilter, filterAndSortWines, type FilterState, type SortState } from "@/components/cellar/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonWineCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LocationMode } from "@/types/database";

export default function CellarPage() {
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    regions: [],
    vintageMin: null,
    vintageMax: null,
    priceMin: null,
    priceMax: null,
    ratingMin: null,
  });
  const [sort, setSort] = useState<SortState>({ field: "date", direction: "desc" });

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

  // Get unique regions for filter dropdown
  const availableRegions = useMemo(() => {
    if (!inventory) return [];
    const regions = new Set<string>();
    inventory.forEach((wine) => {
      const region = wine.wine_reference?.region || wine.custom_region;
      if (region) regions.add(region);
    });
    return Array.from(regions).sort();
  }, [inventory]);

  // Apply filters and sort
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return filterAndSortWines(inventory as any, filters, sort);
  }, [inventory, filters, sort]);

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
          <h1 className="font-playfair text-3xl font-bold">Cellar</h1>
          <p className="text-muted-foreground">
            {cellar?.total_bottles || 0} bottles
            {cellar?.total_value_cents
              ? ` • ${formatCurrency(cellar.total_value_cents)}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cellar/history">
            <Button variant="ghost" size="sm">History</Button>
          </Link>
          <Link href="/scan">
            <Button variant="outline">Scan</Button>
          </Link>
          <Link href="/cellar/add">
            <Button>+ Add Wine</Button>
          </Link>
        </div>
      </div>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <CardTitle className="font-playfair text-2xl">Cellar operating view</CardTitle>
          <CardTitle className="sr-only">Cellar operating view</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What matters now</div>
            <p className="mt-2 text-sm text-foreground">
              {inventory?.length
                ? `${filteredInventory.length} bottle${filteredInventory.length === 1 ? "" : "s"} are in your current working view.`
                : "The cellar is still empty, so the next useful move is adding live bottles."}
            </p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next move</div>
            <p className="mt-2 text-sm text-foreground">
              {inventory?.some((w) => !w.ratings?.length)
                ? "Open the bottles with thin memory and start capturing tasting signal."
                : "Use filters to narrow by region, value, or readiness before deciding what matters tonight."}
            </p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operator shortcut</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/recommendations">
                <Button size="sm">Tonight Engine</Button>
              </Link>
              <Link href="/cellar/add">
                <Button size="sm" variant="outline">Add bottle</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Search & Filter */}
      {!isLoading && inventory && inventory.length > 0 && (
        <SearchFilter
          availableRegions={availableRegions}
          filters={filters}
          sort={sort}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          totalCount={inventory.length}
          filteredCount={filteredInventory.length}
        />
      )}

      {/* Wine List */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-14 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-16 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonWineCard key={i} />
            ))}
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
      ) : filteredInventory.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">🔍</div>
            <h2 className="mt-4 font-playfair text-xl font-semibold">
              No wines match your filters
            </h2>
            <p className="mt-2 text-muted-foreground text-center max-w-md">
              Try adjusting your search or filter criteria.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setFilters({
                search: "",
                regions: [],
                vintageMin: null,
                vintageMax: null,
                priceMin: null,
                priceMax: null,
                ratingMin: null,
              })}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filteredInventory.length})</TabsTrigger>
            {winesByType?.red && (
              <TabsTrigger value="red">Red ({winesByType.red.filter(w => filteredInventory.some(f => f.id === w.id)).length})</TabsTrigger>
            )}
            {winesByType?.white && (
              <TabsTrigger value="white">
                White ({winesByType.white.filter(w => filteredInventory.some(f => f.id === w.id)).length})
              </TabsTrigger>
            )}
            {winesByType?.sparkling && (
              <TabsTrigger value="sparkling">
                Sparkling ({winesByType.sparkling.filter(w => filteredInventory.some(f => f.id === w.id)).length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredInventory.map((wine) => (
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
                {wines?.filter(w => filteredInventory.some(f => f.id === w.id)).map((wine) => (
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
