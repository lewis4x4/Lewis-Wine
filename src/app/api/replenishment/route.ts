import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildReplenishmentAutomation,
  replenishmentPromptToAcquisitionTarget,
  type ExistingAcquisitionTargetSignal,
  type ReplenishmentAcquiredSignal,
  type ReplenishmentInventorySignal,
  type ReplenishmentPrompt,
  type ReplenishmentRatingSignal,
  type ReplenishmentTastingSignal,
} from "@/lib/replenishment-automation";

const promptSchema = z.object({
  id: z.string(),
  inventoryId: z.string().uuid().nullable().optional(),
  wineReferenceId: z.string().uuid().nullable().optional(),
  wineTitle: z.string().min(2),
  producer: z.string().nullable().optional(),
  vintage: z.number().int().nullable().optional(),
  region: z.string().nullable().optional(),
  varietal: z.string().nullable().optional(),
  quantityOnHand: z.number().int(),
  lowStockThreshold: z.number().int().nullable().optional(),
  urgency: z.enum(["now", "soon", "watch"]),
  score: z.number().nullable().optional(),
  buyAgain: z.enum(["yes", "no", "maybe", "cellar_only"]).nullable().optional(),
  lastSignalAt: z.string().nullable().optional(),
  targetPriceCents: z.number().int().nonnegative().nullable().optional(),
  desiredQuantity: z.number().int().positive(),
  reasonCodes: z.array(z.enum(["liked_consumed", "low_stock_liked", "low_stock", "recently_acquired"])),
  reasons: z.array(z.string()),
  suppressedReason: z.enum(["already_on_acquisition_board"]).nullable().optional(),
});

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

function titleFromInventory(row: Record<string, unknown>) {
  const reference = row.wine_reference as Record<string, unknown> | null;
  const name = (reference?.name as string | undefined) ?? (row.custom_name as string | undefined) ?? "Unknown wine";
  const vintage = (row.vintage as number | null) ?? (row.custom_vintage as number | null) ?? null;
  return vintage && !String(name).includes(String(vintage)) ? `${vintage} ${name}` : name;
}

function inventoryFromDb(row: Record<string, unknown>): ReplenishmentInventorySignal {
  const reference = row.wine_reference as Record<string, unknown> | null;
  return {
    id: String(row.id),
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    wineTitle: titleFromInventory(row),
    producer: (reference?.producer as string | null) ?? (row.custom_producer as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? (row.custom_vintage as number | null) ?? null,
    region: (reference?.region as string | null) ?? null,
    varietal: Array.isArray(reference?.grape_varieties) ? String((reference?.grape_varieties as unknown[])[0] ?? "") : null,
    quantity: Number(row.quantity ?? 0),
    lowStockThreshold: (row.low_stock_threshold as number | null) ?? null,
    lowStockAlertEnabled: Boolean(row.low_stock_alert_enabled),
    status: row.status as ReplenishmentInventorySignal["status"],
    consumedDate: (row.consumed_date as string | null) ?? null,
    purchasePriceCents: (row.purchase_price_cents as number | null) ?? null,
    purchaseLocation: (row.purchase_location as string | null) ?? null,
  };
}

function ratingFromDb(row: Record<string, unknown>): ReplenishmentRatingSignal {
  return {
    id: String(row.id),
    inventoryId: (row.inventory_id as string | null) ?? null,
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    score: Number(row.score ?? 0),
    tastingDate: (row.tasting_date as string | null) ?? null,
    notes: (row.tasting_notes as string | null) ?? null,
  };
}

function tastingFromDb(row: Record<string, unknown>): ReplenishmentTastingSignal {
  const wine = row.wines as Record<string, unknown> | null;
  const vintage = (wine?.vintage as number | null) ?? null;
  const label = String(wine?.label ?? "Unknown wine");
  return {
    id: String(row.id),
    wineReferenceId: null,
    wineTitle: vintage && !label.includes(String(vintage)) ? `${vintage} ${label}` : label,
    producer: (wine?.producer as string | null) ?? null,
    vintage,
    region: (wine?.region as string | null) ?? null,
    varietal: (wine?.varietal as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    buyAgain: (row.buy_again as ReplenishmentTastingSignal["buyAgain"]) ?? null,
    tastedAt: (row.tasted_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

function acquiredFromDb(row: Record<string, unknown>): ReplenishmentAcquiredSignal {
  return {
    id: String(row.id),
    inventoryId: (row.inventory_id as string | null) ?? null,
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    wineTitle: String(row.wine_title),
    producer: (row.producer as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? null,
    region: (row.region as string | null) ?? null,
    varietal: (row.varietal as string | null) ?? null,
    acquiredQuantity: (row.acquired_quantity as number | null) ?? null,
    acquiredPriceCents: (row.acquired_price_cents as number | null) ?? null,
    acquiredAt: (row.acquired_at as string | null) ?? null,
  };
}

function existingTargetFromDb(row: Record<string, unknown>): ExistingAcquisitionTargetSignal {
  return {
    id: String(row.id),
    inventoryId: (row.inventory_id as string | null) ?? null,
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    status: row.status as ExistingAcquisitionTargetSignal["status"],
  };
}

function targetPayloadToDb(payload: ReturnType<typeof replenishmentPromptToAcquisitionTarget>, userId: string) {
  return {
    user_id: userId,
    wine_reference_id: payload.wineReferenceId ?? null,
    inventory_id: payload.inventoryId ?? null,
    source_kind: payload.sourceKind,
    source_id: payload.sourceId,
    status: payload.status,
    priority: payload.priority,
    wine_title: payload.wineTitle,
    producer: payload.producer ?? null,
    vintage: payload.vintage ?? null,
    region: payload.region ?? null,
    varietal: payload.varietal ?? null,
    desired_quantity: payload.desiredQuantity,
    target_price_cents: payload.targetPriceCents ?? null,
    max_price_cents: payload.maxPriceCents ?? null,
    notes: payload.notes,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAutomation(client: any, userId: string) {
  const { data: cellarRows, error: cellarError } = await client.from("cellars").select("id").eq("owner_id", userId);
  if (cellarError) throw cellarError;
  const cellarIds = (cellarRows ?? []).map((row: Record<string, unknown>) => String(row.id));

  let inventory: ReplenishmentInventorySignal[] = [];
  if (cellarIds.length) {
    const { data, error } = await client
      .from("cellar_inventory")
      .select("id,wine_reference_id,custom_name,custom_producer,custom_vintage,vintage,quantity,low_stock_threshold,low_stock_alert_enabled,status,consumed_date,purchase_price_cents,purchase_location,wine_reference(name,producer,region,grape_varieties)")
      .in("cellar_id", cellarIds);
    if (error) throw error;
    inventory = (data ?? []).map(inventoryFromDb);
  }

  const inventoryIds = inventory.map((item) => item.id);
  let ratings: ReplenishmentRatingSignal[] = [];
  if (inventoryIds.length) {
    const { data, error } = await client
      .from("ratings")
      .select("id,inventory_id,wine_reference_id,score,tasting_date,tasting_notes")
      .eq("user_id", userId)
      .in("inventory_id", inventoryIds)
      .order("tasting_date", { ascending: false });
    if (error) throw error;
    ratings = (data ?? []).map(ratingFromDb);
  }

  const { data: tastingRows, error: tastingError } = await client
    .from("tastings")
    .select("id,score,buy_again,tasted_at,notes,wines(producer,label,vintage,region,varietal)")
    .eq("owner_id", userId)
    .or("buy_again.eq.yes,score.gte.90")
    .order("tasted_at", { ascending: false })
    .limit(50);
  if (tastingError) throw tastingError;

  const { data: targetRows, error: targetError } = await client
    .from("acquisition_watchlist")
    .select("id,inventory_id,wine_reference_id,status,wine_title,producer,vintage,region,varietal,acquired_quantity,acquired_price_cents,acquired_at")
    .eq("user_id", userId);
  if (targetError) throw targetError;

  const targetRecords = (targetRows ?? []) as Record<string, unknown>[];
  const acquiredTargets = targetRecords.filter((row) => row.status === "acquired").map(acquiredFromDb);
  const existingTargets = targetRecords.map(existingTargetFromDb);

  return buildReplenishmentAutomation({
    inventory,
    ratings,
    tastings: ((tastingRows ?? []) as Record<string, unknown>[]).map(tastingFromDb),
    acquiredTargets,
    existingTargets,
  });
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const automation = await loadAutomation(auth.supabase as unknown, auth.user.id);
    return NextResponse.json({ success: true, automation });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load replenishment automation" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const prompt = promptSchema.parse(await request.json()) as ReplenishmentPrompt;
    if (prompt.suppressedReason) return NextResponse.json({ success: false, error: "Prompt is already covered by an active acquisition target" }, { status: 409 });
    const payload = replenishmentPromptToAcquisitionTarget(prompt);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = auth.supabase as any;
    const row = targetPayloadToDb(payload, auth.user.id);
    const { data: existingTarget, error: existingTargetError } = await client
      .from("acquisition_watchlist")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("source_kind", payload.sourceKind)
      .eq("source_id", payload.sourceId)
      .maybeSingle();
    if (existingTargetError) throw existingTargetError;
    const targetQuery = existingTarget?.id
      ? client.from("acquisition_watchlist").update(row).eq("id", existingTarget.id).eq("user_id", auth.user.id)
      : client.from("acquisition_watchlist").insert(row);
    const { data: target, error: targetError } = await targetQuery
      .select()
      .single();
    if (targetError) throw targetError;

    await client.from("replenishment_prompt_events").insert({
      user_id: auth.user.id,
      inventory_id: prompt.inventoryId ?? null,
      wine_reference_id: prompt.wineReferenceId ?? null,
      prompt_key: prompt.id,
      action: "created_acquisition_target",
      acquisition_target_id: target.id,
      notes: payload.notes,
    });

    return NextResponse.json({ success: true, target, payload });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to convert replenishment prompt" }, { status: 400 });
  }
}
