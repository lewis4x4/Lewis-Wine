import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildVoiceTastingDraft, type VoiceTastingWineDoc } from "@/lib/voice-tasting-capture";
import type { CellarInventory, RatingInsert, RatingSignalInsert, WineReference } from "@/types/database";

type VoiceTastingRequest = {
  transcript?: string;
  save?: boolean;
  idempotencyKey?: string;
  selectedInventoryId?: string | null;
};

type InventoryForVoice = CellarInventory & {
  wine_reference: WineReference | null;
};

function toDoc(item: InventoryForVoice): VoiceTastingWineDoc {
  const name = item.wine_reference?.name || item.custom_name || "Unknown bottle";
  const vintage = item.vintage || item.custom_vintage;

  return {
    id: item.id,
    wine_reference_id: item.wine_reference_id,
    displayName: vintage ? `${vintage} ${name}` : name,
    producer: item.wine_reference?.producer || item.custom_producer,
    region: item.wine_reference?.region || item.custom_region,
    quantity: item.quantity,
    href: `/cellar/${item.id}`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as VoiceTastingRequest;
    const transcript = body.transcript?.trim();

    if (!transcript) {
      return NextResponse.json({ success: false, error: "Transcript is required." }, { status: 400 });
    }

    const idempotencyKey = body.idempotencyKey?.trim();
    if (idempotencyKey && idempotencyKey.length > 160) {
      return NextResponse.json({ success: false, error: "Invalid idempotency key." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: cellarRow } = await supabase
      .from("cellars")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    const cellar = cellarRow as { id: string } | null;
    if (!cellar) {
      return NextResponse.json({ success: false, error: "No cellar exists for this account." }, { status: 404 });
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from("cellar_inventory")
      .select("*, wine_reference (*)")
      .eq("cellar_id", cellar.id)
      .eq("status", "in_cellar")
      .gt("quantity", 0)
      .limit(120);

    if (inventoryError) throw inventoryError;

    const docs = ((inventory || []) as InventoryForVoice[]).map(toDoc);
    const selectedInventoryId = typeof body.selectedInventoryId === "string" ? body.selectedInventoryId.trim() : null;
    const draft = buildVoiceTastingDraft(transcript, docs, { selectedInventoryId });

    if (!body.save) {
      return NextResponse.json({ success: true, mode: "preview", draft });
    }

    if (draft.status !== "ready_to_save" || !draft.matchedWine) {
      return NextResponse.json(
        {
          success: false,
          mode: "preview",
          error: "JARVIS needs a high-confidence bottle match before saving this tasting.",
          draft,
        },
        { status: 422 },
      );
    }

    let ratingRow: { id: string } | null = null;

    if (idempotencyKey) {
      const { data: existingRating, error: existingRatingError } = await supabase
        .from("ratings")
        .select("id")
        .eq("user_id", user.id)
        .eq("voice_capture_idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingRatingError) throw existingRatingError;
      ratingRow = existingRating as { id: string } | null;
      if (ratingRow) {
        return NextResponse.json({
          success: true,
          mode: "saved",
          ratingId: ratingRow.id,
          message: "Already saved this voice tasting.",
        }, { status: 200 });
      }
    }

    const ratingInsert: RatingInsert = {
      ...draft.rating,
      user_id: user.id,
      inventory_id: draft.matchedWine.id,
      wine_reference_id: draft.matchedWine.wine_reference_id ?? null,
      voice_capture_idempotency_key: idempotencyKey || null,
    };

    if (!ratingRow) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rating, error: ratingError } = await (supabase as any)
        .from("ratings")
        .insert(ratingInsert)
        .select("id")
        .single();

      if (ratingError) {
        if (idempotencyKey && (ratingError as { code?: string }).code === "23505") {
          const { data: replayedRating, error: replayedRatingError } = await supabase
            .from("ratings")
            .select("id")
            .eq("user_id", user.id)
            .eq("voice_capture_idempotency_key", idempotencyKey)
            .maybeSingle();

          if (replayedRatingError) throw replayedRatingError;
          if (replayedRating) {
            return NextResponse.json({
              success: true,
              mode: "saved",
              ratingId: (replayedRating as { id: string }).id,
              message: "Already saved this voice tasting.",
            }, { status: 200 });
          }
        }
        throw ratingError;
      }
      ratingRow = rating as { id: string };
    }

    const signalInsert: RatingSignalInsert = {
      ...draft.ratingSignal,
      user_id: user.id,
      rating_id: ratingRow.id,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: signalError } = await (supabase as any)
      .from("rating_signals")
      .upsert(signalInsert, { onConflict: "rating_id" });

    if (signalError) throw signalError;

    return NextResponse.json({
      success: true,
      mode: "saved",
      ratingId: ratingRow.id,
      draft,
      message: `Saved ${draft.rating.score}-point tasting for ${draft.matchedWine.displayName}.`,
    }, { status: 201 });
  } catch (error) {
    console.error("Voice tasting capture failed", error);
    return NextResponse.json({ success: false, error: "Voice tasting capture could not run right now." }, { status: 500 });
  }
}
