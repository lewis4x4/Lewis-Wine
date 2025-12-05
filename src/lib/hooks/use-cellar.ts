"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Cellar, CellarInventory, CellarInventoryInsert, WineReference, Rating } from "@/types/database";

export function useCellar() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["cellar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cellars")
        .select("*")
        .single();

      if (error) throw error;
      return data as Cellar;
    },
  });
}

export function useCellarInventory() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["cellar-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*),
          ratings (id, score, tasting_date, tasting_notes)
        `)
        .eq("status", "in_cellar")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as (CellarInventory & {
        wine_reference: WineReference | null;
        ratings: Rating[];
      })[];
    },
  });
}

export function useAddToInventory() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (wine: CellarInventoryInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .insert(wine)
        .select()
        .single();

      if (error) throw error;
      return data as CellarInventory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["cellar"] });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<CellarInventory> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CellarInventory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["cellar"] });
    },
  });
}

export function useConsumeWine() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .update({
          status: "consumed",
          consumed_date: new Date().toISOString().split("T")[0],
          quantity: 0,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CellarInventory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["consumed-wines"] });
      queryClient.invalidateQueries({ queryKey: ["cellar"] });
    },
  });
}

export function useConsumedWines() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["consumed-wines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*),
          ratings (id, score, tasting_date, tasting_notes)
        `)
        .eq("status", "consumed")
        .order("consumed_date", { ascending: false });

      if (error) throw error;
      return data as (CellarInventory & {
        wine_reference: WineReference | null;
        ratings: Rating[];
      })[];
    },
  });
}

export function useRestoreWine() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, quantity = 1 }: { id: string; quantity?: number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .update({
          status: "in_cellar",
          consumed_date: null,
          quantity,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as CellarInventory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["consumed-wines"] });
      queryClient.invalidateQueries({ queryKey: ["cellar"] });
      queryClient.invalidateQueries({ queryKey: ["wine-detail"] });
    },
  });
}
