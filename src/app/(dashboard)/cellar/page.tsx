"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useCellar, useCellarInventory, useUpdateInventory } from "@/lib/hooks/use-cellar";
import { getBrianFitForRatings, useBrianTasteProfile } from "@/lib/hooks/use-brian-fit";
import { buildCellarCommandCenter } from "@/lib/cellar-command-center";
import { isWineReadyNow } from "@/lib/wine-readiness";
import { useCellarValue } from "@/lib/hooks/use-portfolio-value";
import { WineCard, type WineCardInventory } from "@/components/wine/wine-card";
import { AlertsDashboard } from "@/components/cellar/alerts-dashboard";
import { CellarCommandCenter } from "@/components/cellar/cellar-command-center";
import { PortfolioDashboard } from "@/components/financial";
import { SearchFilter, filterAndSortWines, type FilterState, type SortState } from "@/components/cellar/search-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonWineCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LocationMode } from "@/types/database";
import type { BrianFitSummary } from "@/lib/brian-fit";

type BrianFitWineInventory = WineCardInventory & {
  brian_fit?: BrianFitSummary | null;
  brian_fit_score?: number | null;
};

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
  const { data: brianTasteProfile } = useBrianTasteProfile();
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

  const inventoryWithBrianFit = useMemo<BrianFitWineInventory[]>(() => {
    if (!inventory) return [];

    return inventory.map((wine) => {
      const brianFit = getBrianFitForRatings({
        profile: brianTasteProfile,
        ratings: wine.ratings,
      });

      return {
        ...(wine as WineCardInventory),
        brian_fit: brianFit,
        brian_fit_score: brianFit?.score ?? null,
      };
    });
  }, [brianTasteProfile, inventory]);

  const commandCenter = useMemo(() => {
    return buildCellarCommandCenter(
      inventoryWithBrianFit.map((wine) => ({
        id: wine.id,
        name: wine.wine_reference?.name,
        custom_name: wine.custom_name,
        producer: wine.wine_reference?.producer,
        custom_producer: wine.custom_producer,
        region: wine.wine_reference?.region,
        custom_region: wine.custom_region,
        vintage: wine.vintage,
        custom_vintage: wine.custom_vintage,
        quantity: wine.quantity,
        drink_after: wine.drink_after,
        drink_before: wine.drink_before,
        purchase_price_cents: wine.purchase_price_cents,
        current_market_value_cents: wine.current_market_value_cents,
        low_stock_threshold: wine.low_stock_threshold,
        low_stock_alert_enabled: wine.low_stock_alert_enabled,
        ratings_count: wine.ratings?.length ?? 0,
        brian_fit_score: wine.brian_fit?.score ?? null,
        brian_fit_confidence: wine.brian_fit?.confidence ?? null,
        brian_fit_reason: wine.brian_fit?.reason ?? null,
        tags: wine.tags,
        created_at: wine.created_at,
      }))
    );
  }, [inventoryWithBrianFit]);

  // Get unique regions for filter dropdown
  const availableRegions = useMemo(() => {
    if (!inventoryWithBrianFit.length) return [];
    const regions = new Set<string>();
    inventoryWithBrianFit.forEach((wine) => {
      const region = wine.wine_reference?.region || wine.custom_region;
      if (region) regions.add(region);
    });
    return Array.from(regions).sort();
  }, [inventoryWithBrianFit]);

  // Apply filters and sort
  const filteredInventory = useMemo(() => {
    if (!inventoryWithBrianFit.length) return [];
    return filterAndSortWines(inventoryWithBrianFit, filters, sort);
  }, [inventoryWithBrianFit, filters, sort]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Group wines by type
  const winesByType = inventoryWithBrianFit.reduce(
    (acc, wine) => {
      const type = wine.wine_reference?.wine_type || "other";
      if (!acc[type]) acc[type] = [];
      acc[type].push(wine);
      return acc;
    },
    {} as Record<string, BrianFitWineInventory[]>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 px-8 py-8 shadow-[0_20px_60px_-40px_rgba(120,24,40,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Private collection
            </div>
            <div className="space-y-2">
              <h1 className="font-playfair text-5xl font-semibold tracking-tight text-foreground">Cellar</h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                {inventory?.length
                  ? `A live view of ${cellar?.total_bottles || 0} bottles, ${formatCurrency(cellar?.total_value_cents || 0)} in cellar value, and the next decisions worth making.`
                  : "Your private collection starts here, with clean bottle records and better decisions over time."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/cellar/history">
              <Button variant="ghost" size="sm" className="h-11 rounded-full px-5 text-sm">History</Button>
            </Link>
            <Link href="/scan">
              <Button variant="outline" className="h-11 rounded-full px-5">Scan</Button>
            </Link>
            <Link href="/cellar/add">
              <Button className="h-11 rounded-full px-6">Add bottle</Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="rounded-3xl border border-border/60 bg-background/88 p-6 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Collection brief</div>
            <p className="mt-4 text-2xl font-medium leading-tight text-foreground">
              {inventory?.length
                ? `${filteredInventory.length} bottles are in your current working set.`
                : "The collection is empty, so the first move is getting real bottles into the system."}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {inventory?.some((w) => !w.ratings?.length)
                ? "The biggest gap is thin memory. The best upgrade now is capturing tasting signal on bottles that already matter."
                : "The cellar has enough structure now that tonight's decision quality can become the focus."}
            </p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-background/88 p-6 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Best next move</div>
            <p className="mt-4 text-lg font-medium leading-8 text-foreground">
              {inventory?.some((w) => !w.ratings?.length)
                ? "Open the bottles with thin memory and capture the first real note."
                : "Use filters, value, and readiness to narrow the field before tonight's pick."}
            </p>
          </div>
          <div className="rounded-3xl border border-border/60 bg-background/88 p-6 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Shortcut</div>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/recommendations">
                <Button className="h-11 w-full rounded-full">Open Tonight Engine</Button>
              </Link>
              <Link href="/cellar/add">
                <Button variant="outline" className="h-11 w-full rounded-full">Add bottle</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {!isLoading && inventory && inventory.length > 0 && (
        <CellarCommandCenter center={commandCenter} />
      )}

      {/* Stats Cards with Financial Summary */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total bottles"
          value={cellar?.total_bottles?.toString() || "0"}
          tone="primary"
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
          label="Ready now"
          value={inventory?.filter((w) => isWineReadyNow(w)).length.toString() || "0"}
          tone="success"
        />
        <StatCard
          label="Rated bottles"
          value={inventory?.filter((w) => w.ratings?.length > 0).length.toString() || "0"}
          tone="muted"
        />
      </div>

      {/* Portfolio Dashboard (collapsible) */}
      {showPortfolio && (
        <Card className="rounded-[28px] border border-border/60 bg-background/96 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="tracking-tight">Portfolio analytics</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowPortfolio(false)} className="rounded-full px-4">
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <PortfolioDashboard />
          </CardContent>
        </Card>
      )}

      {/* Alerts Dashboard */}
      <div className="rounded-[28px] border border-border/60 bg-background/96 p-1 shadow-sm">
        <AlertsDashboard />
      </div>

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
        <Card className="rounded-[28px] border border-border/60 bg-background/96 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Collection start
            </div>
            <h2 className="mt-5 font-playfair text-3xl font-semibold tracking-tight">
              Your cellar is empty
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Start with a clean first bottle record, then let the system build memory and better decisions around it.
            </p>
            <div className="mt-7 flex gap-3">
              <Link href="/scan">
                <Button variant="outline" className="rounded-full px-5">Scan bottle</Button>
              </Link>
              <Link href="/cellar/add">
                <Button className="rounded-full px-5">Add bottle</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : filteredInventory.length === 0 ? (
        <Card className="rounded-[28px] border border-border/60 bg-background/96 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="rounded-full border border-border/60 bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Filter reset
            </div>
            <h2 className="mt-5 font-playfair text-3xl font-semibold tracking-tight">
              No bottles match this view
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Widen the search or clear filters to get back to a useful collection slice.
            </p>
            <Button
              variant="outline"
              className="mt-6 rounded-full px-5"
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
                  wine={wine}
                  brianFit={wine.brian_fit}
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
                    wine={wine}
                    brianFit={wine.brian_fit}
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
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "primary" | "success" | "muted";
}) {
  const toneClass = tone === "primary"
    ? "bg-primary/10 text-primary"
    : tone === "success"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-muted text-muted-foreground";

  return (
    <Card className="overflow-hidden rounded-3xl border border-border/60 shadow-sm">
      <CardContent className="p-6">
        <div className={cn("mb-5 h-2 w-16 rounded-full", toneClass)} />
        <p className="text-4xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
