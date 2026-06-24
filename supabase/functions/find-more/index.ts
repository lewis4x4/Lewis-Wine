import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { anthropicJson, fixtureEnabled, jsonResponse } from "../_shared/intelligence.ts";

type Observation = {
  source_name: string;
  source_url: string;
  price: number;
  currency: string;
  availability: "in_stock" | "limited" | "unknown" | "oos";
  confidence: number;
};

type FindMoreResult = {
  observations: Observation[];
  summary: string;
  searched_at: string;
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

const fixture: FindMoreResult = {
  observations: [
    { source_name: "Wine.com fixture", source_url: "https://www.wine.com/product/tapiz-alta-collection-cabernet-sauvignon-2021/fixture", price: 38.99, currency: "USD", availability: "in_stock", confidence: 0.86 },
    { source_name: "Producer shop fixture", source_url: "https://tapiz.com/alta-cabernet-2021", price: 42, currency: "USD", availability: "limited", confidence: 0.78 },
  ],
  summary: "Fixture evidence found two sourced replacement-price signals; Wine.com fixture is the best in-stock price.",
  searched_at: new Date("2026-06-23T00:00:00.000Z").toISOString(),
};

function validObservations(rows: Observation[]) {
  return rows.filter((row) => row.source_url && row.confidence >= 0 && row.confidence <= 1 && row.price >= 0);
}

function best(rows: Observation[]) {
  return [...rows].filter((row) => row.availability === "in_stock" || row.availability === "limited").sort((a, b) => a.price - b.price || b.confidence - a.confidence)[0] ?? rows[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST required" }, 405);
  try {
    const ownerId = await userIdFromRequest(req);
    const { wine_id } = await req.json();
    if (!ownerId || !wine_id) return jsonResponse({ ok: false, error: "wine_id and authenticated user required" }, 400);
    const client = supabase();
    const { data: wine, error } = await client.from("wines").select("id, producer, label, vintage, region, varietal").eq("id", wine_id).eq("owner_id", ownerId).single();
    if (error) throw error;
    const result = fixtureEnabled() ? fixture : await anthropicJson<FindMoreResult>({
      model: "claude-sonnet-4-6",
      system: "Find current public retail/replacement-price evidence for this wine. Use web search. Return JSON only: {observations:[{source_name,source_url,price,currency,availability,confidence}],summary,searched_at}. Every observation must include source_url and confidence 0-1.",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Find current sourced price and availability for ${wine.vintage ?? ""} ${wine.producer ?? ""} ${wine.label} ${wine.region ?? ""} ${wine.varietal ?? ""}.` }],
    });
    const observations = validObservations(result.observations ?? []);
    const insertedIds: string[] = [];
    for (const observation of observations) {
      const { data: inserted, error: insertError } = await client.from("price_observations").insert({
        owner_id: ownerId,
        wine_id,
        source_name: observation.source_name,
        source_url: observation.source_url,
        price: observation.price,
        currency: observation.currency || "USD",
        availability: observation.availability || "unknown",
        confidence: observation.confidence,
        observed_at: result.searched_at ?? new Date().toISOString(),
        raw: observation,
      }).select("id").single();
      if (insertError) throw insertError;
      insertedIds.push(inserted.id);
    }
    const bestObservation = best(observations);
    const bestIndex = bestObservation ? observations.indexOf(bestObservation) : -1;
    const bestId = bestIndex >= 0 ? insertedIds[bestIndex] : null;
    const { error: queueError } = await client.from("buy_again_queue").upsert({
      owner_id: ownerId,
      wine_id,
      status: "active",
      best_observation_id: bestId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id,wine_id" });
    if (queueError) throw queueError;
    return jsonResponse({ ok: true, wine, observations, best_observation_id: bestId, summary: result.summary, searched_at: result.searched_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("[BLOCKED") ? 424 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
});
