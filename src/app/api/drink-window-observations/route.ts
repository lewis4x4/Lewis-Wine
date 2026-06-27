import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildReadinessInputWithDrinkWindowEvidence,
  normalizeDrinkWindowObservation,
  validateDrinkWindowObservation,
  type DrinkWindowObservation,
} from "@/lib/drink-window-evidence";
import {
  drinkWindowObservationFromDb,
  drinkWindowObservationToDbInsert,
  isMissingDrinkWindowObservationTable,
} from "@/lib/drink-window-observation-records";
import { getWineReadinessProfile, type WineWindowInput } from "@/lib/wine-readiness";

const sourceTypes = [
  "manual",
  "cellartracker",
  "wine_market_journal",
  "retailer",
  "winery",
  "auction",
  "public_web",
  "ai_search",
  "ai_inferred",
  "wine_searcher_trial",
  "provider",
  "unknown",
] as const;

const truthLabels = ["verified", "estimated", "ai_inferred", "unknown", "stale", "rejected"] as const;
const reviewStatuses = ["draft", "accepted", "rejected", "superseded"] as const;

const observationSchema = z.object({
  inventoryId: z.string().uuid(),
  wineReferenceId: z.string().uuid().nullable().optional(),
  evidenceId: z.string().uuid().nullable().optional(),
  sourceType: z.enum(sourceTypes),
  sourceName: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional().or(z.literal("")),
  truthLabel: z.enum(truthLabels).optional(),
  reviewStatus: z.enum(reviewStatuses).optional(),
  drinkAfter: z.string().max(20).nullable().optional(),
  drinkBefore: z.string().max(20).nullable().optional(),
  peakStart: z.string().max(20).nullable().optional(),
  peakEnd: z.string().max(20).nullable().optional(),
  servingGuidance: z.string().max(2000).nullable().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  observedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
  rawPayload: z.unknown().optional(),
});

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type DbRow = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = any;

function db(supabase: SupabaseClient): SupabaseAnyClient {
  return supabase as unknown as SupabaseAnyClient;
}

function relation(row: DbRow | null | undefined, key: string): DbRow | null {
  const value = row?.[key];
  if (Array.isArray(value)) return (value[0] as DbRow | undefined) ?? null;
  return (value as DbRow | null | undefined) ?? null;
}

function wineWindowInputFromDb(row: DbRow): WineWindowInput {
  const reference = relation(row, "wine_reference");
  const referenceStart = reference?.drink_window_start != null ? String(reference.drink_window_start) : null;
  const referenceEnd = reference?.drink_window_end != null ? String(reference.drink_window_end) : null;
  return {
    drink_after: (row.drink_after as string | null) ?? null,
    drink_before: (row.drink_before as string | null) ?? null,
    wine_reference_drink_window_start: referenceStart,
    wine_reference_drink_window_end: referenceEnd,
  };
}

async function requireOwnedBottle(supabase: SupabaseClient, inventoryId: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const client = db(supabase);
  const { data: wine, error: wineError } = await client
    .from("cellar_inventory")
    .select("id,cellar_id,wine_reference_id,drink_after,drink_before,wine_reference(drink_window_start,drink_window_end)")
    .eq("id", inventoryId)
    .single();

  if (wineError || !wine) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 }) };
  }

  const { data: cellar, error: cellarError } = await client
    .from("cellars")
    .select("owner_id")
    .eq("id", wine.cellar_id)
    .single();

  if (cellarError || !cellar || cellar.owner_id !== user.id) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 }) };
  }

  return { ok: true as const, user, wine: wine as DbRow };
}

function responsePayload(wine: DbRow, observations: DrinkWindowObservation[], tableReady = true) {
  const bridge = buildReadinessInputWithDrinkWindowEvidence(wineWindowInputFromDb(wine), observations);
  return {
    success: true,
    tableReady,
    observations,
    appliedObservation: bridge.appliedObservation,
    readiness: getWineReadinessProfile(bridge.wine),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsedInventoryId = z.string().uuid().safeParse(url.searchParams.get("inventoryId"));
    if (!parsedInventoryId.success) {
      return NextResponse.json({ success: false, error: "inventoryId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const owned = await requireOwnedBottle(supabase, parsedInventoryId.data);
    if (!owned.ok) return owned.response;

    const { data, error } = await db(supabase)
      .from("wine_drink_window_observations")
      .select("*")
      .eq("inventory_id", parsedInventoryId.data)
      .order("observed_at", { ascending: false });

    if (error) {
      if (isMissingDrinkWindowObservationTable(error)) {
        return NextResponse.json({
          ...responsePayload(owned.wine, [], false),
          message: "Drink-window evidence table is not migrated in this environment yet.",
        });
      }
      throw error;
    }

    const observations = ((data ?? []) as DbRow[]).map(drinkWindowObservationFromDb);
    return NextResponse.json(responsePayload(owned.wine, observations));
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load drink-window observations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = observationSchema.parse(await request.json());
    const supabase = await createClient();
    const owned = await requireOwnedBottle(supabase, input.inventoryId);
    if (!owned.ok) return owned.response;

    const observation = normalizeDrinkWindowObservation({
      inventoryId: input.inventoryId,
      wineReferenceId: input.wineReferenceId ?? (owned.wine.wine_reference_id as string | null) ?? null,
      evidenceId: input.evidenceId ?? null,
      sourceType: input.sourceType,
      sourceName: input.sourceName ?? undefined,
      sourceUrl: input.sourceUrl || null,
      truthLabel: input.truthLabel,
      reviewStatus: input.reviewStatus ?? "draft",
      drinkAfter: input.drinkAfter ?? null,
      drinkBefore: input.drinkBefore ?? null,
      peakStart: input.peakStart ?? null,
      peakEnd: input.peakEnd ?? null,
      servingGuidance: input.servingGuidance ?? null,
      confidence: input.confidence,
      observedAt: input.observedAt,
      notes: input.notes ?? null,
      rawPayload: input.rawPayload ?? null,
    });
    const issues = validateDrinkWindowObservation(observation);
    if (issues.length) {
      return NextResponse.json({ success: false, error: "Drink-window evidence needs review", issues }, { status: 422 });
    }

    const { data, error } = await db(supabase)
      .from("wine_drink_window_observations")
      .insert(drinkWindowObservationToDbInsert(observation, owned.user.id))
      .select()
      .single();

    if (error) {
      if (isMissingDrinkWindowObservationTable(error)) {
        return NextResponse.json({ success: false, tableReady: false, error: "Drink-window evidence table has not been migrated yet." }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, observation: drinkWindowObservationFromDb(data as DbRow) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to save drink-window observation" }, { status: 400 });
  }
}
