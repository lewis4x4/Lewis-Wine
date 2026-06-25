import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildEvidenceUpload,
  buildFieldCaptureCellarPayload,
  buildFieldCaptureRatingPayload,
  buildFieldCaptureRatingSignalPayload,
  buildSaveTastingPayload,
  buildWineIdentityKey,
  type ReviewDraft,
} from "@/lib/field-capture";

const buyAgainSchema = z.enum(["yes", "no", "maybe", "cellar_only"]);
const wineTypeSchema = z.enum(["red", "white", "rose", "rosé", "sparkling", "dessert", "fortified"]).nullable();

const reviewDraftSchema = z.object({
  producer: z.string().nullable(),
  label: z.string().nullable(),
  vintage: z.number().int().min(1800).max(2200).nullable(),
  region: z.string().nullable(),
  subregion: z.string().nullable().optional(),
  country: z.string().nullable(),
  varietal: z.string().nullable(),
  wine_type: wineTypeSchema,
  confidence: z.record(z.string(), z.number()).nullable().optional(),
  ambiguous_fields: z.array(z.string()).nullable().optional(),
  title: z.string(),
  score: z.number().int().min(0).max(100).nullable(),
  buy_again: buyAgainSchema,
  occasion: z.string(),
  descriptors: z.array(z.string()),
  notes: z.string(),
  is_benchmark: z.boolean(),
  benchmark_prompt: z.string().nullable(),
  confidence_label: z.enum(["High confidence", "Medium confidence", "Low confidence"]),
  evidence_data_url: z.string().nullable().optional(),
  idempotency_key: z.string().max(160).nullable().optional(),
  save_mode: z.enum(["memory_only", "add_to_cellar", "link_existing_inventory"]).optional(),
  inventory_id: z.string().uuid().nullable().optional(),
  cellar_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const draft = reviewDraftSchema.parse(await request.json()) as ReviewDraft;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const payload = buildSaveTastingPayload(draft);
    const wineIdentityKey = buildWineIdentityKey(payload.wine);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;

    async function replayExistingCapture() {
      if (!payload.idempotency_key) return null;
      const { data: existingTasting, error: existingTastingError } = await client
        .from("tastings")
        .select("id,wine_id,score,buy_again,occasion,descriptors,notes,is_benchmark,evidence_path,tasted_at,extraction")
        .eq("owner_id", userId)
        .eq("field_capture_idempotency_key", payload.idempotency_key)
        .maybeSingle();
      if (existingTastingError) throw existingTastingError;
      if (!existingTasting) return null;
      const { data: existingWine, error: existingWineError } = await client
        .from("wines")
        .select("id,producer,label,vintage,region,varietal")
        .eq("owner_id", userId)
        .eq("id", existingTasting.wine_id)
        .single();
      if (existingWineError) throw existingWineError;
      const extraction = (existingTasting.extraction ?? {}) as Record<string, unknown>;
      const inventoryId = typeof extraction.inventory_id === "string" ? extraction.inventory_id : null;
      const ratingId = typeof extraction.rating_id === "string" ? extraction.rating_id : null;
      return NextResponse.json({
        success: true,
        replayed: true,
        wine: existingWine,
        reused_wine: true,
        tasting: existingTasting,
        inventory: inventoryId ? { id: inventoryId } : null,
        rating: ratingId ? { id: ratingId } : null,
        actions: {
          find_more: `/intelligence?wine_id=${existingTasting.wine_id}&action=find-more`,
          buy_again: `/intelligence?wine_id=${existingTasting.wine_id}#buy-again`,
          bottle: inventoryId ? `/cellar/${inventoryId}?tasting=${ratingId ?? existingTasting.id}` : null,
        },
      }, { status: 200 });
    }

    const existingReplay = await replayExistingCapture();
    if (existingReplay) return existingReplay;

    const vintageFilter = client
      .from("wines")
      .select("id,producer,label,vintage,region,varietal")
      .eq("owner_id", userId);
    const { data: existingRows, error: lookupError } = payload.wine.vintage == null
      ? await vintageFilter.is("vintage", null).limit(200)
      : await vintageFilter.eq("vintage", payload.wine.vintage).limit(200);
    if (lookupError) throw lookupError;

    const existingWine = ((existingRows ?? []) as Record<string, unknown>[]).find((row) => buildWineIdentityKey({
      producer: (row.producer as string | null) ?? null,
      label: (row.label as string | null) ?? null,
      vintage: (row.vintage as number | null) ?? null,
    }) === wineIdentityKey) ?? null;

    let reusedWine = Boolean(existingWine);
    let wine = existingWine;

    if (!wine) {
      const { data: insertedWine, error: wineError } = await client
        .from("wines")
        .insert({ owner_id: userId, ...payload.wine })
        .select("id,producer,label,vintage,region,varietal")
        .single();

      if (wineError || !insertedWine) throw wineError ?? new Error("Wine save returned no row");
      wine = insertedWine;
      reusedWine = false;
    }

    const savedWine = wine as Record<string, unknown>;

    let evidencePath: string | null = null;
    if (payload.evidence_data_url) {
      const evidence = buildEvidenceUpload({
        ownerId: userId,
        wineId: String(savedWine.id),
        dataUrl: payload.evidence_data_url,
        token: crypto.randomUUID(),
      });
      const { error: uploadError } = await client
        .storage
        .from(evidence.bucket)
        .upload(evidence.path, evidence.bytes, { contentType: evidence.contentType, upsert: false });
      if (uploadError) throw uploadError;
      evidencePath = evidence.path;
    }

    let linkedInventory: { id: string; wine_reference_id: string | null } | null = null;
    let rating: { id: string } | null = null;

    if (payload.save_mode === "link_existing_inventory") {
      if (!payload.inventory_id) return NextResponse.json({ success: false, error: "inventory_id is required for linked cellar capture" }, { status: 400 });
      const { data: inventory, error: inventoryError } = await client
        .from("cellar_inventory")
        .select("id,wine_reference_id,cellars!inner(owner_id)")
        .eq("id", payload.inventory_id)
        .eq("cellars.owner_id", userId)
        .single();
      if (inventoryError || !inventory) return NextResponse.json({ success: false, error: "Inventory bottle not found" }, { status: 404 });
      linkedInventory = { id: String(inventory.id), wine_reference_id: inventory.wine_reference_id ?? null };
    }

    if (payload.save_mode === "add_to_cellar") {
      const cellarQuery = client.from("cellars").select("id").eq("owner_id", userId).limit(1);
      const { data: cellarRows, error: cellarError } = payload.cellar_id
        ? await cellarQuery.eq("id", payload.cellar_id)
        : await cellarQuery;
      const cellar = Array.isArray(cellarRows) ? cellarRows[0] : cellarRows;
      if (cellarError || !cellar) return NextResponse.json({ success: false, error: "No cellar found" }, { status: 404 });
      const cellarPayload = buildFieldCaptureCellarPayload(draft, { cellarId: String(cellar.id), quantity: payload.quantity, labelImageUrl: evidencePath });
      const { data: inventory, error: inventoryError } = await client
        .from("cellar_inventory")
        .insert(cellarPayload)
        .select("id,wine_reference_id")
        .single();
      if (inventoryError || !inventory) throw inventoryError ?? new Error("Cellar inventory save returned no row");
      linkedInventory = { id: String(inventory.id), wine_reference_id: inventory.wine_reference_id ?? null };
    }

    if (linkedInventory) {
      const ratingPayload = buildFieldCaptureRatingPayload(draft, { inventoryId: linkedInventory.id, wineReferenceId: linkedInventory.wine_reference_id });
      if (ratingPayload) {
        const { data: ratingRow, error: ratingError } = await client
          .from("ratings")
          .insert({ ...ratingPayload, user_id: userId, tasting_date: new Date().toISOString().slice(0, 10), field_capture_idempotency_key: payload.idempotency_key ?? null })
          .select("id")
          .single();
        if (ratingError) {
          if (payload.idempotency_key && (ratingError as { code?: string }).code === "23505") {
            const { data: replayedRating, error: replayedRatingError } = await client
              .from("ratings")
              .select("id")
              .eq("user_id", userId)
              .eq("field_capture_idempotency_key", payload.idempotency_key)
              .maybeSingle();
            if (replayedRatingError) throw replayedRatingError;
            if (replayedRating) rating = { id: String(replayedRating.id) };
          }
          if (!rating) throw ratingError;
        }
        if (!rating) {
          if (!ratingRow) throw new Error("Rating save returned no row");
          rating = { id: String(ratingRow.id) };
        }
        const signalPayload = buildFieldCaptureRatingSignalPayload(draft, { saveMode: payload.save_mode, inventoryId: linkedInventory.id });
        const { error: signalError } = await client
          .from("rating_signals")
          .upsert({ ...signalPayload, rating_id: rating.id, user_id: userId }, { onConflict: "rating_id" });
        if (signalError) throw signalError;
      }
    }

    const extraction = {
      ...payload.tasting.extraction,
      save_mode: payload.save_mode,
      inventory_id: linkedInventory?.id ?? payload.inventory_id ?? null,
      rating_id: rating?.id ?? null,
    };

    const { data: tasting, error: tastingError } = await client
      .from("tastings")
      .insert({
        owner_id: userId,
        wine_id: savedWine.id,
        score: payload.tasting.score,
        buy_again: payload.tasting.buy_again,
        occasion: payload.tasting.occasion,
        descriptors: payload.tasting.descriptors,
        notes: payload.tasting.notes,
        evidence_path: evidencePath,
        field_capture_idempotency_key: payload.idempotency_key ?? null,
        extraction,
      })
      .select("id,wine_id,score,buy_again,occasion,descriptors,notes,is_benchmark,evidence_path,tasted_at")
      .single();

    if (tastingError) {
      if (payload.idempotency_key && (tastingError as { code?: string }).code === "23505") {
        const replay = await replayExistingCapture();
        if (replay) return replay;
      }
      throw tastingError;
    }
    if (!tasting) throw new Error("Tasting save returned no row");

    return NextResponse.json({
      success: true,
      wine,
      reused_wine: reusedWine,
      tasting,
      inventory: linkedInventory,
      rating,
      actions: {
        find_more: `/intelligence?wine_id=${savedWine.id}&action=find-more`,
        buy_again: `/intelligence?wine_id=${savedWine.id}#buy-again`,
        bottle: linkedInventory ? `/cellar/${linkedInventory.id}?tasting=${rating?.id ?? tasting.id}` : null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save field capture" },
      { status: 400 }
    );
  }
}
