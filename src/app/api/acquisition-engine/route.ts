import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicApiKey } from "@/lib/anthropic-config";
import { countAnthropicWebSearchUses, emptyAnthropicTelemetry, estimateAnthropicCostUsd, pricingForAnthropicModel, type AnthropicRefreshTelemetry } from "@/lib/current-intelligence/anthropic-telemetry";
import { AI_WEB_SEARCH_DAILY_MAX_REQUESTS, AI_WEB_SEARCH_DAILY_WINDOW_MS, checkDurableRateLimit } from "@/lib/api-security";
import { createClient } from "@/lib/supabase/server";
import {
  buildAcquisitionEngine,
  buildAcquisitionSearchRecord,
  nextAcquisitionStatus,
  normalizeAcquisitionPriceCandidates,
  type AcquisitionAction,
  type AcquisitionPriceCandidate,
  type AcquisitionPriceObservation,
  type AcquisitionPriority,
  type AcquisitionSourceKind,
  type AcquisitionStatus,
  type AcquisitionTarget,
} from "@/lib/acquisition-engine";

const targetSchema = z.object({
  wineTitle: z.string().min(2).max(240),
  producer: z.string().max(160).nullable().optional(),
  vintage: z.number().int().min(1800).max(2200).nullable().optional(),
  region: z.string().max(160).nullable().optional(),
  varietal: z.string().max(120).nullable().optional(),
  wineReferenceId: z.string().uuid().nullable().optional(),
  inventoryId: z.string().uuid().nullable().optional(),
  sourceKind: z.enum(["buy_again", "wishlist", "shopping", "restaurant_discovery", "replenishment", "manual"]).default("manual"),
  sourceId: z.string().uuid().nullable().optional(),
  status: z.enum(["watching", "buy_now", "ordered", "acquired", "passed"]).default("watching"),
  priority: z.enum(["must_have", "high", "medium", "low"]).default("medium"),
  desiredQuantity: z.number().int().positive().default(1),
  targetPriceCents: z.number().int().nonnegative().nullable().optional(),
  maxPriceCents: z.number().int().nonnegative().nullable().optional(),
  nextRefreshAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["watch", "mark_buy_now", "mark_ordered", "mark_acquired", "pass", "reopen"]),
});

const priceSchema = z.object({
  targetId: z.string().uuid(),
  sourceType: z.enum(["manual", "cellartracker", "wine_market_journal", "retailer", "winery", "auction", "public_web", "ai_search", "ai_inferred", "wine_searcher_trial", "provider", "unknown"]).default("manual"),
  sourceName: z.string().max(200).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional().or(z.literal("")),
  observedPriceCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default("USD"),
  availability: z.enum(["available", "limited", "unknown", "sold_out"]).default("unknown"),
  confidence: z.number().int().min(0).max(100).default(70),
  observedAt: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const acquisitionCandidateSchema = z.object({
  title: z.string(),
  url: z.string().url().nullable().optional(),
  sourceType: z.enum(["manual", "cellartracker", "wine_market_journal", "retailer", "winery", "auction", "public_web", "ai_search", "ai_inferred", "wine_searcher_trial", "provider", "unknown"]).nullable().optional(),
  sourceName: z.string().nullable().optional(),
  extractedText: z.string().nullable().optional(),
  priceCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().nullable().optional(),
  availability: z.enum(["available", "limited", "unknown", "sold_out"]).nullable().optional(),
  confidence: z.number().int().min(0).max(100).nullable().optional(),
});

const refreshSchema = z.object({
  targetId: z.string().uuid(),
  force: z.boolean().default(false),
  candidates: z.array(acquisitionCandidateSchema).optional(),
});

async function currentUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

function targetFromDb(row: Record<string, unknown>): AcquisitionTarget {
  return {
    id: String(row.id),
    wineTitle: String(row.wine_title),
    producer: (row.producer as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? null,
    region: (row.region as string | null) ?? null,
    varietal: (row.varietal as string | null) ?? null,
    sourceKind: row.source_kind as AcquisitionSourceKind,
    sourceId: (row.source_id as string | null) ?? null,
    status: row.status as AcquisitionStatus,
    priority: row.priority as AcquisitionPriority,
    desiredQuantity: Number(row.desired_quantity ?? 1),
    targetPriceCents: (row.target_price_cents as number | null) ?? null,
    maxPriceCents: (row.max_price_cents as number | null) ?? null,
    nextRefreshAt: (row.next_refresh_at as string | null) ?? null,
    lastRefreshedAt: (row.last_refreshed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

function priceFromDb(row: Record<string, unknown>): AcquisitionPriceObservation {
  return {
    id: String(row.id),
    targetId: String(row.target_id),
    observedPriceCents: (row.observed_price_cents as number | null) ?? null,
    sourceType: (row.source_type as AcquisitionPriceObservation["sourceType"]) ?? null,
    sourceName: (row.source_name as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    availability: row.availability as AcquisitionPriceObservation["availability"],
    confidence: Number(row.confidence ?? 0),
    observedAt: String(row.observed_at),
  };
}

function targetToDb(input: z.infer<typeof targetSchema>, userId: string) {
  return {
    user_id: userId,
    wine_reference_id: input.wineReferenceId ?? null,
    inventory_id: input.inventoryId ?? null,
    source_kind: input.sourceKind,
    source_id: input.sourceId ?? null,
    status: input.status,
    priority: input.priority,
    wine_title: input.wineTitle,
    producer: input.producer ?? null,
    vintage: input.vintage ?? null,
    region: input.region ?? null,
    varietal: input.varietal ?? null,
    desired_quantity: input.desiredQuantity,
    target_price_cents: input.targetPriceCents ?? null,
    max_price_cents: input.maxPriceCents ?? null,
    next_refresh_at: input.nextRefreshAt ?? null,
    notes: input.notes ?? null,
  };
}

type AcquisitionSynthesis = {
  candidates: AcquisitionPriceCandidate[];
  telemetry: AnthropicRefreshTelemetry;
};

async function synthesizeAcquisitionPriceCandidates(target: AcquisitionTarget): Promise<AcquisitionSynthesis> {
  const apiKey = getAnthropicApiKey();
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";
  if (!apiKey) return { candidates: [], telemetry: emptyAnthropicTelemetry(false, model) };
  const anthropic = new Anthropic({ apiKey });
  const record = buildAcquisitionSearchRecord(target);
  const prompt = `You are Pourfolio's acquisition price analyst. Use web search when available. Return ONLY a JSON array, no markdown. Find current public replacement-price / availability evidence for this wine acquisition target. Do not invent prices. A price must have a cited retailer, winery, auction, or public source URL. Avoid protected/login-gated sources such as Vivino, CellarTracker, and Wine-Searcher unless the user supplied export/API evidence. Retailer/winery listings are replacement-price evidence, not verified market value. Include 1-4 concise objects with fields: title,url,sourceType,sourceName,extractedText,priceCents,currency,availability,confidence. Valid sourceType values: retailer, winery, auction, public_web, ai_inferred, provider, unknown. Valid availability: available, limited, unknown, sold_out. Target: ${JSON.stringify(record)}.`;
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
  let parsed: AcquisitionPriceCandidate[] = [];
  try {
    const candidatePayload = JSON.parse(jsonText);
    parsed = Array.isArray(candidatePayload) ? candidatePayload : [];
  } catch {
    parsed = [];
  }
  const usage = response.usage ?? null;
  return {
    candidates: parsed,
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

async function refreshAcquisitionTarget(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, input: z.infer<typeof refreshSchema>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data: targetRow, error: targetError } = await client
    .from("acquisition_watchlist")
    .select("*")
    .eq("id", input.targetId)
    .eq("user_id", userId)
    .single();
  if (targetError || !targetRow) return { response: NextResponse.json({ success: false, error: "Target not found" }, { status: 404 }) };
  const target = targetFromDb(targetRow);
  // Shared daily budget across web-search AI endpoints — the expensive spend
  // surface previously had no cap at all.
  const spendCap = await checkDurableRateLimit(supabase, userId, "ai-web-search", AI_WEB_SEARCH_DAILY_MAX_REQUESTS, AI_WEB_SEARCH_DAILY_WINDOW_MS);
  if (!spendCap.allowed) {
    return { response: NextResponse.json({ success: false, error: "Daily AI web-search budget reached. Try again tomorrow." }, { status: 429 }) };
  }
  const anthropic = await synthesizeAcquisitionPriceCandidates(target);
  const candidates = [...(input.candidates ?? []), ...anthropic.candidates];
  const normalized = normalizeAcquisitionPriceCandidates(candidates);
  const insertedRows: Record<string, unknown>[] = [];

  for (const observation of normalized.observations) {
    const { data, error } = await client.from("acquisition_price_observations").insert({
      target_id: input.targetId,
      source_type: observation.sourceType,
      source_name: observation.sourceName,
      source_url: observation.sourceUrl,
      observed_price_cents: observation.observedPriceCents,
      currency: observation.currency,
      availability: observation.availability,
      confidence: observation.confidence,
      observed_at: new Date().toISOString(),
      notes: observation.notes,
      raw_payload: observation.rawPayload,
    }).select().single();
    if (error) throw error;
    insertedRows.push(data);
  }

  const observations = insertedRows.map(priceFromDb);
  const usable = observations.find((observation) => observation.observedPriceCents != null) ?? observations[0] ?? null;
  const now = new Date();
  const nextRefresh = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const update: Record<string, unknown> = {
    last_refreshed_at: now.toISOString(),
    next_refresh_at: nextRefresh,
  };
  if (usable) update.best_price_observation_id = usable.id;
  await client.from("acquisition_watchlist").update(update).eq("id", input.targetId).eq("user_id", userId);

  const providerStatus = { anthropicConfigured: Boolean(getAnthropicApiKey()), paidPricingProvider: false, anthropic: anthropic.telemetry };
  const gaps = [...normalized.gaps];
  if (!getAnthropicApiKey()) gaps.push("AI search is unavailable because ANTHROPIC_API_KEY is missing or placeholder in this runtime.");
  return { target, observations, gaps, providerStatus, nextRefreshAt: nextRefresh };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data: targetRows, error: targetError } = await client
      .from("acquisition_watchlist")
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (targetError) throw targetError;
    const targetIds = ((targetRows ?? []) as Record<string, unknown>[]).map((row) => String(row.id));
    let priceRows: Record<string, unknown>[] = [];
    if (targetIds.length) {
      const { data, error } = await client
        .from("acquisition_price_observations")
        .select("*")
        .in("target_id", targetIds)
        .order("observed_at", { ascending: false });
      if (error) throw error;
      priceRows = data ?? [];
    }
    const targets = ((targetRows ?? []) as Record<string, unknown>[]).map(targetFromDb);
    const priceObservations = priceRows.map(priceFromDb);
    return NextResponse.json({ success: true, targets, priceObservations, engine: buildAcquisitionEngine({ targets, priceObservations }) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load acquisition engine" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const url = new URL(request.url);
    if (url.searchParams.get("kind") === "refresh") {
      const input = refreshSchema.parse(await request.json());
      const result = await refreshAcquisitionTarget(supabase, user.id, input);
      if ("response" in result) return result.response;
      return NextResponse.json({ success: true, ...result });
    }
    if (url.searchParams.get("kind") === "price") {
      const input = priceSchema.parse(await request.json());
      const { data: target } = await client.from("acquisition_watchlist").select("id,user_id").eq("id", input.targetId).eq("user_id", user.id).single();
      if (!target) return NextResponse.json({ success: false, error: "Target not found" }, { status: 404 });
      const { data, error } = await client.from("acquisition_price_observations").insert({
        target_id: input.targetId,
        source_type: input.sourceType,
        source_name: input.sourceName ?? null,
        source_url: input.sourceUrl || null,
        observed_price_cents: input.observedPriceCents,
        currency: input.currency,
        availability: input.availability,
        confidence: input.confidence,
        observed_at: input.observedAt ?? new Date().toISOString(),
        notes: input.notes ?? null,
      }).select().single();
      if (error) throw error;
      await client.from("acquisition_watchlist").update({ last_refreshed_at: new Date().toISOString(), best_price_observation_id: data.id }).eq("id", input.targetId).eq("user_id", user.id);
      return NextResponse.json({ success: true, observation: priceFromDb(data) });
    }
    const input = targetSchema.parse(await request.json());
    const row = targetToDb(input, user.id);
    let existingTargetId: string | null = null;
    if (input.sourceId) {
      const { data: existing, error: existingError } = await client
        .from("acquisition_watchlist")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_kind", input.sourceKind)
        .eq("source_id", input.sourceId)
        .maybeSingle();
      if (existingError) throw existingError;
      existingTargetId = existing?.id ? String(existing.id) : null;
    }
    const query = existingTargetId
      ? client
        .from("acquisition_watchlist")
        .update(row)
        .eq("id", existingTargetId)
        .eq("user_id", user.id)
      : client
        .from("acquisition_watchlist")
        .insert(row);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, target: targetFromDb(data), replayed: Boolean(existingTargetId) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to save acquisition target" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = patchSchema.parse(await request.json());
    const supabase = await createClient();
    const user = await currentUser(supabase);
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any).from("acquisition_watchlist").select("id,status").eq("id", input.id).eq("user_id", user.id).single();
    if (!existing) return NextResponse.json({ success: false, error: "Target not found" }, { status: 404 });
    const status = nextAcquisitionStatus(existing.status as AcquisitionStatus, input.action as AcquisitionAction);
    const stamp = new Date().toISOString();
    const updates: Record<string, unknown> = { status };
    if (status === "ordered") updates.ordered_at = stamp;
    if (status === "acquired") updates.acquired_at = stamp;
    if (status === "passed") updates.passed_at = stamp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from("acquisition_watchlist").update(updates).eq("id", input.id).eq("user_id", user.id).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, target: targetFromDb(data) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to update acquisition target" }, { status: 400 });
  }
}
