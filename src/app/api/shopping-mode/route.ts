import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildShoppingMode, parseRetailerWineText } from "@/lib/shopping-mode";
import type { TasteProfile } from "@/lib/pourfolio-intelligence";

const requestSchema = z.object({
  retailer: z.string().optional().nullable(),
  context: z.string().optional().nullable(),
  desiredQuantity: z.number().int().positive().optional().nullable(),
  maxBudgetCents: z.number().int().nonnegative().optional().nullable(),
  pastedText: z.string().optional().nullable(),
});

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function priceBand(value: unknown): TasteProfile["priceBand"] {
  if (!value || typeof value !== "object") return { low: null, typical: null, high: null };
  const row = value as Record<string, unknown>;
  const num = (candidate: unknown) => typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
  return { low: num(row.low), typical: num(row.typical), high: num(row.high) };
}

function toTasteProfile(row: Record<string, unknown> | null): TasteProfile {
  if (!row) {
    return {
      lovedDescriptors: ["smooth", "rich", "black fruit", "long finish"],
      preferredRegions: ["Mendoza", "Napa Valley"],
      preferredVarietals: ["Cabernet Sauvignon", "Malbec"],
      preferredProducers: ["Tapiz", "Lewis Cellars"],
      priceBand: { low: 60, typical: 100, high: 180 },
      avoidList: ["Miss Merlot"],
      benchmarkWineIds: [],
      refreshedAt: new Date(0).toISOString(),
    };
  }
  return {
    lovedDescriptors: strings(row.loved_descriptors),
    preferredRegions: strings(row.preferred_regions),
    preferredVarietals: strings(row.preferred_varietals),
    preferredProducers: strings(row.preferred_producers),
    priceBand: priceBand(row.price_band),
    avoidList: strings(row.avoid_list),
    benchmarkWineIds: strings(row.benchmark_wine_ids),
    refreshedAt: String(row.refreshed_at ?? row.created_at ?? new Date(0).toISOString()),
  };
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const body = requestSchema.parse(await req.json());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = auth.supabase as any;
    const { data: profileRows, error: profileError } = await client
      .from("taste_profile")
      .select("*")
      .eq("owner_id", auth.user.id)
      .order("refreshed_at", { ascending: false })
      .limit(1);
    if (profileError) throw profileError;
    const profile = toTasteProfile(((profileRows ?? []) as Record<string, unknown>[])[0] ?? null);
    const items = parseRetailerWineText(body.pastedText ?? "");
    const result = buildShoppingMode({
      retailer: body.retailer,
      context: body.context,
      desiredQuantity: body.desiredQuantity,
      maxBudgetCents: body.maxBudgetCents,
      profile,
      items,
    });
    return NextResponse.json({ success: true, source: "text", result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to rank shopping list" }, { status: 500 });
  }
}
