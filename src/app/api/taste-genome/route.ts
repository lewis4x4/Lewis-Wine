import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTasteGenome, type TasteGenomeRating } from "@/lib/taste-genome";
import { buildTasteGenomeDashboard } from "@/lib/taste-genome-dashboard";
import type { TasteProfile } from "@/lib/pourfolio-intelligence";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizePriceBand(value: unknown): TasteProfile["priceBand"] {
  if (!value || typeof value !== "object") return { low: null, typical: null, high: null };
  const record = value as Record<string, unknown>;
  const numberOrNull = (candidate: unknown) => typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
  return {
    low: numberOrNull(record.low),
    typical: numberOrNull(record.typical),
    high: numberOrNull(record.high),
  };
}

function toActiveProfile(row: Record<string, unknown> | null): TasteProfile | null {
  if (!row) return null;
  return {
    lovedDescriptors: asStringArray(row.loved_descriptors),
    preferredRegions: asStringArray(row.preferred_regions),
    preferredVarietals: asStringArray(row.preferred_varietals),
    preferredProducers: asStringArray(row.preferred_producers),
    priceBand: normalizePriceBand(row.price_band),
    avoidList: asStringArray(row.avoid_list),
    benchmarkWineIds: asStringArray(row.benchmark_wine_ids),
    refreshedAt: String(row.refreshed_at ?? row.created_at ?? new Date(0).toISOString()),
  };
}

function toGenomeRating(row: Record<string, unknown>): TasteGenomeRating {
  const inventory = (row.inventory && typeof row.inventory === "object") ? row.inventory as Record<string, unknown> : null;
  const reference = inventory?.wine_reference && typeof inventory.wine_reference === "object" ? inventory.wine_reference as Record<string, unknown> : null;
  const signals = Array.isArray(row.rating_signals) ? row.rating_signals as Record<string, unknown>[] : [];
  const signal = signals[0] ?? null;
  return {
    id: String(row.id),
    score: Number(row.score ?? 0),
    wine_type: (reference?.wine_type as string | null) ?? (inventory?.custom_wine_type as string | null) ?? null,
    region: (reference?.region as string | null) ?? (inventory?.custom_region as string | null) ?? null,
    producer: (reference?.producer as string | null) ?? (inventory?.custom_producer as string | null) ?? null,
    vintage: typeof inventory?.vintage === "number" ? inventory.vintage : null,
    purchase_price_cents: typeof inventory?.purchase_price_cents === "number" ? inventory.purchase_price_cents : null,
    rating_signal: signal,
  };
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = auth.supabase as any;

    const [{ data: ratings, error: ratingsError }, { data: activeProfileRows, error: activeProfileError }, { data: brianProfile, error: brianProfileError }] = await Promise.all([
      client.from("ratings").select(`
        *,
        inventory:cellar_inventory (
          vintage,
          purchase_price_cents,
          custom_wine_type,
          custom_region,
          custom_producer,
          wine_reference (*)
        ),
        rating_signals (*)
      `),
      client.from("taste_profile").select("*").eq("owner_id", auth.user.id).order("refreshed_at", { ascending: false }).limit(1),
      client.from("brian_taste_profiles").select("*").eq("user_id", auth.user.id).maybeSingle(),
    ]);

    if (ratingsError) throw ratingsError;
    if (activeProfileError) throw activeProfileError;
    if (brianProfileError) throw brianProfileError;

    const firstParty = buildTasteGenome(((ratings ?? []) as Record<string, unknown>[]).map(toGenomeRating));
    const activeProfile = toActiveProfile(((activeProfileRows ?? []) as Record<string, unknown>[])[0] ?? null);
    const brianFitProfile = brianProfile ? {
      favoriteDescriptors: asStringArray(brianProfile.favorite_descriptors),
      avoidDescriptors: asStringArray(brianProfile.avoid_descriptors),
      confidenceScore: typeof brianProfile.confidence_score === "number" ? brianProfile.confidence_score : null,
      summary: (brianProfile.profile_summary as string | null) ?? null,
      updatedAt: (brianProfile.updated_at as string | null) ?? null,
    } : null;

    const dashboard = buildTasteGenomeDashboard({ firstParty, activeProfile, brianFitProfile });
    return NextResponse.json({ success: true, dashboard, firstParty, activeProfile, brianFitProfile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load Taste Genome" }, { status: 500 });
  }
}
