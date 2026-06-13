"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isWineApproachingPeak, isWineReadyNow } from "@/lib/wine-readiness";

const supabase = createClient();

// Update low stock settings for a wine
export function useUpdateLowStockSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      threshold,
      alertEnabled,
    }: {
      inventoryId: string;
      threshold: number | null;
      alertEnabled: boolean;
    }) => {
      const { data, error } = await supabase
        .from("cellar_inventory")
        .update({
          low_stock_threshold: threshold,
          low_stock_alert_enabled: alertEnabled,
        } as never)
        .eq("id", inventoryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["wine-detail"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-wines"] });
    },
  });
}

// Get wines that are low on stock
export function useLowStockWines(cellarId: string | undefined) {
  return useQuery({
    queryKey: ["low-stock-wines", cellarId],
    queryFn: async () => {
      if (!cellarId) return [];

      try {
        // Get all inventory items with low stock alerts enabled
        const { data, error } = await supabase
          .from("cellar_inventory")
          .select(`
            *,
            wine_reference (*)
          `)
          .eq("cellar_id", cellarId)
          .eq("low_stock_alert_enabled" as "cellar_id", true)
          .eq("consumed", false);

        if (error) {
          // Column might not exist yet
          if (error.message?.includes("low_stock")) {
            return [];
          }
          throw error;
        }

        // Filter to only those below threshold
        const lowStockItems = (data || []).filter((item: {
          quantity: number;
          low_stock_threshold: number | null;
          low_stock_alert_enabled: boolean;
        }) => {
          const threshold = item.low_stock_threshold || 0;
          return item.quantity <= threshold;
        });

        return lowStockItems;
      } catch {
        return [];
      }
    },
    enabled: !!cellarId,
  });
}

// Get wines in their drinking window (ready to drink)
export function useDrinkingWindowWines(cellarId: string | undefined) {
  return useQuery({
    queryKey: ["drinking-window-wines", cellarId],
    queryFn: async () => {
      if (!cellarId) return [];

      const now = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*)
        `)
        .eq("cellar_id", cellarId)
        .eq("consumed", false)
        .or(`drink_after.lte.${now},drink_after.is.null`)
        .or(`drink_before.gte.${now},drink_before.is.null`);

      if (error) throw error;

      const readyToDrink = (data || []).filter((item: {
        drink_after: string | null;
        drink_before: string | null;
      }) => isWineReadyNow(item));

      return readyToDrink;
    },
    enabled: !!cellarId,
  });
}

// Get wines approaching peak drinking window (within 30 days of drink_before)
export function useApproachingPeakWines(cellarId: string | undefined) {
  return useQuery({
    queryKey: ["approaching-peak-wines", cellarId],
    queryFn: async () => {
      if (!cellarId) return [];

      const { data, error } = await supabase
        .from("cellar_inventory")
        .select(`
          *,
          wine_reference (*)
        `)
        .eq("cellar_id", cellarId)
        .eq("consumed", false)
        .not("drink_before", "is", null);

      if (error) throw error;

      const approachingPeak = (data || []).filter((item: {
        drink_before: string | null;
      }) => isWineApproachingPeak(item));

      return approachingPeak;
    },
    enabled: !!cellarId,
  });
}
