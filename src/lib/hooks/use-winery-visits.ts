"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  WineryVisit,
  WineryVisitInsert,
  WineryVisitUpdate,
  WineryVisitWithWines,
  WineryVisitWine,
  WineryVisitWineInsert,
  WineryVisitWineUpdate,
} from "@/types/database";

export function useWineryVisits() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["winery-visits"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visits")
        .select(`
          *,
          winery_visit_wines (*)
        `)
        .order("visit_date", { ascending: false });

      if (error) throw error;
      return data as WineryVisitWithWines[];
    },
  });
}

export function useWineryVisit(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["winery-visit", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visits")
        .select(`
          *,
          winery_visit_wines (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as WineryVisitWithWines;
    },
    enabled: !!id,
  });
}

export function useAddWineryVisit() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (visit: WineryVisitInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visits")
        .insert(visit)
        .select()
        .single();

      if (error) throw error;
      return data as WineryVisit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["winery-visits"] });
    },
  });
}

export function useUpdateWineryVisit() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: WineryVisitUpdate & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visits")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as WineryVisit;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["winery-visits"] });
      queryClient.invalidateQueries({ queryKey: ["winery-visit", variables.id] });
    },
  });
}

export function useDeleteWineryVisit() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("winery_visits")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["winery-visits"] });
    },
  });
}

// Winery Visit Wines hooks
export function useAddWineryVisitWine() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (wine: WineryVisitWineInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visit_wines")
        .insert(wine)
        .select()
        .single();

      if (error) throw error;
      return data as WineryVisitWine;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["winery-visits"] });
      queryClient.invalidateQueries({ queryKey: ["winery-visit", variables.visit_id] });
    },
  });
}

export function useUpdateWineryVisitWine() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      visit_id,
      ...updates
    }: WineryVisitWineUpdate & { id: string; visit_id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visit_wines")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as WineryVisitWine;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["winery-visits"] });
      queryClient.invalidateQueries({ queryKey: ["winery-visit", variables.visit_id] });
    },
  });
}

export function useDeleteWineryVisitWine() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, visit_id }: { id: string; visit_id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("winery_visit_wines")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["winery-visits"] });
      queryClient.invalidateQueries({ queryKey: ["winery-visit", variables.visit_id] });
    },
  });
}

export function useWineryVisitStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["winery-visit-stats"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: visits, error: visitsError } = await (supabase as any)
        .from("winery_visits")
        .select("id, winery_name, overall_rating, tasting_fee_cents, visit_date");

      if (visitsError) throw visitsError;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: wines, error: winesError } = await (supabase as any)
        .from("winery_visit_wines")
        .select("visit_id, purchased, quantity_purchased, price_per_bottle_cents, rating");

      if (winesError) throw winesError;

      type VisitData = { id: string; winery_name: string; overall_rating: number | null; tasting_fee_cents: number | null; visit_date: string };
      type WineData = { visit_id: string; purchased: boolean; quantity_purchased: number | null; price_per_bottle_cents: number | null; rating: number | null };

      const visitsData = visits as VisitData[];
      const winesData = wines as WineData[];

      const uniqueWineries = new Set(visitsData.map((v) => v.winery_name)).size;
      const totalSpentOnTastings = visitsData.reduce(
        (sum, v) => sum + (v.tasting_fee_cents || 0),
        0
      );
      const totalSpentOnWines = winesData
        .filter((w) => w.purchased)
        .reduce(
          (sum, w) => sum + (w.price_per_bottle_cents || 0) * (w.quantity_purchased || 1),
          0
        );

      const stats = {
        totalVisits: visitsData.length,
        uniqueWineries,
        winesTasted: winesData.length,
        winesPurchased: winesData.filter((w) => w.purchased).length,
        bottlesPurchased: winesData
          .filter((w) => w.purchased)
          .reduce((sum, w) => sum + (w.quantity_purchased || 1), 0),
        totalSpentOnTastings,
        totalSpentOnWines,
        totalSpent: totalSpentOnTastings + totalSpentOnWines,
        averageRating:
          visitsData.filter((v) => v.overall_rating).length > 0
            ? visitsData.reduce((sum, v) => sum + (v.overall_rating || 0), 0) /
              visitsData.filter((v) => v.overall_rating).length
            : null,
        thisYear: visitsData.filter(
          (v) => new Date(v.visit_date).getFullYear() === new Date().getFullYear()
        ).length,
      };

      return stats;
    },
  });
}

export function useRecentWineries() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["recent-wineries"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("winery_visits")
        .select("winery_name, winery_region")
        .order("visit_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get unique wineries
      const unique = Array.from(
        new Map((data as { winery_name: string; winery_region: string | null }[]).map((w) => [w.winery_name, w])).values()
      ) as { winery_name: string; winery_region: string | null }[];

      return unique;
    },
  });
}
