"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deriveBrianFit, type BrianFitSummary } from "@/lib/brian-fit";
import type { BrianTasteProfile, Rating, RatingSignal } from "@/types/database";

export type RatingWithSignals = Rating & {
  rating_signals?: RatingSignal[] | null;
};

export function useBrianTasteProfile() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["brian-taste-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brian_taste_profiles")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as BrianTasteProfile | null;
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function getLatestRatingWithSignal(ratings: RatingWithSignals[] | null | undefined) {
  if (!ratings?.length) return null;

  return [...ratings].sort((a, b) => {
    const bDate = b.tasting_date ? new Date(b.tasting_date).getTime() : 0;
    const aDate = a.tasting_date ? new Date(a.tasting_date).getTime() : 0;
    return bDate - aDate;
  })[0];
}

export function getBrianFitForRatings({
  profile,
  ratings,
  fallbackScore,
}: {
  profile: BrianTasteProfile | null | undefined;
  ratings: RatingWithSignals[] | null | undefined;
  fallbackScore?: number | null;
}): BrianFitSummary | null {
  if (!profile && !ratings?.length && fallbackScore == null) return null;

  const latestRating = getLatestRatingWithSignal(ratings);
  const latestSignal = latestRating?.rating_signals?.[0] ?? null;
  const tastingNotes = latestRating?.tasting_notes || latestRating?.palate_notes || latestRating?.nose_notes || null;

  return deriveBrianFit({
    profile: profile ?? null,
    ratingSignal: latestSignal,
    tastingNotes,
    score: latestRating?.score ?? fallbackScore ?? null,
  });
}
