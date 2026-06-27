import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDrinkWindowObservation,
  validateDrinkWindowObservation,
  type DrinkWindowObservation,
} from "@/lib/drink-window-evidence";
import type { ReviewStatus, SourceType, TruthLabel } from "@/lib/current-intelligence/types";
import {
  drinkWindowObservationFromDb,
  drinkWindowObservationToDbPatch,
  isMissingDrinkWindowObservationTable,
} from "@/lib/drink-window-observation-records";

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

const reviewSchema = z.object({
  reviewStatus: z.enum(reviewStatuses).optional(),
  sourceType: z.enum(sourceTypes).optional(),
  sourceName: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional().or(z.literal("")),
  truthLabel: z.enum(truthLabels).optional(),
  drinkAfter: z.string().max(20).nullable().optional(),
  drinkBefore: z.string().max(20).nullable().optional(),
  peakStart: z.string().max(20).nullable().optional(),
  peakEnd: z.string().max(20).nullable().optional(),
  servingGuidance: z.string().max(2000).nullable().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  observedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type DbRow = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = any;

function db(supabase: SupabaseClient): SupabaseAnyClient {
  return supabase as unknown as SupabaseAnyClient;
}

async function requireUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, user };
}

async function requireOwnedObservation(supabase: SupabaseClient, id: string) {
  const auth = await requireUser(supabase);
  if (!auth.ok) return auth;

  const { data: existing, error } = await db(supabase)
    .from("wine_drink_window_observations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (isMissingDrinkWindowObservationTable(error)) {
      return {
        ok: false as const,
        response: NextResponse.json({ success: false, tableReady: false, error: "Drink-window evidence table has not been migrated yet." }, { status: 409 }),
      };
    }
    throw error;
  }

  if (!existing || existing.owner_id !== auth.user.id) {
    return { ok: false as const, response: NextResponse.json({ success: false, error: "Observation not found" }, { status: 404 }) };
  }

  if (existing.inventory_id) {
    const { data: inventory } = await db(supabase).from("cellar_inventory").select("cellar_id").eq("id", existing.inventory_id).single();
    const { data: cellar } = await db(supabase).from("cellars").select("owner_id").eq("id", inventory?.cellar_id).single();
    if (!cellar || cellar.owner_id !== auth.user.id) {
      return { ok: false as const, response: NextResponse.json({ success: false, error: "Observation not found" }, { status: 404 }) };
    }
  }

  return { ok: true as const, user: auth.user, existing: existing as DbRow };
}

function mergeObservation(existing: DrinkWindowObservation, input: z.infer<typeof reviewSchema>) {
  const nextReviewStatus = (input.reviewStatus ?? existing.reviewStatus) as ReviewStatus;
  const reviewedAt = input.reviewStatus
    ? nextReviewStatus === "draft"
      ? null
      : new Date().toISOString()
    : existing.reviewedAt ?? null;

  return normalizeDrinkWindowObservation({
    id: existing.id,
    inventoryId: existing.inventoryId,
    wineReferenceId: existing.wineReferenceId ?? null,
    evidenceId: existing.evidenceId ?? null,
    sourceType: (input.sourceType ?? existing.sourceType) as SourceType,
    sourceName: input.sourceName === undefined ? existing.sourceName : input.sourceName ?? undefined,
    sourceUrl: input.sourceUrl === undefined ? existing.sourceUrl ?? null : input.sourceUrl || null,
    truthLabel: (input.truthLabel ?? existing.truthLabel) as TruthLabel,
    reviewStatus: nextReviewStatus,
    drinkAfter: input.drinkAfter === undefined ? existing.drinkAfter ?? null : input.drinkAfter,
    drinkBefore: input.drinkBefore === undefined ? existing.drinkBefore ?? null : input.drinkBefore,
    peakStart: input.peakStart === undefined ? existing.peakStart ?? null : input.peakStart,
    peakEnd: input.peakEnd === undefined ? existing.peakEnd ?? null : input.peakEnd,
    servingGuidance: input.servingGuidance === undefined ? existing.servingGuidance ?? null : input.servingGuidance,
    confidence: input.confidence ?? existing.confidence,
    observedAt: input.observedAt ?? existing.observedAt,
    reviewedAt,
    notes: input.notes === undefined ? existing.notes ?? null : input.notes,
    rawPayload: existing.rawPayload ?? null,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = reviewSchema.parse(await request.json());
    const supabase = await createClient();
    const owned = await requireOwnedObservation(supabase, id);
    if (!owned.ok) return owned.response;

    const current = drinkWindowObservationFromDb(owned.existing);
    const observation = mergeObservation(current, input);
    const issues = validateDrinkWindowObservation(observation);
    if (issues.length) {
      return NextResponse.json({ success: false, error: "Drink-window evidence needs review", issues }, { status: 422 });
    }

    const { data, error } = await db(supabase)
      .from("wine_drink_window_observations")
      .update(drinkWindowObservationToDbPatch(observation))
      .eq("id", id)
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
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to review drink-window observation" }, { status: 400 });
  }
}
