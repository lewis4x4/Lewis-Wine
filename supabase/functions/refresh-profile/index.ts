import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { fixtureEnabled, jsonResponse } from "../_shared/intelligence.ts";

type Tasting = {
  id: string;
  wine_id: string;
  score: number | null;
  buy_again: string | null;
  descriptors: string[] | null;
  wines: { id: string; producer: string | null; region: string | null; varietal: string | null } | null;
};

type Observation = { wine_id: string; price: number };

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

function top(values: Array<{ value: string | null; weight: number }>, limit: number) {
  const scores = new Map<string, { label: string; score: number }>();
  for (const item of values) {
    if (!item.value) continue;
    const key = item.value.toLowerCase();
    const current = scores.get(key) ?? { label: item.value, score: 0 };
    current.score += item.weight;
    scores.set(key, current);
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.label);
}

function computeProfile(tastings: Tasting[], observations: Observation[]) {
  const loved = tastings.filter((row) => (row.score ?? 0) >= 90);
  const benchmarks = tastings.filter((row) => (row.score ?? 0) >= 94);
  const prices = observations.map((row) => Number(row.price)).filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  const priceAt = (index: number) => prices.length ? Math.round(prices[Math.max(0, Math.min(prices.length - 1, index))]) : null;
  return {
    loved_descriptors: top(loved.flatMap((row) => (row.descriptors ?? []).map((value) => ({ value, weight: row.score ?? 0 }))), 12),
    preferred_regions: top(loved.map((row) => ({ value: row.wines?.region ?? null, weight: row.score ?? 0 })), 8),
    preferred_varietals: top(loved.map((row) => ({ value: row.wines?.varietal ?? null, weight: row.score ?? 0 })), 8),
    preferred_producers: top(benchmarks.map((row) => ({ value: row.wines?.producer ?? null, weight: row.score ?? 0 })), 10),
    price_band: { low: priceAt(Math.floor(prices.length * 0.25)), typical: priceAt(Math.floor(prices.length * 0.5)), high: priceAt(Math.floor(prices.length * 0.85)) },
    avoid_list: tastings.filter((row) => row.buy_again === "no" || (row.score ?? 100) < 82).map((row) => [row.wines?.producer, row.wines?.varietal].filter(Boolean).join(" ")).filter(Boolean),
    benchmark_wine_ids: benchmarks.map((row) => row.wine_id),
  };
}

const fixtureProfile = {
  loved_descriptors: ["smooth", "rich", "long finish"],
  preferred_regions: ["Mendoza", "Napa Valley"],
  preferred_varietals: ["Cabernet Sauvignon"],
  preferred_producers: ["Tapiz", "Lewis Cellars"],
  price_band: { low: 60, typical: 100, high: 150 },
  avoid_list: ["Miss Merlot"],
  benchmark_wine_ids: [],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST required" }, 405);
  try {
    const ownerId = await userIdFromRequest(req);
    if (!ownerId) return jsonResponse({ ok: false, error: "authenticated user required" }, 400);
    const client = supabase();
    const profile = fixtureEnabled() ? fixtureProfile : await (async () => {
      const { data: tastings, error } = await client.from("tastings").select("id,wine_id,score,buy_again,descriptors,wines(id,producer,region,varietal)").eq("owner_id", ownerId);
      if (error) throw error;
      const { data: observations, error: obsError } = await client.from("price_observations").select("wine_id,price").eq("owner_id", ownerId);
      if (obsError) throw obsError;
      return computeProfile((tastings ?? []) as unknown as Tasting[], (observations ?? []) as unknown as Observation[]);
    })();
    const { data: inserted, error: insertError } = await client.from("taste_profile").insert({ owner_id: ownerId, ...profile }).select("*").single();
    if (insertError) throw insertError;
    return jsonResponse({ ok: true, profile: inserted });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
