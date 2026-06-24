import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildSaveTastingPayload, type ReviewDraft } from "@/lib/field-capture";

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
    const client = supabase as unknown as {
      from: (table: string) => {
        insert: (values: Record<string, unknown>) => {
          select: (columns?: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: Error | null }> };
        };
      };
    };

    const { data: wine, error: wineError } = await client
      .from("wines")
      .insert({ owner_id: user.id, ...payload.wine })
      .select("id,producer,label,vintage,region,varietal")
      .single();

    if (wineError || !wine) throw wineError ?? new Error("Wine save returned no row");

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
        extraction: payload.tasting.extraction,
      })
      .select("id,wine_id,score,buy_again,occasion,descriptors,notes,is_benchmark,tasted_at")
      .single();

    if (tastingError || !tasting) throw tastingError ?? new Error("Tasting save returned no row");

    return NextResponse.json({
      success: true,
      wine,
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
