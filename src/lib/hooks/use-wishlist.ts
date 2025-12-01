"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Wishlist,
  WishlistInsert,
  WishlistUpdate,
  WishlistWithWine,
  WishlistStatus,
  WishlistPriority,
} from "@/types/database";

export function useWishlist(status?: WishlistStatus) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["wishlist", status],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("wishlist")
        .select(`
          *,
          wine_reference (*)
        `)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as WishlistWithWine[];
    },
  });
}

export function useWishlistItem(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["wishlist", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wishlist")
        .select(`
          *,
          wine_reference (*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as WishlistWithWine;
    },
    enabled: !!id,
  });
}

export function useAddToWishlist() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (item: WishlistInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wishlist")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data as Wishlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}

export function useUpdateWishlist() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: WishlistUpdate & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wishlist")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Wishlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}

export function useMarkWishlistPurchased() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      id,
      purchased_price_cents,
      purchased_from,
    }: {
      id: string;
      purchased_price_cents?: number;
      purchased_from?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wishlist")
        .update({
          status: "purchased",
          purchased_date: new Date().toISOString().split("T")[0],
          purchased_price_cents,
          purchased_from,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Wishlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("wishlist")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });
}

export function useWishlistStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["wishlist-stats"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wishlist")
        .select("status, priority, target_price_cents");

      if (error) throw error;

      type WishlistData = { status: string; priority: string; target_price_cents: number | null };
      const items = data as WishlistData[];

      const stats = {
        total: items.length,
        active: items.filter((w) => w.status === "active").length,
        purchased: items.filter((w) => w.status === "purchased").length,
        byPriority: {
          "must-have": items.filter((w) => w.priority === "must-have" && w.status === "active").length,
          high: items.filter((w) => w.priority === "high" && w.status === "active").length,
          medium: items.filter((w) => w.priority === "medium" && w.status === "active").length,
          low: items.filter((w) => w.priority === "low" && w.status === "active").length,
        },
        estimatedCost: items
          .filter((w) => w.status === "active" && w.target_price_cents)
          .reduce((sum, w) => sum + (w.target_price_cents || 0), 0),
      };

      return stats;
    },
  });
}
