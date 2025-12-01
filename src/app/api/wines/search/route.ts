import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface WineSearchResult {
  id: string;
  name: string;
  producer: string | null;
  region: string | null;
  country: string | null;
  wineType: string | null;
  grapeVariety: string | null;
  rating: number | null;
  description: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ wines: [], error: null });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Use full-text search with the search_vector column
    const { data, error } = await supabase
      .from("wine_reference")
      .select("id, name, producer, region, country, wine_type, grape_varieties, critic_scores")
      .textSearch("search_vector", query.split(" ").join(" & "), {
        type: "websearch",
        config: "english",
      })
      .limit(20);

    if (error) {
      // Fallback to ILIKE search if full-text search fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("wine_reference")
        .select("id, name, producer, region, country, wine_type, grape_varieties, critic_scores")
        .or(`name.ilike.%${query}%,producer.ilike.%${query}%`)
        .limit(20);

      if (fallbackError) {
        throw fallbackError;
      }

      const wines = transformWines(fallbackData || []);
      return NextResponse.json({ wines, error: null });
    }

    const wines = transformWines(data || []);
    return NextResponse.json({ wines, error: null });
  } catch (error) {
    console.error("Wine search error:", error);
    return NextResponse.json(
      { wines: [], error: "Failed to search wines" },
      { status: 500 }
    );
  }
}

function transformWines(data: any[]): WineSearchResult[] {
  return data.map((wine) => {
    const criticScores = wine.critic_scores as {
      wine_enthusiast?: number;
      description?: string;
    } | null;

    return {
      id: wine.id,
      name: wine.name,
      producer: wine.producer,
      region: wine.region,
      country: wine.country,
      wineType: wine.wine_type,
      grapeVariety: wine.grape_varieties?.[0] || null,
      rating: criticScores?.wine_enthusiast || null,
      description: criticScores?.description || null,
    };
  });
}
