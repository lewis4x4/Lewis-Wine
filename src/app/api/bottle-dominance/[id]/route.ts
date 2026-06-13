import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildBottleDominanceDraft,
  summarizeDominanceProviderStatus,
  type BottleDominanceRecord,
  type DominanceMarketSignal,
} from "@/lib/bottle-dominance";

import {
  normalizePriceObservation,
  selectBestMarketValue,
  type PriceObservation,
} from "@/lib/current-intelligence/price-observations";

function getConfiguredMarketSignal(observations: PriceObservation[]): DominanceMarketSignal | null {
  const selected = selectBestMarketValue(observations.filter((observation) => observation.reviewStatus === "accepted"));
  if (!selected?.observedPriceCents) return null;
  return {
    provider: selected.sourceName ?? selected.sourceType,
    valueCents: selected.observedPriceCents,
    sourceUrl: selected.sourceUrl,
    checkedAt: selected.observedAt,
    confidence: selected.confidence,
  };
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: observationRows } = await (supabase as any)
      .from("wine_price_observations")
      .select("*")
      .eq("inventory_id", id);

    const observations = (observationRows ?? []).map((row: Record<string, unknown>) => normalizePriceObservation({
      id: String(row.id),
      inventoryId: String(row.inventory_id),
      wineReferenceId: (row.wine_reference_id as string | null) ?? null,
      sourceType: row.source_type as PriceObservation["sourceType"],
      sourceName: (row.source_name as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      observationKind: row.observation_kind as PriceObservation["observationKind"],
      truthLabel: row.truth_label as PriceObservation["truthLabel"],
      reviewStatus: row.review_status as PriceObservation["reviewStatus"],
      observedPriceCents: (row.observed_price_cents as number | null) ?? null,
      currency: String(row.currency ?? "USD"),
      bottleSizeMl: (row.bottle_size_ml as number | null) ?? null,
      vintage: (row.vintage as number | null) ?? null,
      confidence: Number(row.confidence ?? 0),
      observedAt: String(row.observed_at),
      notes: (row.notes as string | null) ?? null,
      rawPayload: row.raw_payload,
    }));

    const draft = buildBottleDominanceDraft(wine as BottleDominanceRecord, {
      market: getConfiguredMarketSignal(observations),
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
