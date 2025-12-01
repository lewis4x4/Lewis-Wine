"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  ShoppingList,
  ShoppingListInsert,
  ShoppingListUpdate,
  ShoppingListWithWine,
  ShoppingStatus,
  ShoppingUrgency,
} from "@/types/database";

export function useShoppingList(status?: ShoppingStatus) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["shopping-list", status],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("shopping_list")
        .select(`
          *,
          wine_reference (*),
          cellar_inventory (*)
        `)
        .order("urgency", { ascending: false })
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ShoppingListWithWine[];
    },
  });
}

export function useShoppingListItem(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["shopping-list", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shopping_list")
        .select(`
          *,
          wine_reference (*),
          cellar_inventory (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as ShoppingListWithWine;
    },
    enabled: !!id,
  });
}

export function useAddToShoppingList() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (item: ShoppingListInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shopping_list")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data as ShoppingList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });
}

export function useUpdateShoppingList() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: ShoppingListUpdate & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shopping_list")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ShoppingList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });
}

export function useMarkShoppingPurchased() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      purchased_quantity,
      purchased_price_cents,
      purchased_from,
    }: {
      id: string;
      purchased_quantity: number;
      purchased_price_cents?: number;
      purchased_from?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shopping_list")
        .update({
          status: "purchased",
          purchased_date: new Date().toISOString().split("T")[0],
          purchased_quantity,
          purchased_price_cents,
          purchased_from,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ShoppingList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("shopping_list")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });
}

export function useShoppingListStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["shopping-list-stats"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shopping_list")
        .select("status, urgency, quantity_needed, target_price_cents");

      if (error) throw error;

      type ShoppingData = { status: string; urgency: string; quantity_needed: number | null; target_price_cents: number | null };
      const items = data as ShoppingData[];
      const activeItems = items.filter((s) => s.status === "active");

      const stats = {
        total: items.length,
        active: activeItems.length,
        purchased: items.filter((s) => s.status === "purchased").length,
        totalBottlesNeeded: activeItems.reduce((sum, s) => sum + (s.quantity_needed || 0), 0),
        byUrgency: {
          urgent: activeItems.filter((s) => s.urgency === "urgent").length,
          high: activeItems.filter((s) => s.urgency === "high").length,
          normal: activeItems.filter((s) => s.urgency === "normal").length,
          low: activeItems.filter((s) => s.urgency === "low").length,
        },
        estimatedCost: activeItems
          .filter((s) => s.target_price_cents)
          .reduce((sum, s) => sum + (s.target_price_cents || 0) * (s.quantity_needed || 1), 0),
      };

      return stats;
    },
  });
}
