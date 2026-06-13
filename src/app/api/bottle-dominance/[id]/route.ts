import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildBottleDominanceDraft,
  summarizeDominanceProviderStatus,
  type BottleDominanceRecord,
  type DominanceMarketSignal,
} from "@/lib/bottle-dominance";

function getConfiguredMarketSignal(): DominanceMarketSignal | null {
  // Provider hook: when a licensed pricing provider is configured, plug it in here.
  // Do not fabricate market values when the provider is absent.
  if (!process.env.WINE_SEARCHER_API_KEY) return null;
  return null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wine, error } = await (supabase as any)
      .from("cellar_inventory")
      .select(`
        *,
        wine_reference (*),
        ratings (score, tasting_notes)
      `)
      .eq("id", id)
      .single();

    if (error || !wine) {
      return NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cellar } = await (supabase as any)
      .from("cellars")
      .select("owner_id")
      .eq("id", wine.cellar_id)
      .single();

    if (!cellar || cellar.owner_id !== user.id) {
      return NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 });
    }

    const draft = buildBottleDominanceDraft(wine as BottleDominanceRecord, {
      market: getConfiguredMarketSignal(),
    });

    return NextResponse.json({
      success: true,
      draft,
      providerStatus: summarizeDominanceProviderStatus({
        wineSearcherConfigured: Boolean(process.env.WINE_SEARCHER_API_KEY),
        anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      }),
    });
  } catch (error) {
    console.error("Bottle dominance error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to dominate bottle" },
      { status: 500 }
    );
  }
}
