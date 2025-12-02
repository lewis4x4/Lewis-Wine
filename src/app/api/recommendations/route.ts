import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type WineRecommendation = {
  id: string;
  name: string;
  producer: string;
  region: string;
  country: string;
  wine_type: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified";
  grape_varieties: string[];
  vintage_suggestion: string;
  price_range: string;
  why_recommended: string;
  flavor_profile: string[];
  food_pairings: string[];
  confidence: number;
};

export type RecommendationsResponse = {
  success: boolean;
  recommendations: WineRecommendation[];
  taste_summary: string;
  error?: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", recommendations: [] },
        { status: 401 }
      );
    }

    // Fetch user's ratings with wine details
    const { data: ratings, error: ratingsError } = await supabase
      .from("ratings")
      .select(`
        id,
        score,
        tasting_notes,
        nose_notes,
        palate_notes,
        body,
        tannins,
        acidity,
        sweetness,
        finish,
        food_pairing,
        inventory:cellar_inventory (
          custom_name,
          custom_producer,
          vintage,
          wine_reference (
            name,
            producer,
            region,
            country,
            wine_type,
            grape_varieties
          )
        )
      `)
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(20);

    if (ratingsError) {
      console.error("Ratings fetch error:", ratingsError);
    }

    // Fetch user's cellar inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from("cellar_inventory")
      .select(`
        custom_name,
        custom_producer,
        vintage,
        wine_reference (
          name,
          producer,
          region,
          country,
          wine_type,
          grape_varieties
        )
      `)
      .eq("status", "in_cellar")
      .limit(30);

    if (inventoryError) {
      console.error("Inventory fetch error:", inventoryError);
    }

    // Fetch user's wishlist
    const { data: wishlist, error: wishlistError } = await supabase
      .from("wishlist")
      .select(`
        custom_name,
        custom_producer,
        custom_region,
        custom_wine_type,
        wine_reference (
          name,
          producer,
          region,
          wine_type
        )
      `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(10);

    if (wishlistError) {
      console.error("Wishlist fetch error:", wishlistError);
    }

    // Define types for the query results
    type RatingWithInventory = {
      id: string;
      score: number | null;
      tasting_notes: string | null;
      nose_notes: string | null;
      palate_notes: string | null;
      body: string | null;
      tannins: string | null;
      acidity: string | null;
      sweetness: string | null;
      finish: string | null;
      food_pairing: string | null;
      inventory: {
        custom_name: string | null;
        custom_producer: string | null;
        vintage: number | null;
        wine_reference: {
          name: string;
          producer: string | null;
          region: string | null;
          country: string | null;
          wine_type: string | null;
          grape_varieties: string[] | null;
        } | null;
      } | null;
    };

    // Build taste profile summary for Claude
    const ratingsSummary = ((ratings || []) as RatingWithInventory[]).map((r) => {
      const inv = r.inventory;
      const wine = inv?.wine_reference;
      return {
        wine_name: wine?.name || inv?.custom_name || "Unknown",
        producer: wine?.producer || inv?.custom_producer,
        region: wine?.region,
        country: wine?.country,
        type: wine?.wine_type,
        grapes: wine?.grape_varieties,
        score: r.score,
        notes: r.tasting_notes,
        body: r.body,
        tannins: r.tannins,
        acidity: r.acidity,
        sweetness: r.sweetness,
      };
    });

    type InventoryItem = {
      custom_name: string | null;
      custom_producer: string | null;
      vintage: number | null;
      wine_reference: {
        name: string;
        producer: string | null;
        region: string | null;
        country: string | null;
        wine_type: string | null;
        grape_varieties: string[] | null;
      } | null;
    };

    const cellarSummary = ((inventory || []) as InventoryItem[]).map((inv) => {
      const wine = inv.wine_reference;
      return {
        wine_name: wine?.name || inv.custom_name || "Unknown",
        producer: wine?.producer || inv.custom_producer,
        region: wine?.region,
        country: wine?.country,
        type: wine?.wine_type,
        grapes: wine?.grape_varieties,
      };
    });

    type WishlistItem = {
      custom_name: string | null;
      custom_producer: string | null;
      custom_region: string | null;
      custom_wine_type: string | null;
      wine_reference: {
        name: string;
        producer: string | null;
        region: string | null;
        wine_type: string | null;
      } | null;
    };

    const wishlistSummary = ((wishlist || []) as WishlistItem[]).map((w) => {
      const wine = w.wine_reference;
      return {
        wine_name: wine?.name || w.custom_name || "Unknown",
        producer: wine?.producer || w.custom_producer,
        region: wine?.region || w.custom_region,
        type: wine?.wine_type || w.custom_wine_type,
      };
    });

    // Call Claude for recommendations
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a master sommelier providing personalized wine recommendations. Based on the user's taste profile below, suggest 6 wines they would likely enjoy.

USER'S TASTE PROFILE:

Top Rated Wines (what they love):
${JSON.stringify(ratingsSummary.slice(0, 10), null, 2)}

Current Cellar (what they own):
${JSON.stringify(cellarSummary.slice(0, 15), null, 2)}

Wishlist (what they want):
${JSON.stringify(wishlistSummary, null, 2)}

Based on this profile, provide recommendations in ONLY valid JSON format (no markdown, no code blocks):

{
  "taste_summary": "A 2-3 sentence summary of their taste preferences",
  "recommendations": [
    {
      "id": "rec-1",
      "name": "Full wine name",
      "producer": "Winery/Producer name",
      "region": "Wine region (e.g., Napa Valley, Burgundy)",
      "country": "Country",
      "wine_type": "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified",
      "grape_varieties": ["Grape1", "Grape2"],
      "vintage_suggestion": "2019-2021 recommended" or "NV" for non-vintage,
      "price_range": "$20-30" or "$50-75" etc,
      "why_recommended": "2-3 sentences explaining why this matches their taste",
      "flavor_profile": ["cherry", "oak", "vanilla", "tobacco"],
      "food_pairings": ["grilled steak", "aged cheese"],
      "confidence": 85
    }
  ]
}

Guidelines:
- Recommend wines they DON'T already have in their cellar
- Match their preferred styles, regions, and grape varieties
- Include a mix of: similar wines they'll love + some discoveries to expand their palate
- Be specific with producer names (real wines they can actually buy)
- Confidence score (0-100) reflects how well it matches their taste
- Include a variety of price points
- Consider their body, tannin, and acidity preferences from ratings`,
        },
      ],
    });

    // Extract the text content
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response
    let parsedResult: { taste_summary: string; recommendations: WineRecommendation[] };
    try {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      parsedResult = JSON.parse(jsonText.trim());
    } catch {
      console.error("Failed to parse Claude response:", textContent.text);
      return NextResponse.json({
        success: false,
        error: "Failed to generate recommendations",
        recommendations: [],
        taste_summary: "",
      });
    }

    return NextResponse.json({
      success: true,
      recommendations: parsedResult.recommendations,
      taste_summary: parsedResult.taste_summary,
    });
  } catch (error) {
    console.error("Recommendations error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate recommendations",
        recommendations: [],
        taste_summary: "",
      },
      { status: 500 }
    );
  }
}
