"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCellarValue, useValueByType, useValueByRegion, useTopGainers } from "@/lib/hooks/use-portfolio-value";
import { cn } from "@/lib/utils";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function PortfolioDashboard() {
  const { data: cellarValue, isLoading: valueLoading } = useCellarValue();
  const { data: valueByType, isLoading: typeLoading } = useValueByType();
  const { data: valueByRegion, isLoading: regionLoading } = useValueByRegion();
  const { data: topGainers, isLoading: gainersLoading } = useTopGainers(5);

  const isLoading = valueLoading || typeLoading || regionLoading || gainersLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const gainLossColor = (cellarValue?.gain_loss_cents || 0) >= 0 ? "text-green-600" : "text-red-600";
  const gainLossBg = (cellarValue?.gain_loss_cents || 0) >= 0 ? "bg-green-50" : "bg-red-50";

  return (
    <div className="space-y-6">
      {/* Main Value Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Collection Value</div>
            <div className="text-3xl font-bold mt-2">
              {formatCurrency(cellarValue?.total_market_cents || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {cellarValue?.total_bottles || 0} bottles
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Cost Basis</div>
            <div className="text-3xl font-bold mt-2">
              {formatCurrency(cellarValue?.total_purchase_cents || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Original purchase price
            </div>
          </CardContent>
        </Card>

        <Card className={gainLossBg}>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Unrealized Gain/Loss</div>
            <div className={cn("text-3xl font-bold mt-2", gainLossColor)}>
              {formatCurrency(cellarValue?.gain_loss_cents || 0)}
            </div>
            <div className={cn("text-sm font-medium mt-1", gainLossColor)}>
              {formatPercentage(cellarValue?.gain_loss_percentage || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Avg Bottle Value</div>
            <div className="text-3xl font-bold mt-2">
              {cellarValue?.total_bottles
                ? formatCurrency(cellarValue.total_market_cents / cellarValue.total_bottles)
                : "$0"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Per bottle (market)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Wine Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value by Wine Type</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(valueByType || {}).length === 0 ? (
              <p className="text-muted-foreground text-sm">No wines in cellar</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(valueByType || {})
                  .sort((a, b) => b[1].market - a[1].market)
                  .map(([type, data]) => {
                    const gainLoss = data.market - data.purchase;
                    const percentage = data.purchase > 0 ? (gainLoss / data.purchase) * 100 : 0;
                    const isGain = gainLoss >= 0;

                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {data.bottles} bottles
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(data.market)}</div>
                          <div className={cn("text-xs", isGain ? "text-green-600" : "text-red-600")}>
                            {formatPercentage(percentage)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Region */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value by Region</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(valueByRegion || {}).length === 0 ? (
              <p className="text-muted-foreground text-sm">No wines in cellar</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(valueByRegion || {})
                  .sort((a, b) => b[1].market - a[1].market)
                  .slice(0, 6)
                  .map(([region, data]) => {
                    const gainLoss = data.market - data.purchase;
                    const percentage = data.purchase > 0 ? (gainLoss / data.purchase) * 100 : 0;
                    const isGain = gainLoss >= 0;

                    return (
                      <div key={region} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{region}</span>
                          <span className="text-sm text-muted-foreground">
                            ({data.bottles})
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(data.market)}</div>
                          <div className={cn("text-xs", isGain ? "text-green-600" : "text-red-600")}>
                            {formatPercentage(percentage)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Gainers */}
      {topGainers && topGainers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topGainers.map((wine: {
                id: string;
                vintage: number | null;
                wine_reference: { name: string; producer: string } | null;
                custom_name: string | null;
                purchase_price_cents: number;
                current_market_value_cents: number;
                gain_cents: number;
                gain_percentage: number;
              }) => (
                <div key={wine.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {wine.vintage && `${wine.vintage} `}
                      {wine.wine_reference?.name || wine.custom_name}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {wine.wine_reference?.producer}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-green-600 font-medium">
                      +{formatCurrency(wine.gain_cents)}
                    </div>
                    <div className="text-xs text-green-600">
                      {formatPercentage(wine.gain_percentage)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
