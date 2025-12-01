"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CellarLocation, LocationMode } from "@/types/database";

const supabase = createClient();

// Fetch all locations for a cellar
export function useCellarLocations(cellarId: string | undefined) {
  return useQuery({
    queryKey: ["cellar-locations", cellarId],
    queryFn: async () => {
      if (!cellarId) return [];

      // Use type assertion since cellar_locations may not be in generated types yet
      const { data, error } = await (supabase
        .from("cellar_locations" as "cellar_locations")
        .select("*")
        .eq("cellar_id", cellarId)
        .order("sort_order", { ascending: true }) as unknown as Promise<{ data: CellarLocation[] | null; error: Error | null }>);

      if (error) {
        // Table might not exist yet if migration not run
        console.warn("cellar_locations query error:", error);
        return [];
      }
      return (data || []) as CellarLocation[];
    },
    enabled: !!cellarId,
  });
}

// Fetch unique simple locations used in inventory (for autocomplete)
export function useSimpleLocations(cellarId: string | undefined) {
  return useQuery({
    queryKey: ["simple-locations", cellarId],
    queryFn: async () => {
      if (!cellarId) return [];

      try {
        // Note: simple_location column added in migration 00002
        const { data, error } = await supabase
          .from("cellar_inventory")
          .select("simple_location" as "*")
          .eq("cellar_id", cellarId)
          .not("simple_location" as "cellar_id", "is", null)
          .order("simple_location" as "cellar_id");

        if (error) {
          // If column doesn't exist yet, return empty array
          if (error.message?.includes("simple_location")) {
            return [];
          }
          throw error;
        }

        // Get unique locations - cast to handle type inference
        const rows = data as unknown as { simple_location: string | null }[];
        const locations = [...new Set(rows.map((d) => d.simple_location).filter(Boolean))] as string[];
        return locations;
      } catch {
        // Column might not exist yet
        return [];
      }
    },
    enabled: !!cellarId,
  });
}

// Add a new location
export function useAddLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (location: Omit<CellarLocation, "id" | "created_at">) => {
      // Use type assertion for table not in generated types
      const { data, error } = await (supabase
        .from("cellar_locations" as "cellar_locations")
        .insert(location as never)
        .select()
        .single() as unknown as Promise<{ data: CellarLocation | null; error: Error | null }>);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cellar-locations", variables.cellar_id] });
    },
  });
}

// Update a location
export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      cellarId,
      ...updates
    }: Partial<CellarLocation> & { id: string; cellarId: string }) => {
      // Use type assertion for table not in generated types
      const { data, error } = await (supabase
        .from("cellar_locations" as "cellar_locations")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single() as unknown as Promise<{ data: CellarLocation | null; error: Error | null }>);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cellar-locations", variables.cellarId] });
    },
  });
}

// Delete a location
export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, cellarId }: { id: string; cellarId: string }) => {
      // Use type assertion for table not in generated types
      const { error } = await (supabase
        .from("cellar_locations" as "cellar_locations")
        .delete()
        .eq("id", id) as unknown as Promise<{ error: Error | null }>);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cellar-locations", variables.cellarId] });
    },
  });
}

// Update cellar location mode
export function useUpdateLocationMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cellarId,
      mode,
    }: {
      cellarId: string;
      mode: LocationMode;
    }) => {
      // Use type assertion for column not in generated types
      const { data, error } = await supabase
        .from("cellars")
        .update({ location_mode: mode } as never)
        .eq("id", cellarId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar"] });
    },
  });
}

// Assign location to inventory item (for structured/grid modes)
export function useAssignLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      locationId,
    }: {
      inventoryId: string;
      locationId: string | null;
    }) => {
      const { data, error } = await supabase
        .from("cellar_inventory")
        .update({ location_id: locationId } as never)
        .eq("id", inventoryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
    },
  });
}

// Update simple location for inventory item
export function useUpdateSimpleLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inventoryId,
      simpleLocation,
    }: {
      inventoryId: string;
      simpleLocation: string | null;
    }) => {
      const { data, error } = await supabase
        .from("cellar_inventory")
        .update({ simple_location: simpleLocation } as never)
        .eq("id", inventoryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["simple-locations"] });
    },
  });
}

// Get location display string based on mode
export function getLocationDisplayString(
  item: {
    simple_location?: string | null;
    location?: CellarLocation | null;
  },
  mode: LocationMode = "simple"
): string | null {
  if (mode === "simple") {
    return item.simple_location || null;
  }

  const loc = item.location;
  if (!loc) return null;

  if (mode === "structured") {
    const parts = [loc.zone, loc.rack, loc.shelf, loc.position].filter(Boolean);
    return parts.length > 0 ? parts.join(" → ") : loc.name || null;
  }

  if (mode === "grid") {
    return loc.name || `${loc.rack}-${loc.shelf}` || null;
  }

  return null;
}
