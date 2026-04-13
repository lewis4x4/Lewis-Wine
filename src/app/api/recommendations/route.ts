import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type TonightContext = {
  meal?: string;
  occasion?: string;
  mood?: string;
  adventurous?: "safe" | "balanced" | "adventurous";
};

export type TonightRecommendation = {
  id: string;
  inventory_id: string;
  name: string;
  producer: string;
  region: string;
  country: string;
  wine_type: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | "unknown";
  vintage_label: string;
  quantity: number;
  price_context: string;
  confidence: number;
  reason: string;
  best_for: string;
  caution: string;
  recommendation_type: "best-now" | "alternate";
};

export type RecommendationsResponse = {
  success: boolean;
  context: TonightContext;
  headline: string;
  summary: string;
  confidence_note: string;
  fallback_prompt: string | null;
  primary: TonightRecommendation | null;
  alternates: TonightRecommendation[];
  error?: string;
};

type InventoryRow = {
  id: string;
  quantity: number;
  vintage: number | null;
  custom_name: string | null;
  custom_producer: string | null;
  custom_region: string | null;
  custom_wine_type: TonightRecommendation["wine_type"] | null;
  purchase_price_cents: number | null;
  current_market_value_cents: number | null;
  wine_reference: {
    name: string;
    producer: string | null;
    region: string | null;
    country: string | null;
    wine_type: TonightRecommendation["wine_type"] | null;
  } | null;
  ratings: { score: number; tasting_notes: string | null }[];
};

function normalizeType(item: InventoryRow): TonightRecommendation["wine_type"] {
  return item.wine_reference?.wine_type || item.custom_wine_type || "unknown";
}

function formatPriceContext(item: InventoryRow): string {
  const cents = item.current_market_value_cents ?? item.purchase_price_cents;
  if (!cents) return "Value still unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function averageRating(item: InventoryRow): number | null {
  if (!item.ratings || item.ratings.length === 0) return null;
  return item.ratings.reduce((sum, r) => sum + r.score, 0) / item.ratings.length;
}

function scoreBottle(item: InventoryRow, context: TonightContext): { score: number; reason: string; bestFor: string; caution: string } {
  const wineType = normalizeType(item);
  const avg = averageRating(item);
  let score = 50;
  const reasons: string[] = [];
  const cautions: string[] = [];

  if (avg != null) {
    score += Math.round((avg - 80) * 1.5);
    reasons.push(`You have rated similar moments around ${Math.round(avg)}/100.`);
  } else {
    reasons.push("This bottle gives you a chance to create a fresh taste memory.");
  }

  if (item.quantity === 1) {
    score += 6;
    reasons.push("It feels like a distinctive one-bottle decision, which suits a deliberate tonight pick.");
  } else if (item.quantity > 3) {
    score += 2;
    reasons.push("You have enough of it to open without overthinking scarcity.");
  }

  const meal = (context.meal || "").toLowerCase();
  if (meal.includes("steak") || meal.includes("beef") || meal.includes("bbq")) {
    if (wineType === "red") {
      score += 12;
      reasons.push("The meal context leans red, and this bottle fits that lane.");
    } else {
      cautions.push("The current meal cue may favor a red over this style.");
    }
  }
  if (meal.includes("seafood") || meal.includes("fish") || meal.includes("salad") || meal.includes("chicken")) {
    if (wineType === "white" || wineType === "rose" || wineType === "sparkling") {
      score += 12;
      reasons.push("The meal context leans lighter and this bottle fits that profile.");
    }
  }
  if (meal.includes("dessert") && wineType === "dessert") {
    score += 12;
    reasons.push("Dessert context makes this a natural fit.");
  }

  const occasion = (context.occasion || "").toLowerCase();
  if (occasion.includes("celebr") || occasion.includes("anniversary") || occasion.includes("special")) {
    if (item.current_market_value_cents || item.purchase_price_cents) score += 6;
    reasons.push("The occasion suggests choosing something that feels a little elevated.");
  }
  if (occasion.includes("casual") || occasion.includes("weeknight")) {
    score += 3;
    reasons.push("The occasion points toward a bottle that is easy to enjoy without ceremony.");
  }

  const adventurous = context.adventurous || "balanced";
  if (adventurous === "safe" && avg != null) score += 5;
  if (adventurous === "adventurous" && avg == null) score += 7;

  const mood = (context.mood || "").toLowerCase();
  if (mood.includes("cozy") || mood.includes("comfort")) {
    if (wineType === "red" || wineType === "dessert") score += 5;
  }
  if (mood.includes("fresh") || mood.includes("bright")) {
    if (wineType === "white" || wineType === "rose" || wineType === "sparkling") score += 5;
  }

  if (!item.current_market_value_cents && !item.purchase_price_cents) {
    cautions.push("Value is unknown, so this is a taste-led pick rather than a portfolio-led one.");
  }
  if (item.vintage != null && (item.vintage < 1000 || item.vintage > new Date().getFullYear() + 1)) {
    cautions.push("Vintage data looks malformed, so age-based confidence is reduced.");
    score -= 4;
  }

  return {
    score,
    reason: reasons[0] || "This bottle fits the current moment better than the rest of the visible cellar.",
    bestFor: reasons[1] || "A confident tonight pick from your real cellar.",
    caution: cautions[0] || "Low structural risk based on the current context.",
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context: TonightContext = {
      meal: url.searchParams.get("meal") || undefined,
      occasion: url.searchParams.get("occasion") || undefined,
      mood: url.searchParams.get("mood") || undefined,
      adventurous: (url.searchParams.get("adventurous") as TonightContext["adventurous"]) || "balanced",
    };

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized", headline: "Tonight Engine", summary: "", confidence_note: "", fallback_prompt: null, primary: null, alternates: [] }, { status: 401 });
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
      });
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
        wine_reference (
          name,
          producer,
          region,
          country,
          wine_type
        ),
        ratings (
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
      return NextResponse.json({
        success: true,
        context,
        headline: "Tonight Engine",
        summary: "Your active cellar is empty right now, so there is nothing to recommend for tonight yet.",
        confidence_note: "No inventory means no recommendation confidence yet.",
        fallback_prompt: "Restock the cellar or restore a consumed bottle to give Tonight Engine something real to choose from.",
        primary: null,
        alternates: [],
      });
    }

    const ranked = rows
      .map((item) => {
        const scored = scoreBottle(item, context);
        return {
          id: item.id,
          inventory_id: item.id,
          name: item.wine_reference?.name || item.custom_name || "Unknown bottle",
          producer: item.wine_reference?.producer || item.custom_producer || "Unknown producer",
          region: item.wine_reference?.region || item.custom_region || "Region unknown",
          country: item.wine_reference?.country || "Country unknown",
          wine_type: normalizeType(item),
          vintage_label: item.vintage ? String(item.vintage) : "Vintage unknown",
          quantity: item.quantity,
          price_context: formatPriceContext(item),
          confidence: Math.max(55, Math.min(96, scored.score)),
          reason: scored.reason,
          best_for: scored.bestFor,
          caution: scored.caution,
          recommendation_type: "alternate" as const,
          sortScore: scored.score,
        };
      })
      .sort((a, b) => b.sortScore - a.sortScore);

    const [first, ...rest] = ranked;
    const primary: TonightRecommendation | null = first
      ? { ...first, recommendation_type: "best-now" }
      : null;
    const alternates: TonightRecommendation[] = rest.slice(0, 2).map((item) => ({ ...item, recommendation_type: "alternate" }));

    const sparseData = rows.filter((item) => {
      const hasReference = !!item.wine_reference;
      const hasRatings = item.ratings.length > 0;
      const hasValue = item.current_market_value_cents != null || item.purchase_price_cents != null;
      return !hasReference || !hasRatings || !hasValue;
    }).length;

    const headline = primary
      ? `Tonight, open ${primary.vintage_label !== "Vintage unknown" ? `${primary.vintage_label} ` : ""}${primary.name}.`
      : "Tonight Engine";
    const summary = primary
      ? `This recommendation is based on your real cellar, your current context, and the strongest available fit for tonight rather than a generic wine list.`
      : "Tonight Engine could not find a strong primary bottle.";
    const confidence_note = sparseData >= Math.max(1, Math.ceil(rows.length * 0.6))
      ? "Confidence is directionally strong, but the cellar data is still sparse enough that a few better notes or value signals would sharpen future picks."
      : "Confidence is supported by enough live cellar detail to make this feel like a grounded tonight decision.";
    const fallbackPrompt = sparseData >= Math.max(1, Math.ceil(rows.length * 0.6))
      ? "Best next upgrade: add one tasting note or one missing value signal to improve the next recommendation cycle."
      : null;

    return NextResponse.json({
      success: true,
      context,
      headline,
      summary,
      confidence_note,
      fallback_prompt: fallbackPrompt,
      primary,
      alternates,
    });
  } catch (error) {
    console.error("Tonight Engine error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to generate tonight recommendations", headline: "Tonight Engine", summary: "", confidence_note: "", fallback_prompt: null, primary: null, alternates: [] }, { status: 500 });
  }
}
