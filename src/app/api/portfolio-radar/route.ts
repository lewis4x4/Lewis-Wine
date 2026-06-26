import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAcquisitionEngine, type AcquisitionPriceObservation, type AcquisitionPriority, type AcquisitionSourceKind, type AcquisitionStatus, type AcquisitionTarget } from "@/lib/acquisition-engine";
import type { PriceObservation } from "@/lib/current-intelligence/price-observations";
import { isPriceObservationStale } from "@/lib/current-intelligence/price-observations";
import { buildPortfolioRadar, type PortfolioRadarCellarItem } from "@/lib/portfolio-radar";
import { buildReplenishmentAutomation, type ExistingAcquisitionTargetSignal, type ReplenishmentAcquiredSignal, type ReplenishmentAutomationInput, type ReplenishmentInventorySignal, type ReplenishmentRatingSignal, type ReplenishmentTastingSignal } from "@/lib/replenishment-automation";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAnyClient = any;
type DbRow = Record<string, unknown>;

function db(supabase: SupabaseClient): SupabaseAnyClient {
  return supabase as unknown as SupabaseAnyClient;
}

async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, supabase, user };
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

function cellarItemFromDb(row: DbRow): PortfolioRadarCellarItem {
  const reference = relation(row, "wine_reference");
  const observations = relationList(row, "wine_price_observations").map((observation) => priceObservationFromDb(observation, String(row.id), (row.wine_reference_id as string | null) ?? null));
  const accepted = observations.filter((observation) => observation.reviewStatus === "accepted");
  const ratings = relationList(row, "ratings");
  return {
    id: String(row.id),
    wine_reference_id: (row.wine_reference_id as string | null) ?? null,
    name: (reference?.name as string | null) ?? null,
    custom_name: (row.custom_name as string | null) ?? null,
    producer: (reference?.producer as string | null) ?? null,
    custom_producer: (row.custom_producer as string | null) ?? null,
    region: (reference?.region as string | null) ?? null,
    custom_region: (row.custom_region as string | null) ?? null,
    wine_type: (reference?.wine_type as string | null) ?? null,
    custom_wine_type: (row.custom_wine_type as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? null,
    custom_vintage: (row.custom_vintage as number | null) ?? null,
    quantity: Number(row.quantity ?? 0),
    drink_after: (row.drink_after as string | null) ?? null,
    drink_before: (row.drink_before as string | null) ?? null,
    purchase_price_cents: (row.purchase_price_cents as number | null) ?? null,
    current_market_value_cents: (row.current_market_value_cents as number | null) ?? null,
    market_value_source: (row.market_value_source as string | null) ?? null,
    market_value_updated_at: (row.market_value_updated_at as string | null) ?? null,
    low_stock_threshold: (row.low_stock_threshold as number | null) ?? null,
    low_stock_alert_enabled: Boolean(row.low_stock_alert_enabled),
    ratings_count: ratings.length,
    rating_signal_count: ratings.reduce((count, rating) => count + relationList(rating, "rating_signals").length, 0),
    brian_fit_score: null,
    brian_fit_confidence: null,
    tags: (row.tags as string[] | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    accepted_price_evidence_count: accepted.length,
    stale_price_evidence_count: accepted.filter((observation) => isPriceObservationStale(observation)).length,
    evidence_awaiting_review_count: observations.filter((observation) => observation.reviewStatus === "draft").length,
  };
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

function targetFromDb(row: DbRow): AcquisitionTarget {
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

function acquisitionPriceFromDb(row: DbRow): AcquisitionPriceObservation {
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

function replenishmentInventoryFromCellar(row: DbRow): ReplenishmentInventorySignal {
  const reference = relation(row, "wine_reference");
  return {
    id: String(row.id),
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    wineTitle: titleFromInventory(row),
    producer: (reference?.producer as string | null) ?? (row.custom_producer as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? (row.custom_vintage as number | null) ?? null,
    region: (reference?.region as string | null) ?? (row.custom_region as string | null) ?? null,
    varietal: Array.isArray(reference?.grape_varieties) ? String((reference?.grape_varieties as unknown[])[0] ?? "") : null,
    quantity: Number(row.quantity ?? 0),
    lowStockThreshold: (row.low_stock_threshold as number | null) ?? null,
    lowStockAlertEnabled: Boolean(row.low_stock_alert_enabled),
    status: row.status as ReplenishmentInventorySignal["status"],
    consumedDate: (row.consumed_date as string | null) ?? null,
    purchasePriceCents: (row.purchase_price_cents as number | null) ?? null,
    purchaseLocation: (row.purchase_location as string | null) ?? null,
  };
}

function replenishmentRatingFromDb(row: DbRow): ReplenishmentRatingSignal {
  return {
    id: String(row.id),
    inventoryId: (row.inventory_id as string | null) ?? null,
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    score: Number(row.score ?? 0),
    tastingDate: (row.tasting_date as string | null) ?? null,
    notes: (row.tasting_notes as string | null) ?? null,
  };
}

function replenishmentTastingFromDb(row: DbRow): ReplenishmentTastingSignal {
  const wine = relation(row, "wines");
  const vintage = (wine?.vintage as number | null) ?? null;
  const label = String(wine?.label ?? "Unknown wine");
  return {
    id: String(row.id),
    wineReferenceId: null,
    wineTitle: vintage && !label.includes(String(vintage)) ? `${vintage} ${label}` : label,
    producer: (wine?.producer as string | null) ?? null,
    vintage,
    region: (wine?.region as string | null) ?? null,
    varietal: (wine?.varietal as string | null) ?? null,
    score: (row.score as number | null) ?? null,
    buyAgain: (row.buy_again as ReplenishmentTastingSignal["buyAgain"]) ?? null,
    tastedAt: (row.tasted_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

function acquiredTargetFromDb(row: DbRow): ReplenishmentAcquiredSignal {
  return {
    id: String(row.id),
    inventoryId: (row.inventory_id as string | null) ?? null,
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    wineTitle: String(row.wine_title),
    producer: (row.producer as string | null) ?? null,
    vintage: (row.vintage as number | null) ?? null,
    region: (row.region as string | null) ?? null,
    varietal: (row.varietal as string | null) ?? null,
    acquiredQuantity: (row.acquired_quantity as number | null) ?? null,
    acquiredPriceCents: (row.acquired_price_cents as number | null) ?? null,
    acquiredAt: (row.acquired_at as string | null) ?? null,
  };
}

function existingTargetFromDb(row: DbRow): ExistingAcquisitionTargetSignal {
  return {
    id: String(row.id),
    inventoryId: (row.inventory_id as string | null) ?? null,
    wineReferenceId: (row.wine_reference_id as string | null) ?? null,
    status: row.status as ExistingAcquisitionTargetSignal["status"],
  };
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const client = db(auth.supabase);
    const asOf = new Date().toISOString();

    const { data: cellarRows, error: cellarError } = await client
      .from("cellars")
      .select("id")
      .eq("owner_id", auth.user.id);
    if (cellarError) throw cellarError;
    const cellarIds = ((cellarRows ?? []) as DbRow[]).map((row) => String(row.id));

    let inventoryRows: DbRow[] = [];
    if (cellarIds.length) {
      const { data, error } = await client
        .from("cellar_inventory")
        .select(`
          id,cellar_id,wine_reference_id,custom_name,custom_producer,custom_vintage,custom_region,custom_wine_type,vintage,quantity,purchase_price_cents,purchase_location,drink_after,drink_before,status,consumed_date,current_market_value_cents,market_value_source,market_value_updated_at,low_stock_threshold,low_stock_alert_enabled,tags,created_at,
          wine_reference(name,producer,region,wine_type,grape_varieties),
          ratings(id,inventory_id,wine_reference_id,score,tasting_date,tasting_notes,rating_signals(id)),
          wine_price_observations(id,inventory_id,wine_reference_id,source_type,source_name,source_url,observation_kind,truth_label,review_status,observed_price_cents,currency,bottle_size_ml,vintage,confidence,observed_at,notes,raw_payload)
        `)
        .in("cellar_id", cellarIds)
        .eq("status", "in_cellar")
        .order("created_at", { ascending: false });
      if (error) throw error;
      inventoryRows = (data ?? []) as DbRow[];
    }

    const cellar = inventoryRows.map(cellarItemFromDb);
    const priceObservations = inventoryRows.flatMap((row) => relationList(row, "wine_price_observations").map((observation) => priceObservationFromDb(observation, String(row.id), (row.wine_reference_id as string | null) ?? null)));

    const { data: targetRows, error: targetError } = await client
      .from("acquisition_watchlist")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (targetError) throw targetError;
    const targets = ((targetRows ?? []) as DbRow[]).map(targetFromDb);
    const targetIds = targets.map((target) => target.id);

    let acquisitionPriceRows: DbRow[] = [];
    if (targetIds.length) {
      const { data, error } = await client
        .from("acquisition_price_observations")
        .select("*")
        .in("target_id", targetIds)
        .order("observed_at", { ascending: false });
      if (error) throw error;
      acquisitionPriceRows = (data ?? []) as DbRow[];
    }
    const acquisitionPriceObservations = acquisitionPriceRows.map(acquisitionPriceFromDb);
    const acquisitionEngine = buildAcquisitionEngine({ targets, priceObservations: acquisitionPriceObservations, asOf });

    const ratings = inventoryRows.flatMap((row) => relationList(row, "ratings").map(replenishmentRatingFromDb));
    const { data: tastingRows, error: tastingError } = await client
      .from("tastings")
      .select("id,score,buy_again,tasted_at,notes,wines(producer,label,vintage,region,varietal)")
      .eq("owner_id", auth.user.id)
      .or("buy_again.eq.yes,score.gte.90")
      .order("tasted_at", { ascending: false })
      .limit(50);
    if (tastingError) throw tastingError;

    const replenishment: ReplenishmentAutomationInput = {
      inventory: inventoryRows.map(replenishmentInventoryFromCellar),
      ratings,
      tastings: ((tastingRows ?? []) as DbRow[]).map(replenishmentTastingFromDb),
      acquiredTargets: ((targetRows ?? []) as DbRow[]).filter((row) => row.status === "acquired").map(acquiredTargetFromDb),
      existingTargets: ((targetRows ?? []) as DbRow[]).map(existingTargetFromDb),
      asOf,
    };
    const replenishmentAutomation = buildReplenishmentAutomation(replenishment);

    const radar = buildPortfolioRadar({
      asOf,
      cellar,
      priceObservations,
      acquisition: { targets, priceObservations: acquisitionPriceObservations },
      replenishment,
    });

    return NextResponse.json({
      success: true,
      radar,
      sourceSummary: {
        cellar: {
          uniqueWines: cellar.length,
          bottles: cellar.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
          priceEvidence: priceObservations.length,
        },
        acquisition: acquisitionEngine.summary,
        replenishment: replenishmentAutomation.summary,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load Portfolio Radar" }, { status: 500 });
  }
}
