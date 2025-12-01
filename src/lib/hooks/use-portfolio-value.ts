"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCellar } from "./use-cellar";
import type { CellarValueSummary, MarketValueSource } from "@/types/database";

// Calculate cellar value summary
export function useCellarValue() {
  const supabase = createClient();
  const { data: cellar } = useCellar();

  return useQuery({
    queryKey: ["cellar-value", cellar?.id],
    queryFn: async (): Promise<CellarValueSummary> => {
      if (!cellar?.id) {
        return {
          total_bottles: 0,
          total_purchase_cents: 0,
          total_market_cents: 0,
          gain_loss_cents: 0,
          gain_loss_percentage: 0,
        };
      }

      // Get all inventory items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .select("quantity, purchase_price_cents, current_market_value_cents")
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar");

      if (error) throw error;

      const items = data || [];

      const totals = items.reduce(
        (acc: CellarValueSummary, item: {
          quantity: number;
          purchase_price_cents: number | null;
          current_market_value_cents: number | null;
        }) => {
          const purchaseValue = (item.purchase_price_cents || 0) * item.quantity;
          const marketValue = (item.current_market_value_cents || item.purchase_price_cents || 0) * item.quantity;

          return {
            total_bottles: acc.total_bottles + item.quantity,
            total_purchase_cents: acc.total_purchase_cents + purchaseValue,
            total_market_cents: acc.total_market_cents + marketValue,
            gain_loss_cents: 0,
            gain_loss_percentage: 0,
          };
        },
        {
          total_bottles: 0,
          total_purchase_cents: 0,
          total_market_cents: 0,
          gain_loss_cents: 0,
          gain_loss_percentage: 0,
        }
      );

      // Calculate gain/loss
      totals.gain_loss_cents = totals.total_market_cents - totals.total_purchase_cents;
      totals.gain_loss_percentage = totals.total_purchase_cents > 0
        ? ((totals.total_market_cents - totals.total_purchase_cents) / totals.total_purchase_cents) * 100
        : 0;

      return totals;
    },
    enabled: !!cellar?.id,
  });
}

// Get value breakdown by wine type
export function useValueByType() {
  const supabase = createClient();
  const { data: cellar } = useCellar();

  return useQuery({
    queryKey: ["value-by-type", cellar?.id],
    queryFn: async () => {
      if (!cellar?.id) return {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .select(`
          quantity,
          purchase_price_cents,
          current_market_value_cents,
          wine_reference (wine_type)
        `)
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar");

      if (error) throw error;

      const byType: Record<string, { bottles: number; purchase: number; market: number }> = {};

      for (const item of data || []) {
        const wineType = item.wine_reference?.wine_type || "unknown";
        if (!byType[wineType]) {
          byType[wineType] = { bottles: 0, purchase: 0, market: 0 };
        }
        byType[wineType].bottles += item.quantity;
        byType[wineType].purchase += (item.purchase_price_cents || 0) * item.quantity;
        byType[wineType].market += (item.current_market_value_cents || item.purchase_price_cents || 0) * item.quantity;
      }

      return byType;
    },
    enabled: !!cellar?.id,
  });
}

// Get value breakdown by region
export function useValueByRegion() {
  const supabase = createClient();
  const { data: cellar } = useCellar();

  return useQuery({
    queryKey: ["value-by-region", cellar?.id],
    queryFn: async () => {
      if (!cellar?.id) return {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .select(`
          quantity,
          purchase_price_cents,
          current_market_value_cents,
          wine_reference (region, country)
        `)
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar");

      if (error) throw error;

      const byRegion: Record<string, { bottles: number; purchase: number; market: number }> = {};

      for (const item of data || []) {
        const region = item.wine_reference?.region || item.wine_reference?.country || "Unknown";
        if (!byRegion[region]) {
          byRegion[region] = { bottles: 0, purchase: 0, market: 0 };
        }
        byRegion[region].bottles += item.quantity;
        byRegion[region].purchase += (item.purchase_price_cents || 0) * item.quantity;
        byRegion[region].market += (item.current_market_value_cents || item.purchase_price_cents || 0) * item.quantity;
      }

      return byRegion;
    },
    enabled: !!cellar?.id,
  });
}

// Update market value for a wine
export function useUpdateMarketValue() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      valueCents,
      source,
    }: {
      inventoryId: string;
      valueCents: number;
      source: MarketValueSource;
    }) => {
      // Update the inventory item
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("cellar_inventory")
        .update({
          current_market_value_cents: valueCents,
          market_value_source: source,
          market_value_updated_at: new Date().toISOString(),
        })
        .eq("id", inventoryId);

      if (updateError) throw updateError;

      // Add to value history
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: historyError } = await (supabase as any)
        .from("market_value_history")
        .insert({
          inventory_id: inventoryId,
          value_cents: valueCents,
          source,
        });

      if (historyError) {
        console.error("Error adding to history:", historyError);
        // Don't throw - the main update succeeded
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-value"] });
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["wine-detail"] });
      queryClient.invalidateQueries({ queryKey: ["value-by-type"] });
      queryClient.invalidateQueries({ queryKey: ["value-by-region"] });
    },
  });
}

// Track opened bottle and glasses poured
export function useTrackGlasses() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      glassesPoured,
      isOpened = true,
    }: {
      inventoryId: string;
      glassesPoured: number;
      isOpened?: boolean;
    }) => {
      const updateData: Record<string, unknown> = {
        glasses_poured: glassesPoured,
        is_opened: isOpened,
      };

      // Set opened date if opening for the first time
      if (isOpened) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: current } = await (supabase as any)
          .from("cellar_inventory")
          .select("is_opened, opened_date")
          .eq("id", inventoryId)
          .single();

        if (!current?.is_opened) {
          updateData.opened_date = new Date().toISOString().split("T")[0];
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("cellar_inventory")
        .update(updateData)
        .eq("id", inventoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["wine-detail"] });
    },
  });
}

// Get market value history for a wine
export function useMarketValueHistory(inventoryId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["market-value-history", inventoryId],
    queryFn: async () => {
      if (!inventoryId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("market_value_history")
        .select("*")
        .eq("inventory_id", inventoryId)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!inventoryId,
  });
}

// Get top gainers (wines with highest % gain)
export function useTopGainers(limit = 5) {
  const supabase = createClient();
  const { data: cellar } = useCellar();

  return useQuery({
    queryKey: ["top-gainers", cellar?.id, limit],
    queryFn: async () => {
      if (!cellar?.id) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*)
        `)
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar")
        .not("purchase_price_cents", "is", null)
        .not("current_market_value_cents", "is", null);

      if (error) throw error;

      // Calculate gain percentage and sort
      const withGains = (data || [])
        .map((item: {
          purchase_price_cents: number;
          current_market_value_cents: number;
          [key: string]: unknown;
        }) => ({
          ...item,
          gain_cents: item.current_market_value_cents - item.purchase_price_cents,
          gain_percentage: ((item.current_market_value_cents - item.purchase_price_cents) / item.purchase_price_cents) * 100,
        }))
        .filter((item: { gain_percentage: number }) => item.gain_percentage > 0)
        .sort((a: { gain_percentage: number }, b: { gain_percentage: number }) => b.gain_percentage - a.gain_percentage)
        .slice(0, limit);

      return withGains;
    },
    enabled: !!cellar?.id,
  });
}

// Get wines with no market value set (for prompting user to add)
export function useWinesWithoutValue() {
  const supabase = createClient();
  const { data: cellar } = useCellar();

  return useQuery({
    queryKey: ["wines-without-value", cellar?.id],
    queryFn: async () => {
      if (!cellar?.id) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*)
        `)
        .eq("cellar_id", cellar.id)
        .eq("status", "in_cellar")
        .is("current_market_value_cents", null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!cellar?.id,
  });
}
