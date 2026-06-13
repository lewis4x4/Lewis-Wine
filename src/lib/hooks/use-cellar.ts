"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isPriceObservationStale } from "@/lib/current-intelligence/price-observations";
import type { ObservationKind, ReviewStatus, SourceType, TruthLabel } from "@/lib/current-intelligence/types";
import type { Cellar, CellarInventory, CellarInventoryInsert, WineReference, Rating, RatingSignal } from "@/types/database";

type PriceObservationSummary = {
  review_status?: string | null;
  truth_label?: string | null;
  observed_at?: string | null;
  observation_kind?: string | null;
  observed_price_cents?: number | null;
  source_type?: string | null;
  confidence?: number | null;
};

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
          ratings (
            id,
            score,
            tasting_date,
            tasting_notes,
            nose_notes,
            palate_notes,
            rating_signals (*)
          ),
          wine_price_observations (
            review_status,
            truth_label,
            observed_at,
            observation_kind,
            observed_price_cents,
            source_type,
            confidence
          )
        `)
        .eq("status", "in_cellar")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown> & {
        id: string;
        wine_price_observations?: PriceObservationSummary[] | null;
      }>;
      const enriched = rows.map((wine) => {
        const observations = wine.wine_price_observations ?? [];
        const accepted = observations.filter((observation) => observation.review_status === "accepted");
        const stale = accepted.filter((observation) => isPriceObservationStale({
          id: "summary",
          inventoryId: wine.id,
          sourceType: (observation.source_type ?? "unknown") as SourceType,
          observationKind: (observation.observation_kind ?? "estimate") as ObservationKind,
          truthLabel: (observation.truth_label ?? "unknown") as TruthLabel,
          reviewStatus: "accepted" as ReviewStatus,
          observedPriceCents: observation.observed_price_cents ?? null,
          currency: "USD",
          confidence: observation.confidence ?? 0,
          observedAt: observation.observed_at ?? new Date(0).toISOString(),
        })).length;
        return {
          ...wine,
          accepted_price_evidence_count: accepted.length,
          stale_price_evidence_count: stale,
          evidence_awaiting_review_count: observations.filter((observation) => observation.review_status === "draft").length,
        };
      });

      return enriched as (CellarInventory & {
        wine_reference: WineReference | null;
        ratings: (Rating & { rating_signals?: RatingSignal[] | null })[];
        accepted_price_evidence_count?: number;
        stale_price_evidence_count?: number;
        evidence_awaiting_review_count?: number;
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
