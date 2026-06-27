import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPortfolioRefreshRun } from "@/lib/portfolio-radar-refresh-runner";
import type { PortfolioRefreshPlan } from "@/lib/portfolio-radar-refresh";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = any;

const refreshReasons = [
  "missing_market_value",
  "missing_replacement_price",
  "stale_market_value",
  "stale_replacement_price",
  "high_value_watch",
  "readiness_transition",
  "unresolved_radar_action",
] as const;

const refreshSkipReasons = [
  "inactive_inventory",
  "review_pending",
  "cooldown_active",
  "ai_inferred_only",
  "fresh_enough",
  "no_actionable_gap",
  "budget_deferred",
] as const;

const metadataSchema = z.record(z.string(), z.unknown());

const queueItemSchema = z.object({
  id: z.string().min(1),
  inventoryId: z.string().min(1),
  label: z.string(),
  priority: z.number(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  scope: z.enum(["pricing", "replacement", "readiness", "deep"]),
  costTier: z.enum(["free", "low", "llm_search", "provider_ready"]),
  costUnits: z.number().nonnegative(),
  reasons: z.array(z.enum(refreshReasons)),
  expectedAction: z.enum(["refresh_pricing", "refresh_replacement", "refresh_readiness", "deep_refresh"]),
  nextRefreshAt: z.string(),
  cooldownUntil: z.string().nullable(),
  targetHref: z.string(),
  metadata: metadataSchema,
}).passthrough();

const skippedItemSchema = z.object({
  inventoryId: z.string().min(1),
  label: z.string(),
  skipReasons: z.array(z.enum(refreshSkipReasons)),
  candidateReasons: z.array(z.enum(refreshReasons)),
  priority: z.number(),
  cooldownUntil: z.string().nullable(),
}).passthrough();

const planSchema = z.object({
  asOf: z.string(),
  items: z.array(queueItemSchema),
  skipped: z.array(skippedItemSchema),
  summary: metadataSchema,
}).passthrough();

const requestSchema = z.object({
  mode: z.enum(["record_only"]).default("record_only"),
  maxItems: z.number().int().min(0).max(25).optional(),
  includeSkipped: z.boolean().default(true),
  maxSkipped: z.number().int().min(0).max(100).optional(),
  runId: z.string().min(1).max(160).optional(),
  plan: planSchema,
});

function db(supabase: SupabaseClient): SupabaseAnyClient {
  return supabase as unknown as SupabaseAnyClient;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const input = requestSchema.parse(await request.json().catch(() => ({})));
    const run = buildPortfolioRefreshRun({
      plan: input.plan as PortfolioRefreshPlan,
      mode: input.mode,
      maxItems: input.maxItems,
      includeSkipped: input.includeSkipped,
      maxSkipped: input.maxSkipped,
      runId: input.runId,
    });

    if (run.rows.length === 0) {
      return NextResponse.json({ success: true, run: run.summary, inserted: 0, records: [] });
    }

    const { data, error } = await db(auth.supabase)
      .from("wine_intelligence_refreshes")
      .insert(run.rows)
      .select("id,inventory_id,scope,status,started_at,completed_at");
    if (error) throw error;

    return NextResponse.json({
      success: true,
      run: run.summary,
      inserted: (data ?? []).length,
      records: data ?? [],
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      : error instanceof Error ? error.message : "Failed to record Portfolio Radar refresh run";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
