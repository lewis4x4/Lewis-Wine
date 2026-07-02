import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_WEB_SEARCH_DAILY_MAX_REQUESTS, AI_WEB_SEARCH_DAILY_WINDOW_MS, checkDurableRateLimit } from "@/lib/api-security";
import { getAnthropicApiKey } from "@/lib/anthropic-config";
import { createClient } from "@/lib/supabase/server";
import {
  countAnthropicWebSearchUses,
  emptyAnthropicTelemetry,
  estimateAnthropicCostUsd,
  pricingForAnthropicModel,
  type AnthropicRefreshTelemetry,
} from "@/lib/current-intelligence/anthropic-telemetry";
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

type AnthropicSynthesis = {
  candidates: AiEvidenceCandidate[];
  telemetry: AnthropicRefreshTelemetry;
};

async function synthesizeWithAnthropic(record: BottleSearchRecord, scope: RefreshScope): Promise<AnthropicSynthesis> {
  const apiKey = getAnthropicApiKey();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  if (!apiKey) return { candidates: [], telemetry: emptyAnthropicTelemetry(false, model) };
  const anthropic = new Anthropic({ apiKey });
  const prompt = `You are Pourfolio's wine intelligence analyst. Use web search when available. Return ONLY JSON array, no markdown. Do not invent prices. If a price is found on a retailer/winery page, include it as replacement-price evidence only. If a source describes producer facts, vintage notes, drink window, or serving guidance without price, still return it as evidence with no priceCents. If you cannot cite a public source URL, mark sourceType ai_inferred and omit priceCents unless the user supplied evidence. Scope: ${scope}. Wine record: ${JSON.stringify(record)}. Desired object fields: title,url,sourceType,extractedText,priceCents,currency,vintage,bottleSizeMl,confidence. Valid sourceType values: retailer, winery, auction, public_web, ai_inferred, provider, unknown. Avoid protected/login-gated sources such as Vivino, CellarTracker, and Wine-Searcher unless the user provided export/API evidence. Prefer 2-4 concise, source-backed findings.`;
  const baseRequest = {
    model,
    max_tokens: 1800,
    temperature: 0,
    messages: [{ role: "user" as const, content: prompt }],
  };
  let response;
  let fallbackWithoutWebSearch = false;
  try {
    response = await anthropic.messages.create({
      ...baseRequest,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }] as any,
    });
  } catch {
    fallbackWithoutWebSearch = true;
    response = await anthropic.messages.create(baseRequest);
  }
  const text = response.content.map((part) => part.type === "text" ? part.text : "").join("\n").trim();
  const jsonText = text.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
  const parsed = JSON.parse(jsonText) as AiEvidenceCandidate[];
  const usage = response.usage ?? null;
  return {
    candidates: Array.isArray(parsed) ? parsed : [],
    telemetry: {
      provider: "anthropic",
      configured: true,
      attempted: true,
      model,
      webSearchEnabled: !fallbackWithoutWebSearch,
      webSearchUses: countAnthropicWebSearchUses(response.content, usage),
      fallbackWithoutWebSearch,
      usage,
      estimatedCostUsd: estimateAnthropicCostUsd(model, usage),
      pricing: pricingForAnthropicModel(model),
    },
  };
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

    // Shared daily budget across web-search AI endpoints — the expensive
    // spend surface previously had no cap at all.
    const spendCap = await checkDurableRateLimit(supabase, user.id, "ai-web-search", AI_WEB_SEARCH_DAILY_MAX_REQUESTS, AI_WEB_SEARCH_DAILY_WINDOW_MS);
    if (!spendCap.allowed) {
      return NextResponse.json({ success: false, error: "Daily AI web-search budget reached. Try again tomorrow." }, { status: 429 });
    }

    const anthropic = await synthesizeWithAnthropic(wine as BottleSearchRecord, input.scope);
    const candidates = [...(input.candidates ?? []), ...anthropic.candidates];
    const normalized = normalizeAiEvidenceCandidates(candidates, plan);
    const gaps = [...normalized.gaps];
    const anthropicConfigured = Boolean(getAnthropicApiKey());
    if (!anthropicConfigured) gaps.push("AI search is unavailable because ANTHROPIC_API_KEY is missing or still set to a placeholder in this runtime.");
    if (candidates.length === 0) gaps.push("No source-backed current info was found; manual evidence or CellarTracker import is recommended.");

    const providerStatus = { anthropicConfigured, paidPricingProvider: false, anthropic: anthropic.telemetry };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("wine_intelligence_refreshes").insert({
      inventory_id: id,
      scope: input.scope,
      status: "completed",
      plan,
      provider_status: providerStatus,
      gaps,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, plan, evidence: normalized.evidence, observations: normalized.observations, gaps, providerStatus });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to refresh intelligence" }, { status: 400 });
  }
}
