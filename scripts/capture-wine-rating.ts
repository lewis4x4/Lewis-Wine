import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export type CaptureInput = {
  user_id: string;
  wine: {
    name: string;
    producer?: string | null;
    vintage?: number | null;
    wine_type?: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
    region?: string | null;
  };
  rating?: {
    score: number;
    tasting_date?: string | null;
    tasting_notes?: string | null;
    palate_notes?: string | null;
    occasion?: string | null;
    occasion_tags?: string[] | null;
  } | null;
  signals?: {
    smoothness?: number | null;
    boldness?: number | null;
    earthiness?: number | null;
    spiciness?: number | null;
    fruit_forward?: number | null;
    dryness?: number | null;
    tannin_strength?: number | null;
    acidity_level?: number | null;
    finish_length?: number | null;
    richness?: number | null;
    buy_again?: boolean | null;
    value_feel?: "poor" | "fair" | "good" | "strong" | "excellent" | null;
    decision_tags?: string[] | null;
    occasion_tags?: string[] | null;
    brian_phrases?: string[] | null;
    extracted_from_text?: Record<string, unknown> | null;
  } | null;
  inventory?: {
    quantity?: number;
    status?: "in_cellar" | "consumed" | "gifted" | "sold";
    consumed_date?: string | null;
    notes?: string | null;
    tags?: string[] | null;
  } | null;
};

async function resolveCellarId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("cellars")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data?.id) return data.id;

  const { data: inserted, error: insertError } = await supabase
    .from("cellars")
    .insert({ owner_id: userId, name: "My Cellar" })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}

async function resolveInventory(input: CaptureInput, cellarId: string): Promise<string> {
  const { wine } = input;
  const { data: existing, error } = await supabase
    .from("cellar_inventory")
    .select("id")
    .eq("cellar_id", cellarId)
    .eq("custom_name", wine.name)
    .eq("custom_producer", wine.producer || null)
    .eq("custom_vintage", wine.vintage || null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (existing?.id) return existing.id;

  const inventoryPayload = {
    cellar_id: cellarId,
    custom_name: wine.name,
    custom_producer: wine.producer || null,
    custom_vintage: wine.vintage || null,
    custom_wine_type: wine.wine_type || null,
    custom_region: wine.region || null,
    quantity: input.inventory?.quantity ?? 1,
    status: input.inventory?.status ?? "consumed",
    consumed_date: input.inventory?.consumed_date ?? input.rating?.tasting_date ?? new Date().toISOString().split("T")[0],
    notes: input.inventory?.notes ?? input.rating?.tasting_notes ?? null,
    tags: input.inventory?.tags ?? ["captured-by-skill"],
  };

  const { data: inserted, error: insertError } = await supabase
    .from("cellar_inventory")
    .insert(inventoryPayload)
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}

async function upsertRating(input: CaptureInput, inventoryId: string): Promise<string> {
  if (!input.rating) {
    throw new Error("Rating is required to create or update a rating record.");
  }

  const tastingDate = input.rating.tasting_date ?? new Date().toISOString().split("T")[0];

  const { data: existing, error } = await supabase
    .from("ratings")
    .select("id")
    .eq("user_id", input.user_id)
    .eq("inventory_id", inventoryId)
    .eq("score", input.rating.score)
    .eq("tasting_date", tastingDate)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (existing?.id) return existing.id;

  const { data: inserted, error: insertError } = await supabase
    .from("ratings")
    .insert({
      user_id: input.user_id,
      inventory_id: inventoryId,
      score: input.rating.score,
      tasting_date: tastingDate,
      tasting_notes: input.rating.tasting_notes ?? null,
      palate_notes: input.rating.palate_notes ?? null,
      occasion: input.rating.occasion ?? null,
      occasion_tags: input.rating.occasion_tags ?? null,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}

async function upsertSignals(input: CaptureInput, ratingId: string) {
  if (!input.signals) return;

  const { error } = await supabase
    .from("rating_signals")
    .upsert({
      rating_id: ratingId,
      user_id: input.user_id,
      ...input.signals,
    }, { onConflict: "rating_id" });

  if (error) throw error;
}

export async function captureWineRating(input: CaptureInput) {
  const cellarId = await resolveCellarId(input.user_id);
  const inventoryId = await resolveInventory(input, cellarId);
  const ratingId = input.rating ? await upsertRating(input, inventoryId) : null;
  if (ratingId) {
    await upsertSignals(input, ratingId);
  }

  return {
    cellarId,
    inventoryId,
    ratingId,
  };
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    throw new Error("Pass a single JSON argument to capture-wine-rating.ts");
  }

  const input = JSON.parse(raw) as CaptureInput;
  const result = await captureWineRating(input);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
