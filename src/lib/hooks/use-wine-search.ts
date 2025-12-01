"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { WineReference } from "@/types/database";

export function useWineSearch(query: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["wine-search", query],
    queryFn: async () => {
      if (query.length < 2) return [];

      const { data, error } = await supabase
        .from("wine_reference")
        .select("*")
        .or(`name.ilike.%${query}%,producer.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      return data as WineReference[];
    },
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useWineByBarcode(barcode: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["wine-barcode", barcode],
    queryFn: async () => {
      if (!barcode) return null;

      const { data, error } = await supabase
        .from("wine_reference")
        .select("*")
        .eq("barcode", barcode)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
      return data as WineReference | null;
    },
    enabled: !!barcode,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
