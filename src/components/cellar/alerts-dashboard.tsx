"use client";

import Link from "next/link";
import { useCellar } from "@/lib/hooks/use-cellar";
import {
  useLowStockWines,
  useDrinkingWindowWines,
  useApproachingPeakWines,
} from "@/lib/hooks/use-low-stock-alerts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WineItem {
  id: string;
  quantity: number;
  low_stock_threshold?: number | null;
  drink_before?: string | null;
  drink_after?: string | null;
  wine_reference: {
    name: string;
    producer?: string | null;
  } | null;
  custom_name?: string | null;
  custom_producer?: string | null;
  vintage?: number | null;
}

export function AlertsDashboard() {
  const { data: cellar } = useCellar();
  const { data: lowStockWines = [] } = useLowStockWines(cellar?.id);
  const { data: readyToDrinkWines = [] } = useDrinkingWindowWines(cellar?.id);
  const { data: approachingPeakWines = [] } = useApproachingPeakWines(cellar?.id);

  const hasAlerts =
    lowStockWines.length > 0 ||
    readyToDrinkWines.length > 0 ||
    approachingPeakWines.length > 0;

  if (!hasAlerts) {
    return null;
  }

  const getWineName = (wine: WineItem) => {
    const name = wine.wine_reference?.name || wine.custom_name || "Unknown Wine";
    return wine.vintage ? `${wine.vintage} ${name}` : name;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="font-playfair text-xl font-semibold">Alerts</h2>

      {/* Low Stock Wines */}
      {lowStockWines.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span>Low Stock</span>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                {lowStockWines.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(lowStockWines as WineItem[]).slice(0, 5).map((wine) => (
                <li key={wine.id} className="flex items-center justify-between">
                  <Link
                    href={`/cellar/${wine.id}`}
                    className="text-sm hover:underline truncate flex-1"
                  >
                    {getWineName(wine)}
                  </Link>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    {wine.quantity} left
                  </Badge>
                </li>
              ))}
            </ul>
            {lowStockWines.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{lowStockWines.length - 5} more wines
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ready to Drink */}
      {readyToDrinkWines.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span>Ready to Drink</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {readyToDrinkWines.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(readyToDrinkWines as WineItem[]).slice(0, 5).map((wine) => (
                <li key={wine.id} className="flex items-center justify-between">
                  <Link
                    href={`/cellar/${wine.id}`}
                    className="text-sm hover:underline truncate flex-1"
                  >
                    {getWineName(wine)}
                  </Link>
                  {wine.drink_before && (
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">
                      until {formatDate(wine.drink_before)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {readyToDrinkWines.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{readyToDrinkWines.length - 5} more wines
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approaching Peak */}
      {approachingPeakWines.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <span>Drink Soon</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                {approachingPeakWines.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              These wines are approaching their optimal drinking window end date
            </p>
            <ul className="space-y-2">
              {(approachingPeakWines as WineItem[]).slice(0, 5).map((wine) => (
                <li key={wine.id} className="flex items-center justify-between">
                  <Link
                    href={`/cellar/${wine.id}`}
                    className="text-sm hover:underline truncate flex-1"
                  >
                    {getWineName(wine)}
                  </Link>
                  {wine.drink_before && (
                    <Badge variant="outline" className="ml-2 shrink-0 text-amber-700">
                      by {formatDate(wine.drink_before)}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            {approachingPeakWines.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{approachingPeakWines.length - 5} more wines
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
