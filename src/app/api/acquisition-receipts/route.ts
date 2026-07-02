import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildAcquisitionReceipt,
  parseReceiptText,
  receiptItemToCellarPayload,
  receiptItemToPriceObservation,
  receiptItemToTargetUpdate,
  type AcquisitionReceiptInput,
  type AcquisitionReceiptItem,
} from "@/lib/acquisition-receipt";

const itemSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  wineTitle: z.string(),
  producer: z.string().nullable().optional(),
  label: z.string(),
  vintage: z.number().int().nullable().optional(),
  region: z.string().nullable().optional(),
  varietal: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative().nullable().optional(),
  lineTotalCents: z.number().int().nonnegative().nullable().optional(),
  acquisitionTargetId: z.string().uuid().nullable().optional(),
  selected: z.boolean().optional(),
});

const receiptSchema = z.object({
  vendor: z.string().nullable().optional(),
  vendorType: z.enum(["retailer", "winery", "auction", "private", "other"]).nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  subtotalCents: z.number().int().nonnegative().nullable().optional(),
  taxCents: z.number().int().nonnegative().nullable().optional(),
  totalCents: z.number().int().nonnegative().nullable().optional(),
  receiptText: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(itemSchema).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

function parseBody(body: z.infer<typeof receiptSchema>): AcquisitionReceiptInput {
  if ((!body.items || !body.items.length) && body.receiptText?.trim()) {
    const parsed = parseReceiptText(body.receiptText);
    return {
      vendor: body.vendor ?? parsed.vendor,
      vendorType: body.vendorType ?? parsed.vendorType,
      purchaseDate: body.purchaseDate ?? parsed.purchaseDate,
      subtotalCents: body.subtotalCents ?? parsed.subtotalCents,
      taxCents: body.taxCents ?? parsed.taxCents,
      totalCents: body.totalCents ?? parsed.totalCents,
      receiptText: body.receiptText,
      notes: body.notes,
      items: parsed.items,
    };
  }
  return {
    vendor: body.vendor ?? null,
    vendorType: body.vendorType ?? "retailer",
    purchaseDate: body.purchaseDate ?? null,
    subtotalCents: body.subtotalCents ?? null,
    taxCents: body.taxCents ?? null,
    totalCents: body.totalCents ?? null,
    receiptText: body.receiptText ?? null,
    notes: body.notes ?? null,
    items: (body.items ?? []).map((item) => ({
      ...item,
      producer: item.producer ?? null,
      vintage: item.vintage ?? null,
      region: item.region ?? null,
      varietal: item.varietal ?? null,
      unitPriceCents: item.unitPriceCents ?? null,
      lineTotalCents: item.lineTotalCents ?? null,
      acquisitionTargetId: item.acquisitionTargetId ?? null,
    })),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

function receiptToDb(receipt: ReturnType<typeof buildAcquisitionReceipt>, userId: string) {
  return {
    user_id: userId,
    vendor: receipt.vendor,
    vendor_type: receipt.vendorType,
    purchase_date: receipt.purchaseDate,
    subtotal_cents: receipt.subtotalCents,
    tax_cents: receipt.taxCents,
    total_cents: receipt.totalCents,
    receipt_text: receipt.receiptText,
    notes: receipt.notes,
    summary: receipt.summary,
  };
}

function itemToDb(item: AcquisitionReceiptItem, receiptId: string, inventoryId?: string | null, priceObservationId?: string | null) {
  return {
    receipt_id: receiptId,
    acquisition_target_id: item.acquisitionTargetId ?? null,
    inventory_id: inventoryId ?? null,
    price_observation_id: priceObservationId ?? null,
    selected: item.selected,
    action: item.action,
    wine_title: item.wineTitle,
    producer: item.producer,
    label: item.label,
    vintage: item.vintage,
    region: item.region,
    varietal: item.varietal,
    quantity: item.quantity,
    unit_price_cents: item.unitPriceCents,
    line_total_cents: item.lineTotalCents,
    raw_text: item.rawText,
  };
}

function priceObservationToDb(observation: ReturnType<typeof receiptItemToPriceObservation>) {
  return {
    inventory_id: observation.inventoryId,
    wine_reference_id: observation.wineReferenceId,
    source_type: observation.sourceType,
    source_name: observation.sourceName,
    source_url: observation.sourceUrl,
    observation_kind: observation.observationKind,
    truth_label: observation.truthLabel,
    review_status: observation.reviewStatus,
    observed_price_cents: observation.observedPriceCents,
    currency: observation.currency,
    bottle_size_ml: observation.bottleSizeMl,
    vintage: observation.vintage,
    confidence: observation.confidence,
    observed_at: observation.observedAt,
    notes: observation.notes,
    raw_payload: observation.rawPayload ?? {},
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = auth.supabase as any;
    const body = receiptSchema.parse(await request.json());
    const receipt = buildAcquisitionReceipt(parseBody(body));
    if (!receipt.items.length) return NextResponse.json({ success: false, error: "Receipt has no wine items" }, { status: 400 });

    const { data: cellar, error: cellarError } = await client.from("cellars").select("id").eq("owner_id", auth.user.id).limit(1).single();
    if (cellarError || !cellar) return NextResponse.json({ success: false, error: "No cellar found" }, { status: 404 });

    // Replay guard: a retry after a mid-loop failure (or a double submit)
    // must not re-insert bottles and price evidence (unique index in 00025).
    const userId = auth.user.id;
    const idempotencyKey = body.idempotencyKey ?? null;
    async function findExistingReceipt() {
      if (!idempotencyKey) return null;
      const { data: existing, error } = await client
        .from("acquisition_receipts")
        .select()
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      // 42703 = idempotency_key column missing (migration 00025 not applied);
      // degrade to the pre-idempotency behavior instead of failing the save.
      if (error && (error as { code?: string }).code !== "42703") throw error;
      return existing ?? null;
    }

    async function replayResponse(existingReceipt: { id: string }) {
      const { data: replayedItems, error: replayedItemsError } = await client
        .from("acquisition_receipt_items")
        .select()
        .eq("receipt_id", existingReceipt.id);
      if (replayedItemsError) throw replayedItemsError;
      return NextResponse.json({
        success: true,
        replayed: true,
        receipt: existingReceipt,
        items: replayedItems ?? [],
        summary: receipt.summary,
        purchaseStory: receipt.purchaseStory,
      });
    }

    const replayedReceipt = await findExistingReceipt();
    if (replayedReceipt) return replayResponse(replayedReceipt);

    let { data: receiptRow, error: receiptError } = await client
      .from("acquisition_receipts")
      .insert({ ...receiptToDb(receipt, auth.user.id), idempotency_key: idempotencyKey })
      .select()
      .single();
    if (receiptError) {
      const code = (receiptError as { code?: string }).code;
      if (code === "23505" && idempotencyKey) {
        // Lost a race with a concurrent identical submit — replay it.
        const concurrent = await findExistingReceipt();
        if (concurrent) return replayResponse(concurrent);
      } else if (code === "42703") {
        const fallback = await client.from("acquisition_receipts").insert(receiptToDb(receipt, auth.user.id)).select().single();
        receiptRow = fallback.data;
        receiptError = fallback.error;
      }
    }
    if (receiptError) throw receiptError;

    const savedItems = [];
    for (const item of receipt.items) {
      let inventoryId: string | null = null;
      let priceObservationId: string | null = null;
      if (item.selected && item.action !== "record_only") {
        const cellarPayload = receiptItemToCellarPayload(item, cellar.id, receipt);
        const { data: inventory, error: inventoryError } = await client.from("cellar_inventory").insert(cellarPayload).select().single();
        if (inventoryError) throw inventoryError;
        inventoryId = inventory.id;
        const priceObservation = receiptItemToPriceObservation(item, inventory.id, receipt);
        const { data: priceRow, error: priceError } = await client.from("wine_price_observations").insert(priceObservationToDb(priceObservation)).select().single();
        if (priceError) throw priceError;
        priceObservationId = priceRow.id;
      }

      if (item.acquisitionTargetId && item.selected) {
        const update = receiptItemToTargetUpdate(item);
        const { error: targetError } = await client.from("acquisition_watchlist").update({
          status: update.status,
          acquired_quantity: update.acquiredQuantity,
          acquired_price_cents: update.acquiredPriceCents,
          acquired_at: new Date().toISOString(),
          acquisition_receipt_id: receiptRow.id,
        }).eq("id", item.acquisitionTargetId).eq("user_id", auth.user.id);
        if (targetError) throw targetError;
      }

      const { data: itemRow, error: itemError } = await client.from("acquisition_receipt_items").insert(itemToDb(item, receiptRow.id, inventoryId, priceObservationId)).select().single();
      if (itemError) throw itemError;
      savedItems.push(itemRow);
    }

    return NextResponse.json({ success: true, receipt: receiptRow, items: savedItems, summary: receipt.summary, purchaseStory: receipt.purchaseStory });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to capture acquisition receipt" }, { status: 500 });
  }
}
