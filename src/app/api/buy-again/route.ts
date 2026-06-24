import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { nextBuyAgainStatus, type BuyAgainObservation, type BuyAgainQueueRow } from "@/lib/buy-again-command-center";

const updateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["buy-now", "watch", "acquired", "dismissed"]).optional(),
  target_price: z.number().nonnegative().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

function toObservation(row: Record<string, unknown>): BuyAgainObservation {
  return {
    id: String(row.id),
    source_name: String(row.source_name ?? "Unknown source"),
    source_url: (row.source_url as string | null) ?? null,
    price: Number(row.price ?? 0),
    currency: String(row.currency ?? "USD"),
    availability: (row.availability as BuyAgainObservation["availability"]) ?? "unknown",
    confidence: Number(row.confidence ?? 0),
    observed_at: String(row.observed_at ?? row.created_at ?? new Date(0).toISOString()),
  };
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = auth.supabase as any;

    const { data: queueRows, error: queueError } = await client
      .from("buy_again_queue")
      .select("*")
      .eq("owner_id", auth.user.id)
      .order("updated_at", { ascending: false });
    if (queueError) throw queueError;

    const wineIds = Array.from(new Set(((queueRows ?? []) as Record<string, unknown>[]).map((row) => String(row.wine_id)))) as string[];
    const winesById = new Map<string, Record<string, unknown>>();
    const observationsByWine = new Map<string, BuyAgainObservation[]>();

    if (wineIds.length) {
      const { data: wines, error: winesError } = await client
        .from("wines")
        .select("id,producer,label,vintage,region,varietal")
        .in("id", wineIds);
      if (winesError) throw winesError;
      for (const wine of (wines ?? []) as Record<string, unknown>[]) winesById.set(String(wine.id), wine);

      const { data: observations, error: observationsError } = await client
        .from("price_observations")
        .select("*")
        .in("wine_id", wineIds)
        .order("observed_at", { ascending: false });
      if (observationsError) throw observationsError;
      for (const row of (observations ?? []) as Record<string, unknown>[]) {
        const wineId = String(row.wine_id);
        const list = observationsByWine.get(wineId) ?? [];
        list.push(toObservation(row));
        observationsByWine.set(wineId, list);
      }
    }

    const rows: BuyAgainQueueRow[] = ((queueRows ?? []) as Record<string, unknown>[]).map((row) => {
      const wineId = String(row.wine_id);
      const observations = observationsByWine.get(wineId) ?? [];
      const bestId = row.best_observation_id ? String(row.best_observation_id) : null;
      return {
        id: String(row.id),
        wine_id: wineId,
        status: String(row.status ?? "active") as BuyAgainQueueRow["status"],
        target_price: row.target_price == null ? null : Number(row.target_price),
        added_at: (row.added_at as string | null) ?? null,
        updated_at: (row.updated_at as string | null) ?? null,
        acquired_at: (row.acquired_at as string | null) ?? null,
        dismissed_at: (row.dismissed_at as string | null) ?? null,
        snoozed_until: (row.snoozed_until as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        wine: winesById.get(wineId) ?? {},
        best_observation: observations.find((observation: BuyAgainObservation) => observation.id === bestId) ?? observations[0] ?? null,
        observations,
      };
    });

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load Buy Again queue" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const input = updateSchema.parse(await request.json());
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.action) Object.assign(patch, nextBuyAgainStatus(input.action));
    if (input.target_price !== undefined) patch.target_price = input.target_price;
    if (input.note !== undefined) patch.note = input.note;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (auth.supabase as any)
      .from("buy_again_queue")
      .update(patch)
      .eq("id", input.id)
      .eq("owner_id", auth.user.id)
      .select("id,status,target_price,updated_at,acquired_at,dismissed_at,note")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, row: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to update Buy Again queue" }, { status: 400 });
  }
}
