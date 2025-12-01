"use client";

import { useState } from "react";
import Link from "next/link";
import { useShoppingList, useUpdateShoppingList, useDeleteShoppingItem, useShoppingListStats } from "@/lib/hooks/use-shopping-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ShoppingListWithWine, ShoppingUrgency } from "@/types/database";

const URGENCY_COLORS: Record<ShoppingUrgency, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-gray-100 text-gray-800 border-gray-200",
};

const URGENCY_LABELS: Record<ShoppingUrgency, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export default function ShoppingListPage() {
  const [activeTab, setActiveTab] = useState<"active" | "purchased">("active");
  const { data: shoppingList, isLoading } = useShoppingList(activeTab);
  const { data: stats } = useShoppingListStats();
  const updateShopping = useUpdateShoppingList();
  const deleteItem = useDeleteShoppingItem();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const handleMarkPurchased = async (item: ShoppingListWithWine) => {
    try {
      await updateShopping.mutateAsync({
        id: item.id,
        status: "purchased",
        purchased_date: new Date().toISOString().split("T")[0],
        purchased_quantity: item.quantity_needed,
      });
      toast.success(`Marked "${getWineName(item)}" as purchased!`);
    } catch {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async (item: ShoppingListWithWine) => {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success(`Removed "${getWineName(item)}" from shopping list`);
    } catch {
      toast.error("Failed to delete item");
    }
  };

  const handleChangeUrgency = async (item: ShoppingListWithWine, urgency: ShoppingUrgency) => {
    try {
      await updateShopping.mutateAsync({ id: item.id, urgency });
      toast.success(`Updated urgency to ${URGENCY_LABELS[urgency]}`);
    } catch {
      toast.error("Failed to update urgency");
    }
  };

  const getWineName = (item: ShoppingListWithWine) => {
    if (item.wine_reference) return item.wine_reference.name;
    if (item.cellar_inventory) {
      return item.cellar_inventory.wine_reference_id
        ? "From Cellar"
        : item.cellar_inventory.custom_name || "Unknown";
    }
    return item.custom_name || "Unknown Wine";
  };

  const getProducer = (item: ShoppingListWithWine) => {
    return item.wine_reference?.producer || item.custom_producer;
  };

  // Group by urgency for active items
  const groupedByUrgency = shoppingList?.reduce(
    (acc, item) => {
      const urgency = item.urgency;
      if (!acc[urgency]) acc[urgency] = [];
      acc[urgency].push(item);
      return acc;
    },
    {} as Record<ShoppingUrgency, ShoppingListWithWine[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Shopping List</h1>
          <p className="text-muted-foreground">
            {stats?.totalBottlesNeeded || 0} bottles to restock
            {stats?.estimatedCost ? ` • Est. ${formatCurrency(stats.estimatedCost)}` : ""}
          </p>
        </div>
        <Link href="/shopping/add">
          <Button>+ Add Item</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Urgent"
          value={stats?.byUrgency.urgent?.toString() || "0"}
          className="border-red-200"
        />
        <StatCard
          label="High Priority"
          value={stats?.byUrgency.high?.toString() || "0"}
          className="border-orange-200"
        />
        <StatCard
          label="Total Items"
          value={stats?.active?.toString() || "0"}
          className="border-blue-200"
        />
        <StatCard
          label="Bottles Needed"
          value={stats?.totalBottlesNeeded?.toString() || "0"}
          className="border-green-200"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "purchased")}>
        <TabsList>
          <TabsTrigger value="active">To Buy ({stats?.active || 0})</TabsTrigger>
          <TabsTrigger value="purchased">Purchased ({stats?.purchased || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <LoadingState />
          ) : !shoppingList?.length ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {(["urgent", "high", "normal", "low"] as ShoppingUrgency[]).map((urgency) => {
                const items = groupedByUrgency?.[urgency];
                if (!items?.length) return null;
                return (
                  <div key={urgency}>
                    <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Badge variant="outline" className={URGENCY_COLORS[urgency]}>
                        {URGENCY_LABELS[urgency]}
                      </Badge>
                      <span className="text-muted-foreground text-sm font-normal">
                        ({items.length})
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <ShoppingCard
                          key={item.id}
                          item={item}
                          onMarkPurchased={() => handleMarkPurchased(item)}
                          onDelete={() => handleDelete(item)}
                          onChangeUrgency={(u) => handleChangeUrgency(item, u)}
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
          ) : !shoppingList?.length ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="text-4xl">🛒</div>
                <p className="mt-2 text-muted-foreground">No purchased items yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {shoppingList.map((item) => (
                <ShoppingCard
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

function ShoppingCard({
  item,
  isPurchased,
  onMarkPurchased,
  onDelete,
  onChangeUrgency,
  formatCurrency,
}: {
  item: ShoppingListWithWine;
  isPurchased?: boolean;
  onMarkPurchased?: () => void;
  onDelete: () => void;
  onChangeUrgency?: (urgency: ShoppingUrgency) => void;
  formatCurrency: (cents: number) => string;
}) {
  const wineName = item.wine_reference?.name || item.custom_name || "Unknown Wine";
  const producer = item.wine_reference?.producer || item.custom_producer;

  return (
    <Card className={cn("hover:shadow-md transition-shadow", isPurchased && "opacity-75")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {!isPurchased && (
            <Checkbox
              checked={false}
              onCheckedChange={() => onMarkPurchased?.()}
              className="h-5 w-5"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{wineName}</h3>
                {producer && (
                  <p className="text-sm text-muted-foreground">{producer}</p>
                )}
                {item.custom_vintage && (
                  <p className="text-xs text-muted-foreground">{item.custom_vintage}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  Qty: {item.quantity_needed}
                </Badge>
                {!isPurchased && (
                  <Badge variant="outline" className={URGENCY_COLORS[item.urgency]}>
                    {URGENCY_LABELS[item.urgency]}
                  </Badge>
                )}
              </div>
            </div>

            {/* Price & Reason */}
            <div className="mt-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                {item.target_price_cents && (
                  <span>
                    <span className="text-muted-foreground">Target: </span>
                    <span className="font-medium">{formatCurrency(item.target_price_cents)}</span>
                  </span>
                )}
                {item.last_purchase_price_cents && (
                  <span className="text-muted-foreground">
                    Last: {formatCurrency(item.last_purchase_price_cents)}
                  </span>
                )}
              </div>
              {item.reason && (
                <span className="text-muted-foreground italic">{item.reason}</span>
              )}
            </div>

            {/* Preferred Vendors */}
            {item.preferred_vendors && item.preferred_vendors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.preferred_vendors.map((vendor) => (
                  <Badge key={vendor} variant="secondary" className="text-xs">
                    {vendor}
                  </Badge>
                ))}
              </div>
            )}

            {/* Auto-generated indicator */}
            {item.auto_generated && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  Auto-generated from low stock
                </Badge>
              </div>
            )}
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
                  <DropdownMenuItem onClick={() => onChangeUrgency?.("urgent")}>
                    Urgency: Urgent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeUrgency?.("high")}>
                    Urgency: High
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeUrgency?.("normal")}>
                    Urgency: Normal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeUrgency?.("low")}>
                    Urgency: Low
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
        <div className="text-4xl animate-pulse">🛒</div>
        <p className="mt-2 text-muted-foreground">Loading shopping list...</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl">🛒</div>
        <h2 className="mt-4 font-playfair text-xl font-semibold">
          Your shopping list is empty
        </h2>
        <p className="mt-2 text-muted-foreground text-center max-w-md">
          Track wines you need to restock. Items can be added manually or
          automatically when your cellar stock runs low.
        </p>
        <Link href="/shopping/add" className="mt-6">
          <Button>+ Add First Item</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
