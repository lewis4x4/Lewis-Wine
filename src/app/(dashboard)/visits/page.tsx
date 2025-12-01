"use client";

import { useState } from "react";
import Link from "next/link";
import { useWineryVisits, useDeleteWineryVisit, useWineryVisitStats } from "@/lib/hooks/use-winery-visits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { WineryVisitWithWines, VisitType } from "@/types/database";

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  tasting: "Tasting",
  tour: "Tour",
  "tour-and-tasting": "Tour & Tasting",
  pickup: "Pickup",
  event: "Event",
  other: "Other",
};

export default function WineryVisitsPage() {
  const { data: visits, isLoading } = useWineryVisits();
  const { data: stats } = useWineryVisitStats();
  const deleteVisit = useDeleteWineryVisit();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const handleDelete = async (visit: WineryVisitWithWines) => {
    try {
      await deleteVisit.mutateAsync(visit.id);
      toast.success(`Deleted visit to ${visit.winery_name}`);
    } catch {
      toast.error("Failed to delete visit");
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <span className="text-yellow-500">
        {"★".repeat(rating)}
        {"☆".repeat(5 - rating)}
      </span>
    );
  };

  // Group visits by year
  const visitsByYear = visits?.reduce(
    (acc, visit) => {
      const year = new Date(visit.visit_date).getFullYear();
      if (!acc[year]) acc[year] = [];
      acc[year].push(visit);
      return acc;
    },
    {} as Record<number, WineryVisitWithWines[]>
  );

  const sortedYears = Object.keys(visitsByYear || {})
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-bold">Winery Visits</h1>
          <p className="text-muted-foreground">
            {stats?.totalVisits || 0} visits to {stats?.uniqueWineries || 0} wineries
          </p>
        </div>
        <Link href="/visits/add">
          <Button>+ Log Visit</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="This Year"
          value={stats?.thisYear?.toString() || "0"}
          icon="📅"
        />
        <StatCard
          label="Wines Tasted"
          value={stats?.winesTasted?.toString() || "0"}
          icon="🍷"
        />
        <StatCard
          label="Bottles Purchased"
          value={stats?.bottlesPurchased?.toString() || "0"}
          icon="🛒"
        />
        <StatCard
          label="Total Spent"
          value={stats?.totalSpent ? formatCurrency(stats.totalSpent) : "$0"}
          icon="💰"
        />
      </div>

      {/* Visit List */}
      {isLoading ? (
        <LoadingState />
      ) : !visits?.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {sortedYears.map((year) => (
            <div key={year}>
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span>{year}</span>
                <Badge variant="outline">
                  {visitsByYear?.[year]?.length} visits
                </Badge>
              </h2>
              <div className="space-y-4">
                {visitsByYear?.[year]?.map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    onDelete={() => handleDelete(visit)}
                    formatCurrency={formatCurrency}
                    renderStars={renderStars}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VisitCard({
  visit,
  onDelete,
  formatCurrency,
  renderStars,
}: {
  visit: WineryVisitWithWines;
  onDelete: () => void;
  formatCurrency: (cents: number) => string;
  renderStars: (rating: number | null) => React.ReactNode;
}) {
  const winesPurchased = visit.winery_visit_wines?.filter((w) => w.purchased) || [];
  const totalSpent = winesPurchased.reduce(
    (sum, w) => sum + (w.price_per_bottle_cents || 0) * (w.quantity_purchased || 1),
    0
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link href={`/visits/${visit.id}`} className="hover:underline">
                <h3 className="font-semibold text-lg">{visit.winery_name}</h3>
              </Link>
              <Badge variant="outline">
                {VISIT_TYPE_LABELS[visit.visit_type]}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              {visit.winery_region && <span>{visit.winery_region}</span>}
              {visit.winery_region && visit.winery_country && <span>•</span>}
              {visit.winery_country && <span>{visit.winery_country}</span>}
            </div>

            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(visit.visit_date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {visit.overall_rating && (
                <span className="ml-2">{renderStars(visit.overall_rating)}</span>
              )}
            </div>

            {/* Wine Stats */}
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {visit.winery_visit_wines && visit.winery_visit_wines.length > 0 && (
                <span>
                  <span className="font-medium">{visit.winery_visit_wines.length}</span>
                  <span className="text-muted-foreground"> wines tasted</span>
                </span>
              )}
              {winesPurchased.length > 0 && (
                <span>
                  <span className="font-medium">{winesPurchased.length}</span>
                  <span className="text-muted-foreground"> purchased</span>
                </span>
              )}
              {totalSpent > 0 && (
                <span className="text-green-600 font-medium">
                  {formatCurrency(totalSpent)}
                </span>
              )}
            </div>

            {/* Highlights */}
            {visit.highlights && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {visit.highlights}
              </p>
            )}

            {/* Would Return */}
            {visit.would_return !== null && (
              <div className="mt-2">
                <Badge variant={visit.would_return ? "default" : "secondary"}>
                  {visit.would_return ? "Would Return" : "Would Not Return"}
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
              <DropdownMenuItem asChild>
                <Link href={`/visits/${visit.id}`}>View Details</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/visits/${visit.id}/edit`}>Edit Visit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                Delete
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

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="text-4xl animate-pulse">🏰</div>
        <p className="mt-2 text-muted-foreground">Loading visits...</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl">🏰</div>
        <h2 className="mt-4 font-playfair text-xl font-semibold">
          No winery visits logged
        </h2>
        <p className="mt-2 text-muted-foreground text-center max-w-md">
          Keep track of your winery visits, tastings, and purchases.
          Log your experiences to remember favorite wineries.
        </p>
        <Link href="/visits/add" className="mt-6">
          <Button>+ Log Your First Visit</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
