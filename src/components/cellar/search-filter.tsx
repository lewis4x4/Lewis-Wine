"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortOption = "name" | "date" | "rating" | "value" | "vintage" | "brianFit";
export type SortDirection = "asc" | "desc";

export interface FilterState {
  search: string;
  regions: string[];
  vintageMin: number | null;
  vintageMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  ratingMin: number | null;
}

export interface SortState {
  field: SortOption;
  direction: SortDirection;
}

interface SearchFilterProps {
  availableRegions: string[];
  filters: FilterState;
  sort: SortState;
  onFiltersChange: (filters: FilterState) => void;
  onSortChange: (sort: SortState) => void;
  totalCount: number;
  filteredCount: number;
}

const defaultFilters: FilterState = {
  search: "",
  regions: [],
  vintageMin: null,
  vintageMax: null,
  priceMin: null,
  priceMax: null,
  ratingMin: null,
};

export function SearchFilter({
  availableRegions,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  totalCount,
  filteredCount,
}: SearchFilterProps) {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== "" ||
      filters.regions.length > 0 ||
      filters.vintageMin !== null ||
      filters.vintageMax !== null ||
      filters.priceMin !== null ||
      filters.priceMax !== null ||
      filters.ratingMin !== null
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.regions.length > 0) count++;
    if (filters.vintageMin || filters.vintageMax) count++;
    if (filters.priceMin || filters.priceMax) count++;
    if (filters.ratingMin) count++;
    return count;
  }, [filters]);

  const clearFilters = useCallback(() => {
    onFiltersChange(defaultFilters);
  }, [onFiltersChange]);

  const toggleRegion = useCallback(
    (region: string) => {
      const newRegions = filters.regions.includes(region)
        ? filters.regions.filter((r) => r !== region)
        : [...filters.regions, region];
      onFiltersChange({ ...filters, regions: newRegions });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="space-y-4">
      {/* Search Bar Row */}
      <div className="rounded-[24px] border border-border/60 bg-background/88 p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search wines..."
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="h-12 rounded-full border-border/60 bg-background pl-10 text-base shadow-none"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="relative h-12 w-12 rounded-full border-border/60"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {/* Sort Dropdown */}
        <Select
          value={`${sort.field}-${sort.direction}`}
          onValueChange={(value) => {
            const [field, direction] = value.split("-") as [SortOption, SortDirection];
            onSortChange({ field, direction });
          }}
        >
          <SelectTrigger className="h-12 w-full rounded-full border-border/60 lg:w-[190px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="rating-desc">Highest Rated</SelectItem>
            <SelectItem value="brianFit-desc">Best Brian-Fit</SelectItem>
            <SelectItem value="value-desc">Highest Value</SelectItem>
            <SelectItem value="vintage-desc">Newest Vintage</SelectItem>
            <SelectItem value="vintage-asc">Oldest Vintage</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="animate-in slide-in-from-top-2 space-y-4 rounded-[24px] border border-border/60 bg-background/88 p-5 shadow-sm duration-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Region Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Region
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {filters.regions.length > 0
                      ? `${filters.regions.length} selected`
                      : "All regions"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
                  <DropdownMenuLabel>Regions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableRegions.map((region) => (
                    <DropdownMenuCheckboxItem
                      key={region}
                      checked={filters.regions.includes(region)}
                      onCheckedChange={() => toggleRegion(region)}
                    >
                      {region}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Vintage Range */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Vintage
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="From"
                  value={filters.vintageMin || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      vintageMin: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="To"
                  value={filters.vintageMax || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      vintageMax: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Price
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="$Min"
                  value={filters.priceMin || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      priceMin: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="$Max"
                  value={filters.priceMax || ""}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      priceMax: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Min Rating
              </label>
              <Select
                value={filters.ratingMin?.toString() || "any"}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    ratingMin: value === "any" ? null : parseInt(value),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any rating</SelectItem>
                  <SelectItem value="95">95+ Exceptional</SelectItem>
                  <SelectItem value="90">90+ Outstanding</SelectItem>
                  <SelectItem value="85">85+ Very Good</SelectItem>
                  <SelectItem value="80">80+ Good</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/60 bg-background/88 px-4 py-3 shadow-sm">
          <span className="text-sm text-muted-foreground">
            {filteredCount} of {totalCount} bottles
          </span>
          {filters.regions.map((region) => (
            <Badge key={region} variant="secondary" className="gap-1">
              {region}
              <button
                onClick={() => toggleRegion(region)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {(filters.vintageMin || filters.vintageMax) && (
            <Badge variant="secondary" className="gap-1">
              Vintage: {filters.vintageMin || "Any"} - {filters.vintageMax || "Any"}
              <button
                onClick={() =>
                  onFiltersChange({ ...filters, vintageMin: null, vintageMax: null })
                }
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(filters.priceMin || filters.priceMax) && (
            <Badge variant="secondary" className="gap-1">
              ${filters.priceMin || 0} - ${filters.priceMax || "Any"}
              <button
                onClick={() =>
                  onFiltersChange({ ...filters, priceMin: null, priceMax: null })
                }
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.ratingMin && (
            <Badge variant="secondary" className="gap-1">
              {filters.ratingMin}+ Rating
              <button
                onClick={() => onFiltersChange({ ...filters, ratingMin: null })}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to filter and sort wines
export function filterAndSortWines<T extends {
  id: string;
  quantity: number;
  vintage?: number | null;
  purchase_price_cents?: number | null;
  current_market_value_cents?: number | null;
  created_at: string;
  wine_reference?: {
    name: string;
    producer?: string | null;
    region?: string | null;
  } | null;
  custom_name?: string | null;
  custom_producer?: string | null;
  custom_region?: string | null;
  ratings?: { score: number }[];
  brian_fit_score?: number | null;
}>(
  wines: T[],
  filters: FilterState,
  sort: SortState
): T[] {
  const filtered = wines.filter((wine) => {
    const name = wine.wine_reference?.name || wine.custom_name || "";
    const producer = wine.wine_reference?.producer || wine.custom_producer || "";
    const region = wine.wine_reference?.region || wine.custom_region || "";
    const vintage = wine.vintage;
    const price = (wine.current_market_value_cents || wine.purchase_price_cents || 0) / 100;
    const rating = wine.ratings?.[0]?.score;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (
        !name.toLowerCase().includes(searchLower) &&
        !producer.toLowerCase().includes(searchLower) &&
        !region.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Region filter
    if (filters.regions.length > 0 && !filters.regions.includes(region)) {
      return false;
    }

    // Vintage filter
    if (filters.vintageMin && (!vintage || vintage < filters.vintageMin)) {
      return false;
    }
    if (filters.vintageMax && (!vintage || vintage > filters.vintageMax)) {
      return false;
    }

    // Price filter
    if (filters.priceMin && price < filters.priceMin) {
      return false;
    }
    if (filters.priceMax && price > filters.priceMax) {
      return false;
    }

    // Rating filter
    if (filters.ratingMin && (!rating || rating < filters.ratingMin)) {
      return false;
    }

    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;

    switch (sort.field) {
      case "name": {
        const nameA = a.wine_reference?.name || a.custom_name || "";
        const nameB = b.wine_reference?.name || b.custom_name || "";
        return nameA.localeCompare(nameB) * direction;
      }
      case "date": {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction;
      }
      case "rating": {
        const ratingA = a.ratings?.[0]?.score || 0;
        const ratingB = b.ratings?.[0]?.score || 0;
        return (ratingA - ratingB) * direction;
      }
      case "brianFit": {
        const fitA = a.brian_fit_score || 0;
        const fitB = b.brian_fit_score || 0;
        return (fitA - fitB) * direction;
      }
      case "value": {
        const valueA = a.current_market_value_cents || a.purchase_price_cents || 0;
        const valueB = b.current_market_value_cents || b.purchase_price_cents || 0;
        return (valueA - valueB) * direction;
      }
      case "vintage": {
        const vintageA = a.vintage || 0;
        const vintageB = b.vintage || 0;
        return (vintageA - vintageB) * direction;
      }
      default:
        return 0;
    }
  });

  return filtered;
}
