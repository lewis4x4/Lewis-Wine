"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CellarInventory, WineReference, Rating } from "@/types/database";

// Types for analytics data
type DrinkingStats = {
  totalConsumed: number;
  consumedThisMonth: number;
  consumedThisYear: number;
  byMonth: { month: string; count: number }[];
  byType: { type: string; count: number }[];
  byRegion: { region: string; count: number }[];
  favoriteType: string | null;
  favoriteRegion: string | null;
};

type SpendingStats = {
  totalSpent: number;
  spentThisMonth: number;
  spentThisYear: number;
  averageBottlePrice: number;
  byMonth: { month: string; amount: number; bottles: number }[];
  byYear: { year: number; amount: number; bottles: number }[];
  byType: { type: string; amount: number; bottles: number }[];
  byRegion: { region: string; amount: number; bottles: number }[];
  mostExpensiveBottle: { name: string; price: number } | null;
};

type VintageStats = {
  byVintage: {
    vintage: number;
    avgRating: number;
    count: number;
    regions: { region: string; avgRating: number; count: number }[];
  }[];
  bestVintages: { vintage: number; avgRating: number; count: number }[];
  vintagesByRegion: {
    region: string;
    vintages: { vintage: number; avgRating: number; count: number }[];
  }[];
};

type TasteProfile = {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: { score: number; count: number }[];
  preferredTypes: { type: string; avgRating: number; count: number }[];
  preferredRegions: { region: string; avgRating: number; count: number }[];
  preferredProducers: { producer: string; avgRating: number; count: number }[];
  characteristics: {
    body: { level: string; avgRating: number; count: number }[];
    tannins: { level: string; avgRating: number; count: number }[];
    acidity: { level: string; avgRating: number; count: number }[];
    sweetness: { level: string; avgRating: number; count: number }[];
  };
  insights: string[];
};

// Helper to get month string
const getMonthString = (date: Date) => {
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};

// Helper to get last 12 months
const getLast12Months = () => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthString(d));
  }
  return months;
};

export function useDrinkingStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["analytics", "drinking"],
    queryFn: async () => {
      // Get consumed wines
      const { data: consumed, error } = await supabase
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*)
        `)
        .eq("status", "consumed");

      if (error) throw error;

      const wines = consumed as (CellarInventory & { wine_reference: WineReference | null })[];
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisYear = new Date(now.getFullYear(), 0, 1);

      // Count by month (last 12 months)
      const last12Months = getLast12Months();
      const byMonthMap = new Map<string, number>();
      last12Months.forEach((m) => byMonthMap.set(m, 0));

      wines.forEach((w) => {
        if (w.consumed_date) {
          const d = new Date(w.consumed_date);
          const monthStr = getMonthString(d);
          if (byMonthMap.has(monthStr)) {
            byMonthMap.set(monthStr, (byMonthMap.get(monthStr) || 0) + 1);
          }
        }
      });

      // Count by type
      const typeMap = new Map<string, number>();
      wines.forEach((w) => {
        const type = w.wine_reference?.wine_type || "unknown";
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
      });

      // Count by region
      const regionMap = new Map<string, number>();
      wines.forEach((w) => {
        const region = w.wine_reference?.region || "Unknown";
        regionMap.set(region, (regionMap.get(region) || 0) + 1);
      });

      // Find favorites
      const sortedTypes = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
      const sortedRegions = [...regionMap.entries()].sort((a, b) => b[1] - a[1]);

      const stats: DrinkingStats = {
        totalConsumed: wines.length,
        consumedThisMonth: wines.filter(
          (w) => w.consumed_date && new Date(w.consumed_date) >= thisMonth
        ).length,
        consumedThisYear: wines.filter(
          (w) => w.consumed_date && new Date(w.consumed_date) >= thisYear
        ).length,
        byMonth: last12Months.map((month) => ({
          month,
          count: byMonthMap.get(month) || 0,
        })),
        byType: [...typeMap.entries()]
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        byRegion: [...regionMap.entries()]
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        favoriteType: sortedTypes[0]?.[0] || null,
        favoriteRegion: sortedRegions[0]?.[0] || null,
      };

      return stats;
    },
    retry: 1,
  });
}

export function useSpendingStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["analytics", "spending"],
    queryFn: async () => {
      // Get all inventory with purchase info
      const { data: inventory, error } = await supabase
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*)
        `)
        .not("purchase_price_cents", "is", null);

      if (error) throw error;

      const wines = inventory as (CellarInventory & { wine_reference: WineReference | null })[];
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisYear = new Date(now.getFullYear(), 0, 1);

      // Calculate totals
      const totalSpent = wines.reduce(
        (sum, w) => sum + (w.purchase_price_cents || 0) * w.quantity,
        0
      );

      const thisMonthWines = wines.filter(
        (w) => w.purchase_date && new Date(w.purchase_date) >= thisMonth
      );
      const spentThisMonth = thisMonthWines.reduce(
        (sum, w) => sum + (w.purchase_price_cents || 0) * w.quantity,
        0
      );

      const thisYearWines = wines.filter(
        (w) => w.purchase_date && new Date(w.purchase_date) >= thisYear
      );
      const spentThisYear = thisYearWines.reduce(
        (sum, w) => sum + (w.purchase_price_cents || 0) * w.quantity,
        0
      );

      const totalBottles = wines.reduce((sum, w) => sum + w.quantity, 0);
      const averageBottlePrice = totalBottles > 0 ? totalSpent / totalBottles : 0;

      // By month (last 12 months)
      const last12Months = getLast12Months();
      const byMonthMap = new Map<string, { amount: number; bottles: number }>();
      last12Months.forEach((m) => byMonthMap.set(m, { amount: 0, bottles: 0 }));

      wines.forEach((w) => {
        if (w.purchase_date) {
          const d = new Date(w.purchase_date);
          const monthStr = getMonthString(d);
          if (byMonthMap.has(monthStr)) {
            const current = byMonthMap.get(monthStr)!;
            byMonthMap.set(monthStr, {
              amount: current.amount + (w.purchase_price_cents || 0) * w.quantity,
              bottles: current.bottles + w.quantity,
            });
          }
        }
      });

      // By year
      const yearMap = new Map<number, { amount: number; bottles: number }>();
      wines.forEach((w) => {
        if (w.purchase_date) {
          const year = new Date(w.purchase_date).getFullYear();
          const current = yearMap.get(year) || { amount: 0, bottles: 0 };
          yearMap.set(year, {
            amount: current.amount + (w.purchase_price_cents || 0) * w.quantity,
            bottles: current.bottles + w.quantity,
          });
        }
      });

      // By type
      const typeMap = new Map<string, { amount: number; bottles: number }>();
      wines.forEach((w) => {
        const type = w.wine_reference?.wine_type || "unknown";
        const current = typeMap.get(type) || { amount: 0, bottles: 0 };
        typeMap.set(type, {
          amount: current.amount + (w.purchase_price_cents || 0) * w.quantity,
          bottles: current.bottles + w.quantity,
        });
      });

      // By region
      const regionMap = new Map<string, { amount: number; bottles: number }>();
      wines.forEach((w) => {
        const region = w.wine_reference?.region || "Unknown";
        const current = regionMap.get(region) || { amount: 0, bottles: 0 };
        regionMap.set(region, {
          amount: current.amount + (w.purchase_price_cents || 0) * w.quantity,
          bottles: current.bottles + w.quantity,
        });
      });

      // Most expensive
      const sortedByPrice = [...wines].sort(
        (a, b) => (b.purchase_price_cents || 0) - (a.purchase_price_cents || 0)
      );
      const mostExpensive = sortedByPrice[0];

      const stats: SpendingStats = {
        totalSpent,
        spentThisMonth,
        spentThisYear,
        averageBottlePrice,
        byMonth: last12Months.map((month) => ({
          month,
          ...byMonthMap.get(month)!,
        })),
        byYear: [...yearMap.entries()]
          .map(([year, data]) => ({ year, ...data }))
          .sort((a, b) => a.year - b.year),
        byType: [...typeMap.entries()]
          .map(([type, data]) => ({ type, ...data }))
          .sort((a, b) => b.amount - a.amount),
        byRegion: [...regionMap.entries()]
          .map(([region, data]) => ({ region, ...data }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10),
        mostExpensiveBottle: mostExpensive
          ? {
              name:
                mostExpensive.wine_reference?.name ||
                mostExpensive.custom_name ||
                "Unknown",
              price: mostExpensive.purchase_price_cents || 0,
            }
          : null,
      };

      return stats;
    },
    retry: 1,
  });
}

export function useVintageStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["analytics", "vintage"],
    queryFn: async () => {
      // Get ratings with wine reference
      const { data: ratings, error } = await supabase
        .from("ratings")
        .select(`
          *,
          inventory:cellar_inventory (
            vintage,
            wine_reference (*)
          )
        `);

      if (error) throw error;

      type RatingWithInventory = Rating & {
        inventory: (CellarInventory & { wine_reference: WineReference | null }) | null;
      };

      const ratedWines = (ratings as RatingWithInventory[]).filter(
        (r) => r.inventory?.vintage
      );

      // Group by vintage
      const vintageMap = new Map<
        number,
        {
          ratings: number[];
          regions: Map<string, number[]>;
        }
      >();

      ratedWines.forEach((r) => {
        const vintage = r.inventory!.vintage!;
        const region = r.inventory?.wine_reference?.region || "Unknown";

        if (!vintageMap.has(vintage)) {
          vintageMap.set(vintage, { ratings: [], regions: new Map() });
        }

        const vintageData = vintageMap.get(vintage)!;
        vintageData.ratings.push(r.score);

        if (!vintageData.regions.has(region)) {
          vintageData.regions.set(region, []);
        }
        vintageData.regions.get(region)!.push(r.score);
      });

      // Calculate stats
      const byVintage = [...vintageMap.entries()]
        .map(([vintage, data]) => ({
          vintage,
          avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
          count: data.ratings.length,
          regions: [...data.regions.entries()]
            .map(([region, scores]) => ({
              region,
              avgRating: scores.reduce((a, b) => a + b, 0) / scores.length,
              count: scores.length,
            }))
            .sort((a, b) => b.avgRating - a.avgRating),
        }))
        .sort((a, b) => b.vintage - a.vintage);

      // Best vintages
      const bestVintages = [...byVintage]
        .filter((v) => v.count >= 2)
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 5);

      // Group by region
      const regionVintageMap = new Map<
        string,
        Map<number, number[]>
      >();

      ratedWines.forEach((r) => {
        const vintage = r.inventory!.vintage!;
        const region = r.inventory?.wine_reference?.region || "Unknown";

        if (!regionVintageMap.has(region)) {
          regionVintageMap.set(region, new Map());
        }

        const regionData = regionVintageMap.get(region)!;
        if (!regionData.has(vintage)) {
          regionData.set(vintage, []);
        }
        regionData.get(vintage)!.push(r.score);
      });

      const vintagesByRegion = [...regionVintageMap.entries()]
        .map(([region, vintages]) => ({
          region,
          vintages: [...vintages.entries()]
            .map(([vintage, scores]) => ({
              vintage,
              avgRating: scores.reduce((a, b) => a + b, 0) / scores.length,
              count: scores.length,
            }))
            .sort((a, b) => b.vintage - a.vintage),
        }))
        .filter((r) => r.vintages.length >= 2)
        .sort((a, b) => b.vintages.length - a.vintages.length)
        .slice(0, 5);

      const stats: VintageStats = {
        byVintage,
        bestVintages,
        vintagesByRegion,
      };

      return stats;
    },
    retry: 1,
  });
}

export function useTasteProfile() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["analytics", "taste-profile"],
    queryFn: async () => {
      // Get all ratings with wine reference
      const { data: ratings, error } = await supabase
        .from("ratings")
        .select(`
          *,
          inventory:cellar_inventory (
            wine_reference (*)
          )
        `);

      if (error) throw error;

      type RatingWithInventory = Rating & {
        inventory: { wine_reference: WineReference | null } | null;
      };

      const allRatings = ratings as RatingWithInventory[];

      if (allRatings.length === 0) {
        return null;
      }

      const scores = allRatings.map((r) => r.score);
      const averageRating = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Rating distribution (buckets of 5: 80-84, 85-89, etc.)
      const distribution = new Map<number, number>();
      for (let bucket = 50; bucket <= 100; bucket += 5) {
        distribution.set(bucket, 0);
      }
      allRatings.forEach((r) => {
        const bucket = Math.floor(r.score / 5) * 5;
        distribution.set(bucket, (distribution.get(bucket) || 0) + 1);
      });

      // By type
      const typeMap = new Map<string, number[]>();
      allRatings.forEach((r) => {
        const type = r.inventory?.wine_reference?.wine_type || "unknown";
        if (!typeMap.has(type)) typeMap.set(type, []);
        typeMap.get(type)!.push(r.score);
      });

      // By region
      const regionMap = new Map<string, number[]>();
      allRatings.forEach((r) => {
        const region = r.inventory?.wine_reference?.region || "Unknown";
        if (!regionMap.has(region)) regionMap.set(region, []);
        regionMap.get(region)!.push(r.score);
      });

      // By producer
      const producerMap = new Map<string, number[]>();
      allRatings.forEach((r) => {
        const producer = r.inventory?.wine_reference?.producer;
        if (producer) {
          if (!producerMap.has(producer)) producerMap.set(producer, []);
          producerMap.get(producer)!.push(r.score);
        }
      });

      // By characteristics
      const bodyMap = new Map<string, number[]>();
      const tanninMap = new Map<string, number[]>();
      const acidityMap = new Map<string, number[]>();
      const sweetnessMap = new Map<string, number[]>();

      allRatings.forEach((r) => {
        if (r.body) {
          if (!bodyMap.has(r.body)) bodyMap.set(r.body, []);
          bodyMap.get(r.body)!.push(r.score);
        }
        if (r.tannins) {
          if (!tanninMap.has(r.tannins)) tanninMap.set(r.tannins, []);
          tanninMap.get(r.tannins)!.push(r.score);
        }
        if (r.acidity) {
          if (!acidityMap.has(r.acidity)) acidityMap.set(r.acidity, []);
          acidityMap.get(r.acidity)!.push(r.score);
        }
        if (r.sweetness) {
          if (!sweetnessMap.has(r.sweetness)) sweetnessMap.set(r.sweetness, []);
          sweetnessMap.get(r.sweetness)!.push(r.score);
        }
      });

      const mapToStats = (map: Map<string, number[]>) =>
        [...map.entries()]
          .map(([level, scores]) => ({
            level,
            avgRating: scores.reduce((a, b) => a + b, 0) / scores.length,
            count: scores.length,
          }))
          .sort((a, b) => b.avgRating - a.avgRating);

      // Generate insights
      const insights: string[] = [];

      const preferredTypes = [...typeMap.entries()]
        .map(([type, scores]) => ({
          type,
          avgRating: scores.reduce((a, b) => a + b, 0) / scores.length,
          count: scores.length,
        }))
        .filter((t) => t.count >= 2)
        .sort((a, b) => b.avgRating - a.avgRating);

      if (preferredTypes[0]) {
        insights.push(
          `You tend to rate ${preferredTypes[0].type} wines highest (avg ${preferredTypes[0].avgRating.toFixed(1)} pts)`
        );
      }

      const preferredRegions = [...regionMap.entries()]
        .map(([region, scores]) => ({
          region,
          avgRating: scores.reduce((a, b) => a + b, 0) / scores.length,
          count: scores.length,
        }))
        .filter((r) => r.count >= 2)
        .sort((a, b) => b.avgRating - a.avgRating);

      if (preferredRegions[0]) {
        insights.push(
          `${preferredRegions[0].region} is your favorite region (avg ${preferredRegions[0].avgRating.toFixed(1)} pts)`
        );
      }

      const bodyStats = mapToStats(bodyMap);
      if (bodyStats[0] && bodyStats[0].count >= 2) {
        insights.push(
          `You prefer ${bodyStats[0].level} bodied wines`
        );
      }

      const preferredProducers = [...producerMap.entries()]
        .map(([producer, scores]) => ({
          producer,
          avgRating: scores.reduce((a, b) => a + b, 0) / scores.length,
          count: scores.length,
        }))
        .filter((p) => p.count >= 2)
        .sort((a, b) => b.avgRating - a.avgRating);

      if (preferredProducers[0]) {
        insights.push(
          `${preferredProducers[0].producer} is a consistent favorite (${preferredProducers[0].count} wines rated)`
        );
      }

      const profile: TasteProfile = {
        averageRating,
        totalRatings: allRatings.length,
        ratingDistribution: [...distribution.entries()]
          .map(([score, count]) => ({ score, count }))
          .filter((d) => d.count > 0)
          .sort((a, b) => a.score - b.score),
        preferredTypes,
        preferredRegions: preferredRegions.slice(0, 10),
        preferredProducers: preferredProducers.slice(0, 5),
        characteristics: {
          body: bodyStats,
          tannins: mapToStats(tanninMap),
          acidity: mapToStats(acidityMap),
          sweetness: mapToStats(sweetnessMap),
        },
        insights,
      };

      return profile;
    },
    retry: 1,
  });
}
