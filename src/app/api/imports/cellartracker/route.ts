import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildCellarTrackerObservationDraft,
  matchCellarTrackerRowToInventory,
  normalizeCellarTrackerRow,
  parseCellarTrackerCsv,
} from "@/lib/current-intelligence/cellartracker-import";

const importSchema = z.object({ csv: z.string().min(1), acceptMatched: z.boolean().default(false) });

export async function POST(request: Request) {
  try {
    const input = importSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inventory, error } = await (supabase as any)
      .from("cellar_inventory")
      .select("id, custom_producer, custom_name, vintage, custom_vintage, cellar_id, wine_reference (producer, name), cellars!inner(owner_id)")
      .eq("cellars.owner_id", user.id);
    if (error) throw error;

    const normalizedRows = parseCellarTrackerCsv(input.csv).map(normalizeCellarTrackerRow);
    const drafts = normalizedRows.map((row) => buildCellarTrackerObservationDraft(row, matchCellarTrackerRowToInventory(row, inventory ?? [])));
    const observations = drafts.flatMap((draft) => [draft.marketObservation, draft.purchaseObservation].filter(Boolean));

    if (input.acceptMatched && observations.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("wine_price_observations").insert(observations.map((observation: any) => ({
        inventory_id: observation.inventoryId,
        wine_reference_id: observation.wineReferenceId,
        source_type: observation.sourceType,
        source_name: observation.sourceName,
        source_url: observation.sourceUrl,
        observation_kind: observation.observationKind,
        truth_label: observation.truthLabel,
        review_status: "accepted",
        observed_price_cents: observation.observedPriceCents,
        currency: observation.currency,
        bottle_size_ml: observation.bottleSizeMl,
        vintage: observation.vintage,
        confidence: observation.confidence,
        observed_at: observation.observedAt,
        notes: observation.notes,
        raw_payload: observation.rawPayload ?? {},
      })));
    }

    return NextResponse.json({
      success: true,
      rows: normalizedRows.length,
      matched: drafts.filter((draft) => draft.match.status === "matched").length,
      ambiguous: drafts.filter((draft) => draft.match.status === "ambiguous").length,
      unmatched: drafts.filter((draft) => draft.match.status === "unmatched").length,
      observations,
      saved: input.acceptMatched ? observations.length : 0,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to import CellarTracker CSV" }, { status: 400 });
  }
}
