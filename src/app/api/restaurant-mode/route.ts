import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildRestaurantMode, parseRestaurantWineText } from "@/lib/restaurant-mode";
import type { AdvisorLineItem, TasteProfile } from "@/lib/pourfolio-intelligence";

const requestSchema = z.object({
  restaurant: z.string().optional().nullable(),
  cuisine: z.string().optional().nullable(),
  context: z.string().optional().nullable(),
  pastedText: z.string().optional().nullable(),
  imageBase64: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  items: z.array(z.object({
    producer: z.string().optional().nullable(),
    label: z.string(),
    vintage: z.number().optional().nullable(),
    varietal: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    price: z.number().optional().nullable(),
    descriptors: z.array(z.string()).optional().nullable(),
    readiness: z.enum(["drink_now", "hold", "unknown"]).optional(),
    valueFlag: z.enum(["great", "fair", "overpriced"]).optional(),
  })).optional(),
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
      lovedDescriptors: ["smooth", "rich", "long finish"],
      preferredRegions: ["Mendoza", "Napa Valley"],
      preferredVarietals: ["Cabernet Sauvignon"],
      preferredProducers: ["Tapiz", "Lewis Cellars"],
      priceBand: { low: 60, typical: 100, high: 150 },
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

function normalizeEdgeItem(row: Record<string, unknown>): AdvisorLineItem {
  return {
    producer: typeof row.producer === "string" ? row.producer : null,
    label: typeof row.label === "string" ? row.label : "Unknown bottle",
    vintage: typeof row.vintage === "number" ? row.vintage : null,
    varietal: typeof row.varietal === "string" ? row.varietal : null,
    region: typeof row.region === "string" ? row.region : null,
    price: typeof row.price === "number" ? row.price : null,
    descriptors: strings(row.descriptors),
    readiness: row.readiness === "drink_now" || row.readiness === "hold" || row.readiness === "unknown" ? row.readiness : "unknown",
    valueFlag: row.value_flag === "great" || row.value_flag === "fair" || row.value_flag === "overpriced" ? row.value_flag : "fair",
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

    let items: AdvisorLineItem[] = body.items ?? [];
    let source: "manual" | "text" | "image" = items.length ? "manual" : "text";

    if (!items.length && body.pastedText?.trim()) {
      items = parseRestaurantWineText(body.pastedText);
      source = "text";
    }

    if (!items.length && body.imageBase64?.trim()) {
      const { data, error } = await client.functions.invoke("advise-list", {
        body: {
          restaurant: body.restaurant,
          cuisine: body.cuisine,
          context: body.context,
          image_base64: body.imageBase64,
          media_type: body.mediaType ?? "image/jpeg",
        },
      });
      if (error) throw new Error(error.message);
      const parsed = Array.isArray(data?.parsed) ? data.parsed as Record<string, unknown>[] : [];
      items = parsed.map(normalizeEdgeItem);
      source = "image";
    }

    const result = buildRestaurantMode({ restaurant: body.restaurant, cuisine: body.cuisine, context: body.context, profile, items });

    if (items.length) {
      await client.from("wine_lists").insert({
        owner_id: auth.user.id,
        restaurant: body.restaurant ?? null,
        cuisine: body.cuisine ?? null,
        context: body.context ?? `restaurant-mode:${source}`,
        parsed: items,
        recommendations: result.recommendations,
      });
    }

    return NextResponse.json({ success: true, source, result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to advise restaurant list" }, { status: 500 });
  }
}
