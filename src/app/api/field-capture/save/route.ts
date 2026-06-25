import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildEvidenceUpload, buildSaveTastingPayload, buildWineIdentityKey, type ReviewDraft } from "@/lib/field-capture";

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

    const payload = buildSaveTastingPayload(draft);
    const wineIdentityKey = buildWineIdentityKey(payload.wine);
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns?: string) => {
          eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => {
              limit: (count: number) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
            };
            is: (column: string, value: null) => {
              limit: (count: number) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
            };
          };
        };
        insert: (values: Record<string, unknown>) => {
          select: (columns?: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }> };
        };
      };
      storage: {
        from: (bucket: string) => {
          upload: (
            path: string,
            body: Uint8Array,
            options: { contentType: string; upsert: boolean }
          ) => Promise<{ data: { path: string } | null; error: Error | null }>;
        };
      };
    };

    const vintageFilter = client
      .from("wines")
      .select("id,producer,label,vintage,region,varietal")
      .eq("owner_id", user.id);
    const { data: existingRows, error: lookupError } = payload.wine.vintage == null
      ? await vintageFilter.is("vintage", null).limit(200)
      : await vintageFilter.eq("vintage", payload.wine.vintage).limit(200);
    if (lookupError) throw lookupError;

    const existingWine = (existingRows ?? []).find((row) => buildWineIdentityKey({
      producer: (row.producer as string | null) ?? null,
      label: (row.label as string | null) ?? null,
      vintage: (row.vintage as number | null) ?? null,
    }) === wineIdentityKey) ?? null;

    let reusedWine = Boolean(existingWine);
    let wine = existingWine;

    if (!wine) {
      const { data: insertedWine, error: wineError } = await client
        .from("wines")
        .insert({ owner_id: user.id, ...payload.wine })
        .select("id,producer,label,vintage,region,varietal")
        .single();

      if (wineError || !insertedWine) throw wineError ?? new Error("Wine save returned no row");
      wine = insertedWine;
      reusedWine = false;
    }

    let evidencePath: string | null = null;
    if (payload.evidence_data_url) {
      const evidence = buildEvidenceUpload({
        ownerId: user.id,
        wineId: String(wine.id),
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

    const { data: tasting, error: tastingError } = await client
      .from("tastings")
      .insert({
        owner_id: user.id,
        wine_id: wine.id,
        score: payload.tasting.score,
        buy_again: payload.tasting.buy_again,
        occasion: payload.tasting.occasion,
        descriptors: payload.tasting.descriptors,
        notes: payload.tasting.notes,
        evidence_path: evidencePath,
        extraction: payload.tasting.extraction,
      })
      .select("id,wine_id,score,buy_again,occasion,descriptors,notes,is_benchmark,evidence_path,tasted_at")
      .single();

    if (tastingError || !tasting) throw tastingError ?? new Error("Tasting save returned no row");

    return NextResponse.json({
      success: true,
      wine,
      reused_wine: reusedWine,
      tasting,
      actions: {
        find_more: `/intelligence?wine_id=${wine.id}&action=find-more`,
        buy_again: `/intelligence?wine_id=${wine.id}#buy-again`,
        bottle: `/cellar/${wine.id}?tasting=${tasting.id}`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save field capture" },
      { status: 400 }
    );
  }
}
