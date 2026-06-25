import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildAcquisitionEngine,
  nextAcquisitionStatus,
  type AcquisitionAction,
  type AcquisitionPriceObservation,
  type AcquisitionPriority,
  type AcquisitionSourceKind,
  type AcquisitionStatus,
  type AcquisitionTarget,
} from "@/lib/acquisition-engine";

const targetSchema = z.object({
  wineTitle: z.string().min(2).max(240),
  producer: z.string().max(160).nullable().optional(),
  vintage: z.number().int().min(1800).max(2200).nullable().optional(),
  region: z.string().max(160).nullable().optional(),
  varietal: z.string().max(120).nullable().optional(),
  wineReferenceId: z.string().uuid().nullable().optional(),
  inventoryId: z.string().uuid().nullable().optional(),
  sourceKind: z.enum(["buy_again", "wishlist", "shopping", "restaurant_discovery", "replenishment", "manual"]).default("manual"),
  sourceId: z.string().uuid().nullable().optional(),
  status: z.enum(["watching", "buy_now", "ordered", "acquired", "passed"]).default("watching"),
  priority: z.enum(["must_have", "high", "medium", "low"]).default("medium"),
  desiredQuantity: z.number().int().positive().default(1),
  targetPriceCents: z.number().int().nonnegative().nullable().optional(),
  maxPriceCents: z.number().int().nonnegative().nullable().optional(),
  nextRefreshAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["watch", "mark_buy_now", "mark_ordered", "mark_acquired", "pass", "reopen"]),
});

const priceSchema = z.object({
  targetId: z.string().uuid(),
  sourceType: z.enum(["manual", "cellartracker", "wine_market_journal", "retailer", "winery", "auction", "public_web", "ai_search", "ai_inferred", "wine_searcher_trial", "provider", "unknown"]).default("manual"),
  sourceName: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional().or(z.literal("")),
  observedPriceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default("USD"),
  availability: z.enum(["available", "limited", "unknown", "sold_out"]).default("unknown"),
  confidence: z.number().int().min(0).max(100).default(70),
  observedAt: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function currentUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

function targetFromDb(row: Record<string, unknown>): AcquisitionTarget {
  return {
    id: String(row.id),
    wineTitle: String(row.wine_title),
    producer: (row.producer as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? null,
    region: (row.region as string | null) ?? null,
    varietal: (row.varietal as string | null) ?? null,
    sourceKind: row.source_kind as AcquisitionSourceKind,
    sourceId: (row.source_id as string | null) ?? null,
    status: row.status as AcquisitionStatus,
    priority: row.priority as AcquisitionPriority,
    desiredQuantity: Number(row.desired_quantity ?? 1),
    targetPriceCents: (row.target_price_cents as number | null) ?? null,
    maxPriceCents: (row.max_price_cents as number | null) ?? null,
    nextRefreshAt: (row.next_refresh_at as string | null) ?? null,
    lastRefreshedAt: (row.last_refreshed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

function priceFromDb(row: Record<string, unknown>): AcquisitionPriceObservation {
  return {
    id: String(row.id),
    targetId: String(row.target_id),
    observedPriceCents: (row.observed_price_cents as number | null) ?? null,
    sourceName: (row.source_name as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    availability: row.availability as AcquisitionPriceObservation["availability"],
    confidence: Number(row.confidence ?? 0),
    observedAt: String(row.observed_at),
  };
}

function targetToDb(input: z.infer<typeof targetSchema>, userId: string) {
  return {
    user_id: userId,
    wine_reference_id: input.wineReferenceId ?? null,
    inventory_id: input.inventoryId ?? null,
    source_kind: input.sourceKind,
    source_id: input.sourceId ?? null,
    status: input.status,
    priority: input.priority,
    wine_title: input.wineTitle,
    producer: input.producer ?? null,
    vintage: input.vintage ?? null,
    region: input.region ?? null,
    varietal: input.varietal ?? null,
    desired_quantity: input.desiredQuantity,
    target_price_cents: input.targetPriceCents ?? null,
    max_price_cents: input.maxPriceCents ?? null,
    next_refresh_at: input.nextRefreshAt ?? null,
    notes: input.notes ?? null,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: targetRows, error: targetError } = await (supabase as any)
      .from("acquisition_watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (targetError) throw targetError;
    const targetIds = ((targetRows ?? []) as Record<string, unknown>[]).map((row) => String(row.id));
    let priceRows: Record<string, unknown>[] = [];
    if (targetIds.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("acquisition_price_observations")
        .select("*")
        .in("target_id", targetIds)
        .order("observed_at", { ascending: false });
      if (error) throw error;
      priceRows = data ?? [];
    }
    const targets = ((targetRows ?? []) as Record<string, unknown>[]).map(targetFromDb);
    const priceObservations = priceRows.map(priceFromDb);
    return NextResponse.json({ success: true, targets, priceObservations, engine: buildAcquisitionEngine({ targets, priceObservations }) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load acquisition engine" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const url = new URL(request.url);
    if (url.searchParams.get("kind") === "price") {
      const input = priceSchema.parse(await request.json());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: target } = await (supabase as any).from("acquisition_watchlist").select("id,user_id").eq("id", input.targetId).eq("user_id", user.id).single();
      if (!target) return NextResponse.json({ success: false, error: "Target not found" }, { status: 404 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("acquisition_price_observations").insert({
        target_id: input.targetId,
        source_type: input.sourceType,
        source_name: input.sourceName ?? null,
        source_url: input.sourceUrl || null,
        observed_price_cents: input.observedPriceCents,
        currency: input.currency,
        availability: input.availability,
        confidence: input.confidence,
        observed_at: input.observedAt ?? new Date().toISOString(),
        notes: input.notes ?? null,
      }).select().single();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("acquisition_watchlist").update({ last_refreshed_at: new Date().toISOString(), best_price_observation_id: data.id }).eq("id", input.targetId).eq("user_id", user.id);
      return NextResponse.json({ success: true, observation: priceFromDb(data) });
    }
    const input = targetSchema.parse(await request.json());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("acquisition_watchlist").insert(targetToDb(input, user.id)).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, target: targetFromDb(data) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to save acquisition target" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = patchSchema.parse(await request.json());
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any).from("acquisition_watchlist").select("id,status").eq("id", input.id).eq("user_id", user.id).single();
    if (!existing) return NextResponse.json({ success: false, error: "Target not found" }, { status: 404 });
    const status = nextAcquisitionStatus(existing.status as AcquisitionStatus, input.action as AcquisitionAction);
    const stamp = new Date().toISOString();
    const updates: Record<string, unknown> = { status };
    if (status === "ordered") updates.ordered_at = stamp;
    if (status === "acquired") updates.acquired_at = stamp;
    if (status === "passed") updates.passed_at = stamp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("acquisition_watchlist").update(updates).eq("id", input.id).eq("user_id", user.id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, target: targetFromDb(data) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to update acquisition target" }, { status: 400 });
  }
}
