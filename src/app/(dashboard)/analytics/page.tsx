"use client";

import { useDrinkingStats, useSpendingStats, useVintageStats, useTasteProfile } from "@/lib/hooks/use-analytics";
import { useBrianTasteProfile } from "@/lib/hooks/use-brian-fit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TasteGenome } from "@/lib/taste-genome";
import type { BrianTasteProfile } from "@/types/database";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-playfair text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          See where your cellar, taste, and spend are actually moving.
        </p>
      </div>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <CardTitle className="font-playfair text-2xl">Analytics operating view</CardTitle>
          <CardDescription>Use this page to see the shape of the collection, not just charts for their own sake.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What matters now</div>
            <p className="mt-2 text-sm text-foreground">This is where portfolio truth, drinking behavior, and taste formation should converge into one readable operating layer.</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next move</div>
            <p className="mt-2 text-sm text-foreground">Compare drinking, spending, vintages, and taste together to spot where the cellar is becoming smarter versus simply bigger.</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk if ignored</div>
            <p className="mt-2 text-sm text-foreground">Without a coherent read layer, good data becomes decoration instead of decision support.</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="drinking" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drinking">Drinking</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="vintages">Vintages</TabsTrigger>
          <TabsTrigger value="taste">Taste Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="drinking">
          <DrinkingStatsSection />
        </TabsContent>

        <TabsContent value="spending">
          <SpendingStatsSection />
        </TabsContent>

        <TabsContent value="vintages">
          <VintageStatsSection />
        </TabsContent>

        <TabsContent value="taste">
          <TasteProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DrinkingStatsSection() {
  const { data: stats, isLoading } = useDrinkingStats();

  if (isLoading) return <LoadingState />;
  if (!stats || stats.totalConsumed === 0) {
    return (
      <EmptyState
        title="No drinking history yet"
        description="Start tracking consumed wines to see your drinking patterns."
      />
    );
  }

  const maxMonthCount = Math.max(...stats.byMonth.map((m) => m.count), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Consumed" value={stats.totalConsumed.toString()} icon="🍷" />
        <StatCard label="This Month" value={stats.consumedThisMonth.toString()} icon="📅" />
        <StatCard label="This Year" value={stats.consumedThisYear.toString()} icon="📆" />
        <StatCard
          label="Favorite Type"
          value={stats.favoriteType ? capitalize(stats.favoriteType) : "-"}
          icon="❤️"
        />
      </div>

      {/* Monthly Consumption Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Consumption</CardTitle>
          <CardDescription>Bottles consumed over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-2">
            {stats.byMonth.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                  style={{
                    height: `${(month.count / maxMonthCount) * 100}%`,
                    minHeight: month.count > 0 ? "8px" : "0",
                  }}
                />
                <span className="text-xs text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                  {month.month.split(" ")[0]}
                </span>
                {month.count > 0 && (
                  <span className="text-xs font-medium -mt-1">{month.count}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By Type and Region */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Wine Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byType.map((item) => (
                <div key={item.type} className="flex items-center gap-3">
                  <div className="w-24 font-medium capitalize">{item.type}</div>
                  <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/80 transition-all"
                      style={{
                        width: `${(item.count / stats.totalConsumed) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm text-muted-foreground">
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byRegion.slice(0, 5).map((item, index) => (
                <div key={item.region} className="flex items-center gap-3">
                  <div className="w-6 text-center font-medium text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1 font-medium">{item.region}</div>
                  <Badge variant="secondary">{item.count} bottles</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SpendingStatsSection() {
  const { data: stats, isLoading } = useSpendingStats();

  if (isLoading) return <LoadingState />;
  if (!stats || stats.totalSpent === 0) {
    return (
      <EmptyState
        title="No spending data yet"
        description="Add purchase prices to your wines to track spending."
      />
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const maxMonthAmount = Math.max(...stats.byMonth.map((m) => m.amount), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Spent" value={formatCurrency(stats.totalSpent)} icon="💰" />
        <StatCard label="This Month" value={formatCurrency(stats.spentThisMonth)} icon="📅" />
        <StatCard label="This Year" value={formatCurrency(stats.spentThisYear)} icon="📆" />
        <StatCard
          label="Avg per Bottle"
          value={formatCurrency(stats.averageBottlePrice)}
          icon="🍾"
        />
      </div>

      {/* Monthly Spending Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Spending</CardTitle>
          <CardDescription>Wine purchases over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-2">
            {stats.byMonth.map((month) => (
              <div key={month.month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-green-500/80 rounded-t transition-all hover:bg-green-500"
                  style={{
                    height: `${(month.amount / maxMonthAmount) * 100}%`,
                    minHeight: month.amount > 0 ? "8px" : "0",
                  }}
                />
                <span className="text-xs text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                  {month.month.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Yearly Breakdown */}
      {stats.byYear.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Yearly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byYear.map((year) => (
                <div key={year.year} className="flex items-center justify-between">
                  <span className="font-medium">{year.year}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {year.bottles} bottles
                    </span>
                    <span className="font-medium">{formatCurrency(year.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By Type and Region */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byType.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{item.type}</span>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(item.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.bottles} bottles
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Regions by Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byRegion.slice(0, 5).map((item, index) => (
                <div key={item.region} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{index + 1}.</span>
                    <span className="font-medium">{item.region}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(item.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.bottles} bottles
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Expensive */}
      {stats.mostExpensiveBottle && (
        <Card>
          <CardHeader>
            <CardTitle>Most Expensive Purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="font-medium">{stats.mostExpensiveBottle.name}</span>
              <Badge variant="secondary" className="text-lg">
                {formatCurrency(stats.mostExpensiveBottle.price)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VintageStatsSection() {
  const { data: stats, isLoading } = useVintageStats();

  if (isLoading) return <LoadingState />;
  if (!stats || stats.byVintage.length === 0) {
    return (
      <EmptyState
        title="No vintage data yet"
        description="Rate wines with vintage information to see vintage charts."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Best Vintages */}
      {stats.bestVintages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Best Vintages</CardTitle>
            <CardDescription>Your highest-rated vintages (minimum 2 ratings)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.bestVintages.map((v, index) => (
                <div
                  key={v.vintage}
                  className={cn(
                    "px-4 py-3 rounded-lg text-center",
                    index === 0
                      ? "bg-yellow-100 border-2 border-yellow-400"
                      : index === 1
                      ? "bg-gray-100 border-2 border-gray-300"
                      : index === 2
                      ? "bg-orange-100 border-2 border-orange-300"
                      : "bg-muted"
                  )}
                >
                  <div className="text-2xl font-bold">{v.vintage}</div>
                  <div className="text-sm font-medium">{v.avgRating.toFixed(1)} pts</div>
                  <div className="text-xs text-muted-foreground">{v.count} wines</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vintage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Vintage Ratings</CardTitle>
          <CardDescription>Average rating by vintage year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats.byVintage.map((v) => (
              <div key={v.vintage} className="flex items-center gap-3">
                <div className="w-16 font-medium">{v.vintage}</div>
                <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                  <div
                    className="h-full bg-primary/80 transition-all"
                    style={{
                      width: `${((v.avgRating - 70) / 30) * 100}%`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    {v.avgRating.toFixed(1)}
                  </span>
                </div>
                <div className="w-16 text-right text-sm text-muted-foreground">
                  {v.count} wine{v.count !== 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* By Region */}
      {stats.vintagesByRegion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vintages by Region</CardTitle>
            <CardDescription>How different vintages perform in each region</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stats.vintagesByRegion.map((region) => (
                <div key={region.region}>
                  <h4 className="font-semibold mb-2">{region.region}</h4>
                  <div className="flex flex-wrap gap-2">
                    {region.vintages.slice(0, 8).map((v) => (
                      <Badge
                        key={v.vintage}
                        variant={v.avgRating >= 90 ? "default" : "secondary"}
                        className="px-3 py-1"
                      >
                        {v.vintage}: {v.avgRating.toFixed(0)}
                      </Badge>
                    ))}
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

function TasteProfileSection() {
  const { data: profile, isLoading } = useTasteProfile();
  const { data: brianProfile, isLoading: brianProfileLoading } = useBrianTasteProfile();

  if (isLoading || brianProfileLoading) return <LoadingState />;
  if (!profile && !brianProfile) {
    return (
      <EmptyState
        title="No taste profile yet"
        description="Rate more wines to discover your preferences."
      />
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        {brianProfile && <BrianFitProfileCard brianProfile={brianProfile} />}
      </div>
    );
  }

  const tasteProfile = profile;

  return (
    <div className="space-y-6">
      {brianProfile && <BrianFitProfileCard brianProfile={brianProfile} />}
      <TasteGenomeCard genome={tasteProfile.tasteGenome} />

      {/* Insights */}
      {tasteProfile.insights.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>💡</span> Your Wine Personality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tasteProfile.insights.map((insight, index) => (
                <p key={index} className="text-lg">
                  {insight}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Average Rating"
          value={tasteProfile.averageRating.toFixed(1)}
          icon="⭐"
        />
        <StatCard
          label="Total Ratings"
          value={tasteProfile.totalRatings.toString()}
          icon="📊"
        />
        <StatCard
          label="Top Type"
          value={
            tasteProfile.preferredTypes[0]
              ? capitalize(tasteProfile.preferredTypes[0].type)
              : "-"
          }
          icon="🏆"
        />
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
          <CardDescription>How you typically rate wines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {tasteProfile.ratingDistribution.map((bucket) => {
              const maxCount = Math.max(
                ...tasteProfile.ratingDistribution.map((b) => b.count)
              );
              return (
                <div
                  key={bucket.score}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                    style={{
                      height: `${(bucket.count / maxCount) * 100}%`,
                      minHeight: bucket.count > 0 ? "4px" : "0",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {bucket.score}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preferred Types and Regions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preferred Wine Types</CardTitle>
            <CardDescription>Ranked by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasteProfile.preferredTypes.map((type, index) => (
                <div key={type.type} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      index === 0
                        ? "bg-yellow-400 text-yellow-900"
                        : index === 1
                        ? "bg-gray-300 text-gray-700"
                        : index === 2
                        ? "bg-orange-300 text-orange-800"
                        : "bg-muted"
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium capitalize">{type.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {type.count} ratings
                    </div>
                  </div>
                  <Badge variant="secondary">{type.avgRating.toFixed(1)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferred Regions</CardTitle>
            <CardDescription>Ranked by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasteProfile.preferredRegions.slice(0, 5).map((region, index) => (
                <div key={region.region} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      index === 0
                        ? "bg-yellow-400 text-yellow-900"
                        : index === 1
                        ? "bg-gray-300 text-gray-700"
                        : index === 2
                        ? "bg-orange-300 text-orange-800"
                        : "bg-muted"
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{region.region}</div>
                    <div className="text-xs text-muted-foreground">
                      {region.count} ratings
                    </div>
                  </div>
                  <Badge variant="secondary">{region.avgRating.toFixed(1)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Favorite Producers */}
      {tasteProfile.preferredProducers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Favorite Producers</CardTitle>
            <CardDescription>Producers you consistently rate highly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tasteProfile.preferredProducers.map((producer) => (
                <Badge key={producer.producer} variant="outline" className="px-3 py-1">
                  {producer.producer} ({producer.avgRating.toFixed(1)})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Characteristics */}
      {(tasteProfile.characteristics.body.length > 0 ||
        tasteProfile.characteristics.tannins.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Preferred Characteristics</CardTitle>
            <CardDescription>Wine profiles you rate highest</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {tasteProfile.characteristics.body.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Body</h4>
                  <div className="space-y-1">
                    {tasteProfile.characteristics.body.slice(0, 3).map((item) => (
                      <div
                        key={item.level}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="capitalize">{item.level}</span>
                        <span className="text-muted-foreground">
                          {item.avgRating.toFixed(1)} ({item.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tasteProfile.characteristics.tannins.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Tannins</h4>
                  <div className="space-y-1">
                    {tasteProfile.characteristics.tannins.slice(0, 3).map((item) => (
                      <div
                        key={item.level}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="capitalize">{item.level}</span>
                        <span className="text-muted-foreground">
                          {item.avgRating.toFixed(1)} ({item.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tasteProfile.characteristics.acidity.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Acidity</h4>
                  <div className="space-y-1">
                    {tasteProfile.characteristics.acidity.slice(0, 3).map((item) => (
                      <div
                        key={item.level}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="capitalize">{item.level}</span>
                        <span className="text-muted-foreground">
                          {item.avgRating.toFixed(1)} ({item.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tasteProfile.characteristics.sweetness.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Sweetness</h4>
                  <div className="space-y-1">
                    {tasteProfile.characteristics.sweetness.slice(0, 3).map((item) => (
                      <div
                        key={item.level}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="capitalize">{item.level}</span>
                        <span className="text-muted-foreground">
                          {item.avgRating.toFixed(1)} ({item.count})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TasteGenomeCard({ genome }: { genome: TasteGenome }) {
  const topRegions = genome.affinities.regions.slice(0, 3);
  const topStructures = genome.structureProfile.slice(0, 5);
  const underperformer = genome.valuePattern.underperformers[0];

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-playfair text-2xl">Taste Genome v1</CardTitle>
            <CardDescription>Deterministic read of what your ratings actually prove versus what is still thin signal.</CardDescription>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 capitalize">
            {genome.confidence.level} confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border bg-background/80 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Genome read</div>
          <p className="mt-2 text-lg font-medium text-foreground">{genome.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{genome.confidence.explanation}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proven lanes</div>
            <div className="mt-3 space-y-3">
              {topRegions.length > 0 ? topRegions.map((region) => (
                <div key={region.name} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">{region.name}</div>
                    <div className="text-xs text-muted-foreground">{region.count} ratings · {region.confidence}</div>
                  </div>
                  <Badge variant="secondary">{region.averageRating.toFixed(1)}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">No regional signal yet.</p>}
            </div>
          </div>

          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Structure fingerprint</div>
            <div className="mt-3 space-y-2">
              {topStructures.length > 0 ? topStructures.map((point) => (
                <div key={point.dimension}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{point.label}</span>
                    <span className="text-muted-foreground">{point.average.toFixed(1)}/5</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, point.average * 20)}%` }} />
                  </div>
                </div>
              )) : <p className="text-sm text-muted-foreground">Add rating signals to expose structure.</p>}
            </div>
          </div>

          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Value intelligence</div>
            <div className="mt-3 space-y-3 text-sm">
              {genome.valuePattern.bestValue ? (
                <div>
                  <div className="font-medium">Best value signal</div>
                  <p className="text-muted-foreground">{genome.valuePattern.bestValue.label} · {genome.valuePattern.bestValue.score} pts</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Value signal needs prices plus ratings.</p>
              )}
              {underperformer && (
                <div>
                  <div className="font-medium">Watchlist</div>
                  <p className="text-muted-foreground">{underperformer.label} underperformed relative to price.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {genome.insights.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {genome.insights.slice(0, 4).map((insight) => (
              <div key={insight} className="rounded-xl border bg-background/70 p-3 text-sm text-muted-foreground">
                {insight}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BrianFitProfileCard({ brianProfile }: { brianProfile: BrianTasteProfile }) {
  const favoriteDescriptors = brianProfile.favorite_descriptors || [];
  const avoidDescriptors = brianProfile.avoid_descriptors || [];
  const updatedLabel = new Date(brianProfile.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-playfair text-2xl">Brian-Fit profile</CardTitle>
            <CardDescription>The seeded palate model that powers Pourfolio recommendations.</CardDescription>
          </div>
          <Badge className="rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
            {brianProfile.confidence_score ?? 0}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base leading-7 text-foreground">
          {brianProfile.profile_summary || "Profile summary is still forming from ratings and tasting signals."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Favorite descriptors</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteDescriptors.length > 0 ? (
                favoriteDescriptors.map((descriptor) => (
                  <Badge key={descriptor} variant="secondary">{descriptor}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Awaiting stronger positive signals.</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Avoid signals</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {avoidDescriptors.length > 0 ? (
                avoidDescriptors.map((descriptor) => (
                  <Badge key={descriptor} variant="outline">{descriptor}</Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No strong avoid pattern yet.</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Last updated {updatedLabel}</p>
      </CardContent>
    </Card>
  );
}

// Helper Components
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
        <div className="text-4xl animate-pulse">📊</div>
        <p className="mt-2 text-muted-foreground">Analyzing your data...</p>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="text-6xl">📊</div>
        <h2 className="mt-4 font-playfair text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-muted-foreground text-center max-w-md">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
