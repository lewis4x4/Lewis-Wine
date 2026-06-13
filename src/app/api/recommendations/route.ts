import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveBrianFit } from "@/lib/brian-fit";
import {
  buildTonightRecommendations,
  type RecommendationsResponse,
  type TonightContext,
  type TonightEngineBottle,
  type TonightRecommendation,
  type TonightWineType,
} from "@/lib/tonight-engine";
import type { BrianTasteProfile, RatingSignal } from "@/types/database";

export type { RecommendationsResponse, TonightContext, TonightRecommendation };

type InventoryRow = {
  id: string;
  quantity: number;
  vintage: number | null;
  custom_name: string | null;
  custom_producer: string | null;
  custom_region: string | null;
  custom_wine_type: TonightWineType | null;
  purchase_price_cents: number | null;
  current_market_value_cents: number | null;
  drink_after: string | null;
  drink_before: string | null;
  wine_reference: {
    name: string;
    producer: string | null;
    region: string | null;
    country: string | null;
    wine_type: TonightWineType | null;
  } | null;
  ratings: { id: string; score: number; tasting_notes: string | null }[];
};

function emptyResponse(context: TonightContext, error: string, status: number) {
  return NextResponse.json({
    success: false,
    context,
    error,
    headline: "Tonight Engine",
    summary: "",
    confidence_note: "",
    fallback_prompt: null,
    primary: null,
    alternates: [],
  } satisfies RecommendationsResponse, { status });
}

function normalizeInventoryRow(item: InventoryRow, brianFitByRatingId: Map<string, ReturnType<typeof deriveBrianFit>>): TonightEngineBottle {
  const latestRating = item.ratings[0] || null;
  const brianFit = latestRating ? brianFitByRatingId.get(latestRating.id) ?? null : null;
  return {
    id: item.id,
    name: item.wine_reference?.name || item.custom_name || "Unknown bottle",
    producer: item.wine_reference?.producer || item.custom_producer || null,
    region: item.wine_reference?.region || item.custom_region || null,
    country: item.wine_reference?.country || null,
    wine_type: item.wine_reference?.wine_type || item.custom_wine_type || "unknown",
    vintage: item.vintage,
    quantity: item.quantity,
    drink_after: item.drink_after,
    drink_before: item.drink_before,
    purchase_price_cents: item.purchase_price_cents,
    current_market_value_cents: item.current_market_value_cents,
    ratings: item.ratings,
    brian_fit_score: brianFit?.score ?? null,
    brian_fit_reason: brianFit?.reason ?? null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context: TonightContext = {
    meal: url.searchParams.get("meal") || undefined,
    occasion: url.searchParams.get("occasion") || undefined,
    mood: url.searchParams.get("mood") || undefined,
    adventurous: (url.searchParams.get("adventurous") as TonightContext["adventurous"]) || "balanced",
  };

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return emptyResponse(context, "Unauthorized", 401);
    }

    const { data: cellarRow } = await supabase
      .from("cellars")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    const cellar = cellarRow as { id: string } | null;

    if (!cellar) {
      return NextResponse.json({
        success: true,
        context,
        headline: "Tonight Engine",
        summary: "No cellar found yet. Create your cellar first, then Tonight Engine can start making real decisions.",
        confidence_note: "No cellar means no recommendation confidence yet.",
        fallback_prompt: "Add your first bottle so Tonight Engine can begin learning your real cellar.",
        primary: null,
        alternates: [],
      } satisfies RecommendationsResponse);
    }

    const { data: inventory, error } = await supabase
      .from("cellar_inventory")
      .select(`
        id,
        quantity,
        vintage,
        custom_name,
        custom_producer,
        custom_region,
        custom_wine_type,
        purchase_price_cents,
        current_market_value_cents,
        drink_after,
        drink_before,
        wine_reference (
          name,
          producer,
          region,
          country,
          wine_type
        ),
        ratings (
          id,
          score,
          tasting_notes
        )
      `)
      .eq("cellar_id", cellar.id)
      .eq("status", "in_cellar")
      .gt("quantity", 0)
      .limit(30);

    if (error) throw error;

    const rows = (inventory || []) as InventoryRow[];
    if (rows.length === 0) {
      return NextResponse.json(buildTonightRecommendations([], context));
    }

    const { data: tasteProfile } = await supabase
      .from("brian_taste_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const ratingIds = rows.flatMap((item) => item.ratings.map((rating) => rating.id));
    let signalMap = new Map<string, RatingSignal>();
    if (ratingIds.length > 0) {
      const { data: signals } = await supabase
        .from("rating_signals")
        .select("*")
        .eq("user_id", user.id)
        .in("rating_id", ratingIds);

      signalMap = new Map(((signals || []) as RatingSignal[]).map((signal) => [signal.rating_id, signal]));
    }

    const brianFitByRatingId = new Map<string, ReturnType<typeof deriveBrianFit>>();
    for (const item of rows) {
      const latestRating = item.ratings[0] || null;
      if (!latestRating) continue;
      brianFitByRatingId.set(latestRating.id, deriveBrianFit({
        profile: (tasteProfile as BrianTasteProfile | null) || null,
        ratingSignal: signalMap.get(latestRating.id) || null,
        tastingNotes: latestRating.tasting_notes,
        score: latestRating.score,
      }));
    }

    const bottles = rows.map((item) => normalizeInventoryRow(item, brianFitByRatingId));
    return NextResponse.json(buildTonightRecommendations(bottles, context));
  } catch (error) {
    console.error("Tonight Engine error:", error);
    return emptyResponse(context, error instanceof Error ? error.message : "Failed to generate tonight recommendations", 500);
  }
}
