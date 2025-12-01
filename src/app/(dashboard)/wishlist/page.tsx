"use client";

import { useState } from "react";
import Link from "next/link";
import { useWishlist, useUpdateWishlist, useDeleteWishlistItem, useWishlistStats } from "@/lib/hooks/use-wishlist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { WishlistWithWine, WishlistPriority } from "@/types/database";

const PRIORITY_COLORS: Record<WishlistPriority, string> = {
  "must-have": "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-gray-100 text-gray-800 border-gray-200",
};

const PRIORITY_LABELS: Record<WishlistPriority, string> = {
  "must-have": "Must Have",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function WishlistPage() {
  const [activeTab, setActiveTab] = useState<"active" | "purchased">("active");
  const { data: wishlist, isLoading } = useWishlist(activeTab);
  const { data: stats } = useWishlistStats();
  const updateWishlist = useUpdateWishlist();
  const deleteItem = useDeleteWishlistItem();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const handleMarkPurchased = async (item: WishlistWithWine) => {
    try {
      await updateWishlist.mutateAsync({
        id: item.id,
        status: "purchased",
        purchased_date: new Date().toISOString().split("T")[0],
      });
      toast.success(`Marked "${getWineName(item)}" as purchased!`);
    } catch {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async (item: WishlistWithWine) => {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success(`Removed "${getWineName(item)}" from wishlist`);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleChangePriority = async (item: WishlistWithWine, priority: WishlistPriority) => {
    try {
      await updateWishlist.mutateAsync({ id: item.id, priority });
      toast.success(`Updated priority to ${PRIORITY_LABELS[priority]}`);
    } catch {
      toast.error("Failed to update priority");
    }
  };

  const getWineName = (item: WishlistWithWine) => {
    return item.wine_reference?.name || item.custom_name || "Unknown Wine";
  };

  const getProducer = (item: WishlistWithWine) => {
    return item.wine_reference?.producer || item.custom_producer;
  };

  const getRegion = (item: WishlistWithWine) => {
    return item.wine_reference?.region || item.custom_region;
  };

  // Group by priority for active items
  const groupedByPriority = wishlist?.reduce(
    (acc, item) => {
      const priority = item.priority;
      if (!acc[priority]) acc[priority] = [];
      acc[priority].push(item);
      return acc;
    },
    {} as Record<WishlistPriority, WishlistWithWine[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Wishlist</h1>
          <p className="text-muted-foreground">
            {stats?.active || 0} wines to acquire
            {stats?.estimatedCost ? ` • Est. ${formatCurrency(stats.estimatedCost)}` : ""}
          </p>
        </div>
        <Link href="/wishlist/add">
          <Button>+ Add Wine</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Must Have"
          value={stats?.byPriority["must-have"]?.toString() || "0"}
          className="border-red-200"
        />
        <StatCard
          label="High Priority"
          value={stats?.byPriority.high?.toString() || "0"}
          className="border-orange-200"
        />
        <StatCard
          label="Medium Priority"
          value={stats?.byPriority.medium?.toString() || "0"}
          className="border-blue-200"
        />
        <StatCard
          label="Purchased"
          value={stats?.purchased?.toString() || "0"}
          className="border-green-200"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "purchased")}>
        <TabsList>
          <TabsTrigger value="active">Active ({stats?.active || 0})</TabsTrigger>
          <TabsTrigger value="purchased">Purchased ({stats?.purchased || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <LoadingState />
          ) : !wishlist?.length ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {(["must-have", "high", "medium", "low"] as WishlistPriority[]).map((priority) => {
                const items = groupedByPriority?.[priority];
                if (!items?.length) return null;
                return (
                  <div key={priority}>
                    <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Badge variant="outline" className={PRIORITY_COLORS[priority]}>
                        {PRIORITY_LABELS[priority]}
                      </Badge>
                      <span className="text-muted-foreground text-sm font-normal">
                        ({items.length})
                      </span>
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => (
                        <WishlistCard
                          key={item.id}
                          item={item}
                          onMarkPurchased={() => handleMarkPurchased(item)}
                          onDelete={() => handleDelete(item)}
                          onChangePriority={(p) => handleChangePriority(item, p)}
                          formatCurrency={formatCurrency}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchased" className="mt-4">
          {isLoading ? (
            <LoadingState />
          ) : !wishlist?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-4xl">🛒</div>
                <p className="mt-2 text-muted-foreground">No purchased wines yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((item) => (
                <WishlistCard
                  key={item.id}
                  item={item}
                  isPurchased
                  onDelete={() => handleDelete(item)}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WishlistCard({
  item,
  isPurchased,
  onMarkPurchased,
  onDelete,
  onChangePriority,
  formatCurrency,
}: {
  item: WishlistWithWine;
  isPurchased?: boolean;
  onMarkPurchased?: () => void;
  onDelete: () => void;
  onChangePriority?: (priority: WishlistPriority) => void;
  formatCurrency: (cents: number) => string;
}) {
  const wineName = item.wine_reference?.name || item.custom_name || "Unknown Wine";
  const producer = item.wine_reference?.producer || item.custom_producer;
  const region = item.wine_reference?.region || item.custom_region;
  const wineType = item.wine_reference?.wine_type || item.custom_wine_type;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <Link href={`/wishlist/${item.id}`} className="hover:underline">
              <h3 className="font-semibold truncate">{wineName}</h3>
            </Link>
            {producer && (
              <p className="text-sm text-muted-foreground truncate">{producer}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {region && (
                <span className="text-xs text-muted-foreground">{region}</span>
              )}
              {item.custom_vintage && (
                <span className="text-xs text-muted-foreground">{item.custom_vintage}</span>
              )}
              {wineType && (
                <Badge variant="secondary" className="text-xs capitalize">
                  {wineType}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                ...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isPurchased && (
                <>
                  <DropdownMenuItem onClick={onMarkPurchased}>
                    Mark as Purchased
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onChangePriority?.("must-have")}>
                    Priority: Must Have
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangePriority?.("high")}>
                    Priority: High
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangePriority?.("medium")}>
                    Priority: Medium
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangePriority?.("low")}>
                    Priority: Low
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Price Info */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div>
            {item.target_price_cents && (
              <div className="text-sm">
                <span className="text-muted-foreground">Target: </span>
                <span className="font-medium">{formatCurrency(item.target_price_cents)}</span>
              </div>
            )}
            {item.desired_quantity > 1 && (
              <div className="text-xs text-muted-foreground">
                Qty: {item.desired_quantity}
              </div>
            )}
          </div>
          {isPurchased && item.purchased_date && (
            <div className="text-right">
              <div className="text-sm text-green-600 font-medium">Purchased</div>
              <div className="text-xs text-muted-foreground">
                {new Date(item.purchased_date).toLocaleDateString()}
              </div>
            </div>
          )}
          {!isPurchased && (
            <Badge variant="outline" className={PRIORITY_COLORS[item.priority]}>
              {PRIORITY_LABELS[item.priority]}
            </Badge>
          )}
        </div>

        {/* Source */}
        {item.source && (
          <div className="mt-2 text-xs text-muted-foreground">
            Source: {item.source}
            {item.source_details && ` - ${item.source_details}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="text-4xl animate-pulse">🍷</div>
        <p className="mt-2 text-muted-foreground">Loading wishlist...</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl">📝</div>
        <h2 className="mt-4 font-playfair text-xl font-semibold">
          Your wishlist is empty
        </h2>
        <p className="mt-2 text-muted-foreground text-center max-w-md">
          Keep track of wines you want to buy. Add wines you discover at restaurants,
          from friends, or read about online.
        </p>
        <Link href="/wishlist/add" className="mt-6">
          <Button>+ Add Your First Wine</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
