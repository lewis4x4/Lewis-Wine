import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deriveBrianFit } from "@/lib/brian-fit";
import { buildBottleBrainAnswer, retrieveBottleBrainContext, type BottleBrainWineDoc } from "@/lib/bottle-brain";
import type { BrianTasteProfile, CellarInventory, Rating, RatingSignal, WineReference } from "@/types/database";

type BottleBrainRequest = {
  question?: string;
};

type InventoryForBrain = CellarInventory & {
  wine_reference: WineReference | null;
  ratings: (Rating & { rating_signals?: RatingSignal[] | null })[];
};

function toDoc(item: InventoryForBrain, profile: BrianTasteProfile | null): BottleBrainWineDoc {
  const latestRating = item.ratings?.length
    ? [...item.ratings].sort((a, b) => new Date(b.tasting_date).getTime() - new Date(a.tasting_date).getTime())[0]
    : null;
  const latestSignal = latestRating?.rating_signals?.[0] ?? null;
  const brianFit = deriveBrianFit({
    profile,
    ratingSignal: latestSignal,
    tastingNotes: latestRating?.tasting_notes || latestRating?.palate_notes || latestRating?.nose_notes || item.notes,
    score: latestRating?.score ?? null,
  });
  const name = item.wine_reference?.name || item.custom_name || "Unknown bottle";
  const vintage = item.vintage || item.custom_vintage;

  return {
    id: item.id,
    displayName: vintage ? `${vintage} ${name}` : name,
    producer: item.wine_reference?.producer || item.custom_producer,
    region: item.wine_reference?.region || item.custom_region,
    wineType: item.wine_reference?.wine_type || item.custom_wine_type,
    quantity: item.quantity,
    drink_after: item.drink_after,
    drink_before: item.drink_before,
    brian_fit_score: brianFit?.score ?? null,
    brian_fit_reason: brianFit?.reason ?? null,
    ratings_count: item.ratings?.length ?? 0,
    latest_rating_score: latestRating?.score ?? null,
    notes: [item.notes, latestRating?.tasting_notes, latestRating?.palate_notes, latestRating?.nose_notes]
      .filter(Boolean)
      .join("\n"),
    tags: item.tags,
    href: `/cellar/${item.id}`,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as BottleBrainRequest;
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json({ success: false, error: "Question is required." }, { status: 400 });
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
      const retrieval = retrieveBottleBrainContext(question, [], { limit: 5 });
      const answer = buildBottleBrainAnswer(question, retrieval);
      return NextResponse.json({
        success: true,
        question,
        intent: retrieval.intent,
        decisionMode: retrieval.decisionMode,
        modeProfile: answer.modeProfile,
        occasionSignals: answer.occasionSignals,
        tradeoffs: answer.tradeoffs,
        answer: "I cannot answer from the cellar yet because no cellar exists for this account.",
        confidenceNote: "No cellar record found.",
        citations: [],
        evidencePackets: [],
        groundedClaims: [],
        knownFromCellar: [],
        inferredFromBrianFit: [],
        needsMoreSignal: [],
        nextSignals: [],
        searchedRecords: 0,
      });
    }

    const { data: inventory, error } = await supabase
      .from("cellar_inventory")
      .select(`
        *,
        wine_reference (*),
        ratings (
          *,
          rating_signals (*)
        )
      `)
      .eq("cellar_id", cellar.id)
      .eq("status", "in_cellar")
      .gt("quantity", 0)
      .limit(80);

    if (error) throw error;

    const { data: tasteProfile } = await supabase
      .from("brian_taste_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const docs = ((inventory || []) as InventoryForBrain[]).map((item) => toDoc(item, (tasteProfile as BrianTasteProfile | null) || null));
    const retrieval = retrieveBottleBrainContext(question, docs, { limit: 5 });
    const answer = buildBottleBrainAnswer(question, retrieval);

    return NextResponse.json({
      success: true,
      question,
      intent: retrieval.intent,
      decisionMode: retrieval.decisionMode,
      modeProfile: answer.modeProfile,
      occasionSignals: answer.occasionSignals,
      tradeoffs: answer.tradeoffs,
      answer: answer.answer,
      confidenceNote: answer.confidenceNote,
      citations: answer.citations,
      evidencePackets: answer.evidencePackets,
      groundedClaims: answer.groundedClaims,
      knownFromCellar: answer.knownFromCellar,
      inferredFromBrianFit: answer.inferredFromBrianFit,
      needsMoreSignal: answer.needsMoreSignal,
      nextSignals: answer.nextSignals,
      searchedRecords: retrieval.searchedRecords,
    });
  } catch (error) {
    console.error("Bottle Brain failed", error);
    return NextResponse.json({ success: false, error: "Bottle Brain could not answer right now." }, { status: 500 });
  }
}
