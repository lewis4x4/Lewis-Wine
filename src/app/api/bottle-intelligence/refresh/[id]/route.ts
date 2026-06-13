import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  buildRefreshPlan,
  normalizeAiEvidenceCandidates,
  type AiEvidenceCandidate,
  type BottleSearchRecord,
  type RefreshScope,
} from "@/lib/current-intelligence";

const requestSchema = z.object({
  scope: z.enum(["quick", "pricing", "readiness", "deep", "replacement"]).default("quick"),
  force: z.boolean().default(false),
  candidates: z.array(z.object({
    title: z.string(),
    url: z.string().url().nullable().optional(),
    sourceType: z.enum(["manual", "cellartracker", "wine_market_journal", "retailer", "winery", "auction", "public_web", "ai_search", "ai_inferred", "wine_searcher_trial", "provider", "unknown"]),
    extractedText: z.string(),
    priceCents: z.number().int().nonnegative().nullable().optional(),
    currency: z.string().nullable().optional(),
    vintage: z.number().int().nullable().optional(),
    bottleSizeMl: z.number().int().nullable().optional(),
    confidence: z.number().int().min(0).max(100),
  })).optional(),
});

async function synthesizeWithAnthropic(record: BottleSearchRecord, scope: RefreshScope): Promise<AiEvidenceCandidate[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `You are Pourfolio's wine intelligence analyst. Return ONLY JSON array. Do not invent prices. If you cannot cite a public source URL, mark sourceType ai_inferred and omit priceCents unless the user supplied evidence. Scope: ${scope}. Wine record: ${JSON.stringify(record)}. Desired object fields: title,url,sourceType,extractedText,priceCents,currency,vintage,bottleSizeMl,confidence. Retail listings are replacement price, not market value. Prefer winery/producer facts and public retailer replacement signals. If no current source is available, return [].`;
  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    max_tokens: 1200,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.map((part) => part.type === "text" ? part.text : "").join("\n").trim();
  const jsonText = text.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  const parsed = JSON.parse(jsonText) as AiEvidenceCandidate[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = requestSchema.parse(await request.json().catch(() => ({})));
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wine, error } = await (supabase as any)
      .from("cellar_inventory")
      .select("*, wine_reference (*)")
      .eq("id", id)
      .single();
    if (error || !wine) return NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cellar } = await (supabase as any).from("cellars").select("owner_id").eq("id", wine.cellar_id).single();
    if (!cellar || cellar.owner_id !== user.id) return NextResponse.json({ success: false, error: "Bottle not found" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRows } = await (supabase as any)
      .from("wine_price_observations")
      .select("observation_kind, observed_at, review_status")
      .eq("inventory_id", id)
      .order("observed_at", { ascending: false });

    const existing = (existingRows ?? []).map((row: Record<string, unknown>) => ({
      kind: row.observation_kind as "replacement_price" | "market_value",
      observedAt: String(row.observed_at),
      reviewStatus: row.review_status as "accepted" | "draft" | "rejected" | "superseded",
    }));
    const plan = buildRefreshPlan(wine as BottleSearchRecord, input.scope, existing, new Date().toISOString());
    if (plan.skipReason && !input.force) {
      return NextResponse.json({ success: true, skipped: true, plan, gaps: [plan.skipReason], evidence: [], observations: [] });
    }

    const candidates = [...(input.candidates ?? []), ...(await synthesizeWithAnthropic(wine as BottleSearchRecord, input.scope))];
    const normalized = normalizeAiEvidenceCandidates(candidates, plan);
    const gaps = [...normalized.gaps];
    if (!process.env.ANTHROPIC_API_KEY) gaps.push("AI search is unavailable because ANTHROPIC_API_KEY is not configured in this runtime.");
    if (candidates.length === 0) gaps.push("No source-backed current info was found; manual evidence or CellarTracker import is recommended.");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("wine_intelligence_refreshes").insert({
      inventory_id: id,
      scope: input.scope,
      status: "completed",
      plan,
      provider_status: { anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY), paidPricingProvider: false },
      gaps,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, plan, evidence: normalized.evidence, observations: normalized.observations, gaps });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to refresh intelligence" }, { status: 400 });
  }
}
