import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { normalizePriceObservation, summarizePricePosture, type PriceObservation } from "@/lib/current-intelligence/price-observations";

const observationSchema = z.object({
  inventoryId: z.string().uuid(),
  wineReferenceId: z.string().uuid().nullable().optional(),
  sourceType: z.enum(["manual", "cellartracker", "wine_market_journal", "retailer", "winery", "auction", "public_web", "ai_search", "ai_inferred", "wine_searcher_trial", "provider", "unknown"]),
  sourceName: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional().or(z.literal("")),
  observationKind: z.enum(["purchase_price", "market_value", "replacement_price", "auction_comp", "estimate"]).optional(),
  truthLabel: z.enum(["verified", "estimated", "ai_inferred", "unknown", "stale", "rejected"]).optional(),
  reviewStatus: z.enum(["draft", "accepted", "rejected", "superseded"]).optional(),
  observedPriceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default("USD"),
  bottleSizeMl: z.number().int().positive().nullable().optional(),
  vintage: z.number().int().min(1800).max(2200).nullable().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  observedAt: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function requireOwnedBottle(supabase: Awaited<ReturnType<typeof createClient>>, inventoryId: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wine } = await (supabase as any).from("cellar_inventory").select("id, cellar_id").eq("id", inventoryId).single();
  if (!wine) return { ok: false as const, response: NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cellar } = await (supabase as any).from("cellars").select("owner_id").eq("id", wine.cellar_id).single();
  if (!cellar || cellar.owner_id !== user.id) return { ok: false as const, response: NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 }) };
  return { ok: true as const, user, wine };
}

function toDb(observation: PriceObservation) {
  return {
    inventory_id: observation.inventoryId,
    wine_reference_id: observation.wineReferenceId,
    source_type: observation.sourceType,
    source_name: observation.sourceName,
    source_url: observation.sourceUrl || null,
    observation_kind: observation.observationKind,
    truth_label: observation.truthLabel,
    review_status: observation.reviewStatus,
    observed_price_cents: observation.observedPriceCents,
    currency: observation.currency,
    bottle_size_ml: observation.bottleSizeMl,
    vintage: observation.vintage,
    confidence: observation.confidence,
    observed_at: observation.observedAt,
    notes: observation.notes,
    raw_payload: observation.rawPayload ?? {},
  };
}

function fromDb(row: Record<string, unknown>): PriceObservation {
  return {
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
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const inventoryId = url.searchParams.get("inventoryId");
    if (!inventoryId) return NextResponse.json({ success: false, error: "inventoryId is required" }, { status: 400 });
    const supabase = await createClient();
    const owned = await requireOwnedBottle(supabase, inventoryId);
    if (!owned.ok) return owned.response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("wine_price_observations").select("*").eq("inventory_id", inventoryId).order("observed_at", { ascending: false });
    if (error) throw error;
    const observations = (data ?? []).map(fromDb);
    return NextResponse.json({ success: true, observations, posture: summarizePricePosture(observations) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load price observations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = observationSchema.parse(await request.json());
    const supabase = await createClient();
    const owned = await requireOwnedBottle(supabase, input.inventoryId);
    if (!owned.ok) return owned.response;
    const observation = normalizePriceObservation({ ...input, sourceUrl: input.sourceUrl || null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("wine_price_observations").insert(toDb(observation)).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, observation: fromDb(data) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to save price observation" }, { status: 400 });
  }
}
