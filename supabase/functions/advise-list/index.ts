import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { anthropicJson, fixtureEnabled, jsonResponse } from "../_shared/intelligence.ts";

type LineItem = {
  producer?: string | null;
  label: string;
  vintage?: number | null;
  varietal?: string | null;
  region?: string | null;
  price?: number | null;
  descriptors?: string[];
  readiness?: "drink_now" | "hold" | "unknown";
  value_flag?: "great" | "fair" | "overpriced";
};

type Recommendation = {
  line_item: LineItem;
  brian_fit: number;
  tier: "pour" | "consider" | "skip";
  reasons: string[];
  readiness: "drink_now" | "hold" | "unknown";
  value_flag: "great" | "fair" | "overpriced";
  cuisine_fit: number;
};

function supabase() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

async function userIdFromRequest(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return Deno.env.get("POURFOLIO_FIXTURE_OWNER_ID") ?? null;
  const { data, error } = await supabase().auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (error) throw error;
  return data.user?.id ?? null;
}

const fixtureParsed: LineItem[] = [
  { producer: "Tapiz", label: "Alta Collection Cabernet Sauvignon", vintage: 2021, varietal: "Cabernet Sauvignon", region: "Mendoza", price: 92, descriptors: ["smooth", "rich"], readiness: "drink_now", value_flag: "great" },
  { producer: "Lewis Cellars", label: "Reserve Cabernet", vintage: 2020, varietal: "Cabernet Sauvignon", region: "Napa Valley", price: 145, descriptors: ["bold", "polished"], readiness: "drink_now", value_flag: "fair" },
  { producer: "Willamette Fixture", label: "Pinot Noir", vintage: 2022, varietal: "Pinot Noir", region: "Willamette Valley", price: 74, descriptors: ["silky"], readiness: "unknown", value_flag: "fair" },
  { producer: "Miss", label: "Merlot", vintage: 2021, varietal: "Merlot", region: "Bordeaux", price: 45, descriptors: ["thin"], readiness: "unknown", value_flag: "fair" },
];

function includes(values: string[], candidate?: string | null) {
  if (!candidate) return false;
  const normalized = candidate.toLowerCase();
  return values.some((value) => normalized.includes(value.toLowerCase()) || value.toLowerCase().includes(normalized));
}

function score(item: LineItem, profile: Record<string, unknown>, cuisine?: string | null): Recommendation {
  const loved = (profile.loved_descriptors ?? []) as string[];
  const regions = (profile.preferred_regions ?? []) as string[];
  const varietals = (profile.preferred_varietals ?? []) as string[];
  const producers = (profile.preferred_producers ?? []) as string[];
  const avoid = (profile.avoid_list ?? []) as string[];
  const priceBand = (profile.price_band ?? {}) as { typical?: number | null; high?: number | null };
  const descriptorMatches = (item.descriptors ?? []).filter((descriptor) => loved.map((value) => value.toLowerCase()).includes(descriptor.toLowerCase()));
  const descriptorScore = Math.min(40, descriptorMatches.length * 20);
  const identityScore = (includes(regions, item.region) ? 12 : 0) + (includes(varietals, item.varietal) ? 13 : 0);
  const producerScore = includes(producers, item.producer) ? 20 : 0;
  let valueScore = 5;
  if (item.price && priceBand.typical && item.price <= priceBand.typical * 1.1) valueScore = 15;
  else if (item.price && priceBand.high && item.price > priceBand.high * 1.25) valueScore = 2;
  const name = [item.producer, item.label].filter(Boolean).join(" ");
  const avoidHit = avoid.some((row) => name.toLowerCase().includes(row.toLowerCase()) || row.toLowerCase().includes(name.toLowerCase()));
  let brianFit = Math.round(descriptorScore + identityScore + producerScore + valueScore);
  const reasons: string[] = [];
  if (descriptorMatches.length) reasons.push(`Matches Brian's loved descriptors: ${descriptorMatches.join(", ")}.`);
  if (identityScore) {
    const benchmark = producers.length ? `, including the ${producers[0]} benchmark lane` : "";
    reasons.push(`Region/varietal matches prior high-scoring bottles${benchmark}.`);
  }
  if (producerScore) reasons.push(`${item.producer} is a benchmark-linked producer.`);
  if (valueScore >= 15) reasons.push("Price sits inside Brian's proven comfort band.");
  if (avoidHit) {
    brianFit = Math.min(brianFit, 15);
    reasons.unshift("Skip: matches Brian's avoid list.");
  }
  if (!reasons.length) reasons.push("Limited Brian-specific evidence; treat as exploratory.");
  const tier = avoidHit ? "skip" : brianFit >= 72 ? "pour" : brianFit >= 45 ? "consider" : "skip";
  const cuisineFit = cuisine ? Math.min(100, brianFit + (/steak|beef|grill/i.test(cuisine) && /cabernet|red/i.test(item.varietal ?? item.label) ? 10 : 0)) : brianFit;
  return { line_item: item, brian_fit: brianFit, tier, reasons, readiness: item.readiness ?? "unknown", value_flag: item.value_flag ?? "fair", cuisine_fit: cuisineFit };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST required" }, 405);
  try {
    const ownerId = await userIdFromRequest(req);
    if (!ownerId) return jsonResponse({ ok: false, error: "authenticated user required" }, 400);
    const body = await req.json();
    const client = supabase();
    const { data: profile } = await client.from("taste_profile").select("*").eq("owner_id", ownerId).order("refreshed_at", { ascending: false }).limit(1).maybeSingle();
    const effectiveProfile = profile ?? { loved_descriptors: ["smooth", "rich", "long finish"], preferred_regions: ["Mendoza"], preferred_varietals: ["Cabernet Sauvignon"], preferred_producers: ["Tapiz"], price_band: { typical: 100, high: 150 }, avoid_list: ["Miss Merlot"] };
    const parsed = fixtureEnabled() ? fixtureParsed : await anthropicJson<LineItem[]>({
      model: "claude-sonnet-4-6",
      system: "OCR this restaurant wine list image. Return JSON array only: [{producer,label,vintage,varietal,region,price,descriptors,readiness,value_flag}].",
      messages: [{ role: "user", content: [{ type: "text", text: `Cuisine: ${body.cuisine ?? "unknown"}. Context: ${body.context ?? ""}` }, { type: "image", source: { type: "base64", media_type: body.media_type ?? "image/jpeg", data: body.image_base64 } }] }],
    });
    const recommendations = parsed.map((item) => score(item, effectiveProfile, body.cuisine)).sort((a, b) => b.brian_fit - a.brian_fit);
    const { data: inserted, error } = await client.from("wine_lists").insert({ owner_id: ownerId, restaurant: body.restaurant ?? null, cuisine: body.cuisine ?? null, context: body.context ?? null, parsed, recommendations }).select("id").single();
    if (error) throw error;
    return jsonResponse({ ok: true, wine_list_id: inserted.id, parsed, recommendations });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
