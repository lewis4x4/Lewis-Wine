import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { PriceObservation } from "@/lib/current-intelligence/price-observations";
import { isPriceObservationStale } from "@/lib/current-intelligence/price-observations";
import { buildReadinessInputWithDrinkWindowEvidence, type DrinkWindowObservation } from "@/lib/drink-window-evidence";
import { drinkWindowObservationFromDb, isMissingDrinkWindowObservationTable } from "@/lib/drink-window-observation-records";
import { buildPortfolioRefreshQueue, type PortfolioRefreshCellarItem, type PortfolioRefreshRecord } from "@/lib/portfolio-radar-refresh";
import { buildPortfolioRefreshRun } from "@/lib/portfolio-radar-refresh-runner";
import { buildPortfolioRefreshScheduleSummary, type PortfolioRefreshScheduleHistoryRow } from "@/lib/portfolio-radar-refresh-schedule";
import { getWineReadinessProfile } from "@/lib/wine-readiness";

export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;
// Supabase generated types do not include these newly added intelligence tables yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = { from: (table: string) => any };

const MAX_SKIPPED_LEDGER_ROWS = 50;
const HISTORY_LIMIT = 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function expectedSecret() {
  return process.env.POURFOLIO_CRON_SECRET?.trim() ?? "";
}

function bearerSecret(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
}

function requireCronSecret(request: Request) {
  const configured = expectedSecret();
  if (!configured) return { ok: false as const, response: NextResponse.json({ success: false, error: "Scheduled refresh is not configured" }, { status: 503 }) };
  if (bearerSecret(request) !== configured) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const };
}

function createAdminClient(): SupabaseAdminClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Scheduled refresh needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY configured.");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireOwnerId() {
  const ownerId = process.env.POURFOLIO_REFRESH_OWNER_ID?.trim();
  if (!ownerId) throw new Error("Scheduled refresh needs POURFOLIO_REFRESH_OWNER_ID configured.");
  return ownerId;
}

function relation(row: DbRow, key: string): DbRow | null {
  const value = row[key];
  if (Array.isArray(value)) return (value[0] as DbRow | undefined) ?? null;
  return (value as DbRow | null | undefined) ?? null;
}

function relationList(row: DbRow, key: string): DbRow[] {
  const value = row[key];
  return Array.isArray(value) ? value as DbRow[] : [];
}

function titleFromInventory(row: DbRow) {
  const reference = relation(row, "wine_reference");
  const name = (reference?.name as string | undefined) ?? (row.custom_name as string | undefined) ?? "Unknown wine";
  const vintage = (row.vintage as number | null) ?? (row.custom_vintage as number | null) ?? null;
  return vintage && !String(name).includes(String(vintage)) ? `${vintage} ${name}` : name;
}

function priceObservationFromDb(row: DbRow, fallbackInventoryId?: string, fallbackReferenceId?: string | null): PriceObservation {
  return {
    id: String(row.id),
    inventoryId: String(row.inventory_id ?? fallbackInventoryId ?? ""),
    wineReferenceId: (row.wine_reference_id as string | null) ?? fallbackReferenceId ?? null,
    sourceType: (row.source_type as PriceObservation["sourceType"]) ?? "unknown",
    sourceName: (row.source_name as string | null) ?? null,
    sourceUrl: (row.source_url as string | null) ?? null,
    observationKind: (row.observation_kind as PriceObservation["observationKind"]) ?? "estimate",
    truthLabel: (row.truth_label as PriceObservation["truthLabel"]) ?? "unknown",
    reviewStatus: (row.review_status as PriceObservation["reviewStatus"]) ?? "draft",
    observedPriceCents: (row.observed_price_cents as number | null) ?? null,
    currency: (row.currency as string | null) ?? "USD",
    bottleSizeMl: (row.bottle_size_ml as number | null) ?? null,
    vintage: (row.vintage as number | null) ?? null,
    confidence: Number(row.confidence ?? 0),
    observedAt: String(row.observed_at ?? row.created_at ?? new Date(0).toISOString()),
    notes: (row.notes as string | null) ?? null,
    rawPayload: row.raw_payload ?? null,
  };
}

function cellarItemFromDb(row: DbRow, drinkWindowObservations: DrinkWindowObservation[], asOf: string): PortfolioRefreshCellarItem {
  const reference = relation(row, "wine_reference");
  const priceObservations = relationList(row, "wine_price_observations").map((observation) =>
    priceObservationFromDb(observation, String(row.id), (row.wine_reference_id as string | null) ?? null)
  );
  const accepted = priceObservations.filter((observation) => observation.reviewStatus === "accepted");
  const readinessInput = buildReadinessInputWithDrinkWindowEvidence({
    drink_after: (row.drink_after as string | null) ?? null,
    drink_before: (row.drink_before as string | null) ?? null,
    wine_reference_drink_window_start: reference?.drink_window_start != null ? String(reference.drink_window_start) : null,
    wine_reference_drink_window_end: reference?.drink_window_end != null ? String(reference.drink_window_end) : null,
  }, drinkWindowObservations, { asOf });
  const readiness = getWineReadinessProfile(readinessInput.wine, { asOf: new Date(asOf) });

  return {
    id: String(row.id),
    displayName: titleFromInventory(row),
    quantity: Number(row.quantity ?? 0),
    purchasePriceCents: (row.purchase_price_cents as number | null) ?? null,
    currentMarketValueCents: (row.current_market_value_cents as number | null) ?? null,
    marketValueSource: (row.market_value_source as string | null) ?? null,
    marketValueUpdatedAt: (row.market_value_updated_at as string | null) ?? null,
    drinkAfter: readiness.normalizedDrinkAfter ?? ((row.drink_after as string | null) ?? null),
    drinkBefore: readiness.normalizedDrinkBefore ?? ((row.drink_before as string | null) ?? null),
    readinessPhase: readiness.phase,
    readinessConfidence: readiness.confidence,
    acceptedPriceEvidenceCount: accepted.length,
    stalePriceEvidenceCount: accepted.filter((observation) => isPriceObservationStale(observation, asOf)).length,
    evidenceAwaitingReviewCount: priceObservations.filter((observation) => observation.reviewStatus === "draft").length,
    brianFitScore: null,
  };
}

function refreshRecordFromDb(row: DbRow): PortfolioRefreshRecord {
  return {
    id: String(row.id),
    inventoryId: String(row.inventory_id),
    scope: String(row.scope ?? "quick"),
    status: String(row.status ?? "completed"),
    startedAt: String(row.started_at ?? row.created_at ?? new Date(0).toISOString()),
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

function labelFromRefreshPlan(row: DbRow) {
  const plan = row.plan as { queueItem?: { label?: string }; skippedItem?: { label?: string } } | null | undefined;
  return plan?.queueItem?.label ?? plan?.skippedItem?.label ?? null;
}

function historyRowFromDb(row: DbRow): PortfolioRefreshScheduleHistoryRow {
  const inventory = relation(row, "cellar_inventory");
  return {
    inventoryId: String(row.inventory_id),
    label: labelFromRefreshPlan(row) ?? (inventory ? titleFromInventory(inventory) : null),
    scope: String(row.scope ?? "quick"),
    status: String(row.status ?? "planned"),
    startedAt: String(row.started_at ?? row.created_at ?? new Date(0).toISOString()),
    completedAt: (row.completed_at as string | null) ?? null,
    gaps: Array.isArray(row.gaps) ? row.gaps.map(String) : [],
  };
}

async function loadOwnedCellarIds(client: SupabaseAdminClient, ownerId: string) {
  const { data, error } = await client
    .from("cellars")
    .select("id")
    .eq("owner_id", ownerId);
  if (error) throw error;
  return ((data ?? []) as DbRow[]).map((row) => String(row.id));
}

async function loadInventoryRows(client: SupabaseAdminClient, cellarIds: string[]) {
  if (cellarIds.length === 0) return [] as DbRow[];
  const { data, error } = await client
    .from("cellar_inventory")
    .select(`
      id,cellar_id,wine_reference_id,custom_name,custom_vintage,vintage,quantity,purchase_price_cents,drink_after,drink_before,status,current_market_value_cents,market_value_source,market_value_updated_at,
      wine_reference(name,drink_window_start,drink_window_end),
      wine_price_observations(id,inventory_id,wine_reference_id,source_type,source_name,source_url,observation_kind,truth_label,review_status,observed_price_cents,currency,bottle_size_ml,vintage,confidence,observed_at,notes,raw_payload)
    `)
    .in("cellar_id", cellarIds)
    .eq("status", "in_cellar")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbRow[];
}

async function loadDrinkWindowObservations(client: SupabaseAdminClient, ownerId: string, inventoryIds: string[]) {
  const byInventory = new Map<string, DrinkWindowObservation[]>();
  if (inventoryIds.length === 0) return byInventory;

  const { data, error } = await client
    .from("wine_drink_window_observations")
    .select("*")
    .eq("owner_id", ownerId)
    .in("inventory_id", inventoryIds)
    .order("observed_at", { ascending: false });

  if (error) {
    if (isMissingDrinkWindowObservationTable(error)) return byInventory;
    throw error;
  }

  for (const row of (data ?? []) as DbRow[]) {
    const observation = drinkWindowObservationFromDb(row);
    const current = byInventory.get(observation.inventoryId) ?? [];
    current.push(observation);
    byInventory.set(observation.inventoryId, current);
  }
  return byInventory;
}

async function loadRefreshRecords(client: SupabaseAdminClient, inventoryIds: string[]) {
  if (inventoryIds.length === 0) return [] as PortfolioRefreshRecord[];
  const { data, error } = await client
    .from("wine_intelligence_refreshes")
    .select("id,inventory_id,scope,status,started_at,completed_at")
    .in("inventory_id", inventoryIds)
    .order("started_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as DbRow[]).map(refreshRecordFromDb);
}

async function loadRecentHistory(client: SupabaseAdminClient, inventoryIds: string[], asOf: string) {
  if (inventoryIds.length === 0) return [] as PortfolioRefreshScheduleHistoryRow[];
  const since = new Date(new Date(asOf).getTime() - WEEK_MS).toISOString();
  const { data, error } = await client
    .from("wine_intelligence_refreshes")
    .select("id,inventory_id,scope,status,started_at,completed_at,gaps,plan,cellar_inventory(custom_name,custom_vintage,vintage,wine_reference(name))")
    .in("inventory_id", inventoryIds)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return ((data ?? []) as DbRow[]).map(historyRowFromDb);
}

async function runAlreadyRecorded(client: SupabaseAdminClient, runId: string) {
  const { data, error } = await client
    .from("wine_intelligence_refreshes")
    .select("id")
    .eq("provider_status->>runId", runId)
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

function scheduledRunId(asOf: string) {
  return `portfolio-radar-scheduled:${asOf.slice(0, 10)}`;
}

export async function POST(request: Request) {
  const cron = requireCronSecret(request);
  if (!cron.ok) return cron.response;

  try {
    const client = createAdminClient();
    const ownerId = requireOwnerId();
    const asOf = new Date().toISOString();
    const runId = scheduledRunId(asOf);
    const cellarIds = await loadOwnedCellarIds(client, ownerId);
    const inventoryRows = await loadInventoryRows(client, cellarIds);
    const inventoryIds = inventoryRows.map((row) => String(row.id));
    const drinkWindowObservations = await loadDrinkWindowObservations(client, ownerId, inventoryIds);
    const cellar = inventoryRows.map((row) => cellarItemFromDb(row, drinkWindowObservations.get(String(row.id)) ?? [], asOf));
    const priceObservations = inventoryRows.flatMap((row) => relationList(row, "wine_price_observations").map((observation) =>
      priceObservationFromDb(observation, String(row.id), (row.wine_reference_id as string | null) ?? null)
    ));
    const refreshes = await loadRefreshRecords(client, inventoryIds);
    const plan = buildPortfolioRefreshQueue({ asOf, cellar, priceObservations, refreshes });
    const run = buildPortfolioRefreshRun({ plan, asOf, runId, includeSkipped: true, maxSkipped: MAX_SKIPPED_LEDGER_ROWS });
    const alreadyRecorded = await runAlreadyRecorded(client, runId);

    let inserted = 0;
    if (!alreadyRecorded && run.rows.length > 0) {
      const { data, error } = await client
        .from("wine_intelligence_refreshes")
        .insert(run.rows)
        .select("id");
      if (error) throw error;
      inserted = (data ?? []).length;
    }

    const history = await loadRecentHistory(client, inventoryIds, asOf);
    const dailySummary = buildPortfolioRefreshScheduleSummary({ asOf, window: "daily", run, recentHistory: history });
    const weeklySummary = buildPortfolioRefreshScheduleSummary({ asOf, window: "weekly", run, recentHistory: history });

    return NextResponse.json({
      success: true,
      scheduled: true,
      idempotent: alreadyRecorded,
      inserted,
      run: run.summary,
      plan: {
        summary: plan.summary,
        due: plan.items.slice(0, 10),
        skipped: plan.skipped.slice(0, 10),
      },
      dailySummary,
      weeklySummary,
      sourceSummary: {
        ownerIdConfigured: true,
        cellarCount: cellarIds.length,
        inventoryCount: cellar.length,
        priceEvidence: priceObservations.length,
        refreshHistory: refreshes.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled Portfolio Radar refresh failed";
    return jsonError(message, 500);
  }
}
