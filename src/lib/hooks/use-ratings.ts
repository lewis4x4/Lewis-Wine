"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import type { RatingInsert, FoodPairingInsert } from "@/types/database";
import type { FoodPairingData } from "@/components/tasting";

interface EnhancedRatingInsert extends Omit<RatingInsert, "user_id"> {
  food_pairings?: FoodPairingData[];
}

export function useAddRating() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rating: EnhancedRatingInsert) => {
      if (!user) throw new Error("Not authenticated");

      const { food_pairings, ...ratingData } = rating;

      // Insert the rating
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ratingResult, error: ratingError } = await (supabase as any)
        .from("ratings")
        .insert({
          ...ratingData,
          user_id: user.id,
          tasting_date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (ratingError) throw ratingError;

      // Insert food pairings if any
      if (food_pairings && food_pairings.length > 0) {
        const pairingsToInsert = food_pairings
          .filter((p) => p.dish_name.trim())
          .map((p) => ({
            rating_id: ratingResult.id,
            user_id: user.id,
            dish_name: p.dish_name,
            dish_category: p.dish_category,
            cuisine_type: p.cuisine_type,
            pairing_rating: p.pairing_rating,
            pairing_notes: p.pairing_notes,
            would_recommend: p.would_recommend,
          }));

        if (pairingsToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: pairingError } = await (supabase as any)
            .from("food_pairings")
            .insert(pairingsToInsert);

          if (pairingError) {
            console.error("Error inserting food pairings:", pairingError);
            // Don't throw - rating was already saved
          }
        }
      }

      return ratingResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ratings"] });
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["recent-companions"] });
      if (variables.inventory_id) {
        queryClient.invalidateQueries({ queryKey: ["wine-detail", variables.inventory_id] });
      }
    },
  });
}

// Get recent companions for suggestions
export function useRecentCompanions() {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["recent-companions", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("ratings")
        .select("companions")
        .eq("user_id", user.id)
        .not("companions", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching companions:", error);
        return [];
      }

      // Flatten and dedupe companions
      const allCompanions = data
        .flatMap((r: { companions: string[] | null }) => r.companions || [])
        .filter(Boolean);

      const uniqueCompanions = [...new Set(allCompanions)] as string[];
      return uniqueCompanions.slice(0, 20);
    },
    enabled: !!user,
  });
}

export function useDeleteRating() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("ratings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings"] });
      queryClient.invalidateQueries({ queryKey: ["cellar-inventory"] });
    },
  });
}
