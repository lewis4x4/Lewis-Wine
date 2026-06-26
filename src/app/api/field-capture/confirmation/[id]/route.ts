import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

type Row = Record<string, unknown>;

function wineTitle(wine: Row | null | undefined) {
  if (!wine) return "Captured wine";
  return [wine.vintage, wine.producer, wine.label ?? wine.varietal]
    .filter(Boolean)
    .join(" ") || "Captured wine";
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compact<T>(value: T | null | undefined) {
  return value == null || value === "" ? null : value;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tastingId = idSchema.parse(id);
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data: tasting, error: tastingError } = await client
      .from("tastings")
      .select("id,owner_id,wine_id,score,buy_again,occasion,descriptors,notes,is_benchmark,evidence_path,tasted_at,created_at,field_capture_idempotency_key,extraction")
      .eq("owner_id", user.id)
      .eq("id", tastingId)
      .single();

    if (tastingError || !tasting) {
      return NextResponse.json({ success: false, error: "Tasting memory not found" }, { status: 404 });
    }

    const { data: wine, error: wineError } = await client
      .from("wines")
      .select("id,owner_id,producer,label,vintage,region,subregion,country,varietal,wine_type,created_at")
      .eq("owner_id", user.id)
      .eq("id", tasting.wine_id)
      .single();
    if (wineError || !wine) throw wineError ?? new Error("Wine record not found");

    const { data: historyRows, error: historyError } = await client
      .from("tastings")
      .select("id,score,buy_again,occasion,descriptors,notes,is_benchmark,tasted_at,created_at")
      .eq("owner_id", user.id)
      .eq("wine_id", wine.id)
      .order("created_at", { ascending: false })
      .limit(8);
    if (historyError) throw historyError;

    const history = ((historyRows ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      score: numberOrNull(row.score),
      buy_again: compact(row.buy_again),
      occasion: compact(row.occasion),
      descriptors: Array.isArray(row.descriptors) ? row.descriptors : [],
      notes: compact(row.notes),
      is_benchmark: Boolean(row.is_benchmark),
      tasted_at: compact(row.tasted_at),
      created_at: compact(row.created_at),
      current: row.id === tasting.id,
    }));

    const scores = history.map((row) => row.score).filter((score): score is number => typeof score === "number");
    const avgScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
    const highScore = scores.length ? Math.max(...scores) : null;
    const buyAgainCount = history.filter((row) => row.buy_again === "yes").length;
    const benchmarkCount = history.filter((row) => row.is_benchmark).length;

    const { data: buyAgainQueue } = await client
      .from("buy_again_queue")
      .select("id,status,target_price,best_observation_id,updated_at,note")
      .eq("owner_id", user.id)
      .eq("wine_id", wine.id)
      .maybeSingle();

    let acquisitionTarget: Row | null = null;
    if (buyAgainQueue?.id) {
      const { data: acquisition } = await client
        .from("acquisition_watchlist")
        .select("id,status,priority,desired_quantity,target_price_cents,max_price_cents,next_refresh_at,notes")
        .eq("user_id", user.id)
        .eq("source_kind", "buy_again")
        .eq("source_id", String(buyAgainQueue.id))
        .maybeSingle();
      acquisitionTarget = acquisition ?? null;
    }

    const { data: observations } = await client
      .from("price_observations")
      .select("id,source_name,source_url,price,currency,availability,confidence,observed_at")
      .eq("wine_id", wine.id)
      .order("observed_at", { ascending: false })
      .limit(3);

    const extraction = (tasting.extraction ?? {}) as Row;
    return NextResponse.json({
      success: true,
      confirmation: {
        title: wineTitle(wine),
        saved_at: tasting.created_at,
        save_mode: extraction.save_mode ?? "memory_only",
        inventory_id: extraction.inventory_id ?? null,
        rating_id: extraction.rating_id ?? null,
      },
      wine,
      tasting,
      stats: {
        tasting_count: history.length,
        average_score: avgScore,
        high_score: highScore,
        buy_again_count: buyAgainCount,
        benchmark_count: benchmarkCount,
        latest_score: numberOrNull(tasting.score),
        evidence_saved: Boolean(tasting.evidence_path),
      },
      history,
      downstream: {
        buy_again_queue: buyAgainQueue ?? null,
        acquisition_target: acquisitionTarget,
        price_observations: observations ?? [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load capture confirmation" },
      { status: 500 }
    );
  }
}
