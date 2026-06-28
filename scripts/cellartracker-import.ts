import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseCellarTrackerCsv, type InventoryMatchRecord } from "@/lib/current-intelligence/cellartracker-import";
import { buildCellarTrackerImportPlan, type CellarTrackerImportPlan } from "@/lib/current-intelligence/cellartracker-import-persistence";
import { isMissingDrinkWindowObservationTable } from "@/lib/drink-window-observation-records";

type CliOptions = {
  file: string | null;
  ownerId: string | null;
  importBatchId: string | null;
  writeDrafts: boolean;
  help: boolean;
};

type InsertResult = {
  priceDraftsInserted: number;
  drinkWindowDraftsInserted: number;
};

const defaultOptions: CliOptions = {
  file: null,
  ownerId: null,
  importBatchId: null,
  writeDrafts: false,
  help: false,
};

function usage() {
  return [
    "CellarTracker CSV draft importer",
    "",
    "Usage:",
    "  tsx scripts/cellartracker-import.ts --file <local-export.csv> --owner-id <uuid> [--import-batch-id <id>] [--write-drafts]",
    "",
    "Options:",
    "  --file <path>        Local CellarTracker CSV export to parse.",
    "  --owner-id <uuid>    Owner id used to load owned inventory. May also be set with CELLARTRACKER_IMPORT_OWNER_ID.",
    "  --import-batch-id <id> Stable reviewed batch id to stamp draft rows and cleanup SQL.",
    "  --write-drafts       Explicitly insert draft observation rows. Omit for DRY RUN.",
    "  --help               Print this help.",
    "",
    "Default: DRY RUN. No writes happened unless --write-drafts is present.",
  ].join("\n");
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { ...defaultOptions };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--write-drafts") {
      options.writeDrafts = true;
      continue;
    }
    if (arg === "--file") {
      options.file = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--owner-id") {
      options.ownerId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--import-batch-id") {
      options.importBatchId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }

  return options;
}

function requireValue(value: string | null | undefined, message: string): string {
  if (!value?.trim()) throw new Error(message);
  return value.trim();
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return firstRelation(value[0]);
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function inventoryRecordFromDb(row: Record<string, unknown>): InventoryMatchRecord {
  const reference = firstRelation(row.wine_reference);
  return {
    id: String(row.id),
    custom_producer: asString(row.custom_producer),
    custom_name: asString(row.custom_name),
    vintage: asNumber(row.vintage),
    custom_vintage: asNumber(row.custom_vintage),
    wine_reference: reference
      ? {
        producer: asString(reference.producer),
        name: asString(reference.name),
      }
      : null,
  };
}

async function loadOwnedInventory(supabase: SupabaseClient, ownerId: string): Promise<InventoryMatchRecord[]> {
  const { data, error } = await supabase
    .from("cellar_inventory")
    .select("id, custom_producer, custom_name, vintage, custom_vintage, wine_reference (producer, name), cellars!inner(owner_id)")
    .eq("cellars.owner_id", ownerId);

  if (error) throw new Error(`Failed to load owned inventory for CellarTracker import: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(inventoryRecordFromDb);
}

function rawPayloadDuplicateCandidateKey(row: Record<string, unknown>) {
  const rawPayload = row.raw_payload;
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const candidate = (rawPayload as { duplicateCandidateKey?: unknown }).duplicateCandidateKey;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function uniqueKeys(keys: string[]) {
  return [...new Set(keys)].filter((key) => key.trim().length > 0);
}

function splitCandidateKeys(plan: CellarTrackerImportPlan) {
  return {
    price: uniqueKeys(plan.report.duplicateCandidateKeys.filter((key) => key.startsWith("wine_price_observations|"))),
    drinkWindow: uniqueKeys(plan.report.duplicateCandidateKeys.filter((key) => key.startsWith("wine_drink_window_observations|"))),
  };
}

async function loadExistingDuplicateCandidateKeys(supabase: SupabaseClient, ownerId: string, plan: CellarTrackerImportPlan) {
  const keys = new Set<string>();
  const candidateKeys = splitCandidateKeys(plan);
  const ownedInventoryIds = uniqueKeys(plan.rowResults.map((row) => row.matchedInventoryId ?? ""));
  let drinkWindowTableMissing = false;

  if (candidateKeys.price.length > 0 && ownedInventoryIds.length > 0) {
    const { data, error } = await supabase
      .from("wine_price_observations")
      .select("raw_payload")
      .eq("review_status", "draft")
      .in("source_type", ["cellartracker", "manual", "wine_market_journal"])
      .in("inventory_id", ownedInventoryIds)
      .in("raw_payload->>duplicateCandidateKey", candidateKeys.price);
    if (error) throw new Error(`Failed to load existing CellarTracker price draft duplicate keys: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const key = rawPayloadDuplicateCandidateKey(row);
      if (key) keys.add(key);
    }
  }

  if (candidateKeys.drinkWindow.length > 0) {
    const { data, error } = await supabase
      .from("wine_drink_window_observations")
      .select("raw_payload")
      .eq("owner_id", ownerId)
      .eq("review_status", "draft")
      .eq("source_type", "cellartracker")
      .in("raw_payload->>duplicateCandidateKey", candidateKeys.drinkWindow);
    if (error) {
      if (isMissingDrinkWindowObservationTable(error)) {
        drinkWindowTableMissing = true;
      } else {
        throw new Error(`Failed to load existing CellarTracker drink-window duplicate keys: ${error.message}`);
      }
    }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const key = rawPayloadDuplicateCandidateKey(row);
      if (key) keys.add(key);
    }
  }

  return { keys, drinkWindowTableMissing };
}

function assertDraftOnly(plan: CellarTrackerImportPlan) {
  const priceNonDraft = plan.payloads.priceObservations.find((payload) => payload.review_status !== "draft");
  const windowNonDraft = plan.payloads.drinkWindowObservations.find((payload) => payload.review_status !== "draft");
  if (priceNonDraft || windowNonDraft) {
    throw new Error("Refusing to write CellarTracker import because every payload must have review_status draft.");
  }
}

async function insertDraftRows(supabase: SupabaseClient, plan: CellarTrackerImportPlan): Promise<InsertResult> {
  assertDraftOnly(plan);
  let priceDraftsInserted = 0;
  let drinkWindowDraftsInserted = 0;

  if (plan.payloads.priceObservations.length > 0) {
    const { data, error } = await supabase
      .from("wine_price_observations")
      .insert(plan.payloads.priceObservations)
      .select("id");
    if (error) throw new Error(`Failed to insert CellarTracker price draft observations: ${error.message}`);
    priceDraftsInserted = data?.length ?? plan.payloads.priceObservations.length;
  }

  if (plan.payloads.drinkWindowObservations.length > 0) {
    const { data, error } = await supabase
      .from("wine_drink_window_observations")
      .insert(plan.payloads.drinkWindowObservations)
      .select("id");
    if (error) throw new Error(`Failed to insert CellarTracker drink-window draft observations: ${error.message}`);
    drinkWindowDraftsInserted = data?.length ?? plan.payloads.drinkWindowObservations.length;
  }

  return { priceDraftsInserted, drinkWindowDraftsInserted };
}

function formatPriceDraftCounts(plan: CellarTrackerImportPlan) {
  const entries = Object.entries(plan.report.priceDraftCountsByKindSource).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return "  none";
  return entries.map(([kindSource, count]) => `  ${kindSource}: ${count}`).join("\n");
}

function printReport(plan: CellarTrackerImportPlan, mode: "dry-run" | "write-drafts", insertResult?: InsertResult) {
  const priceDraftCount = plan.payloads.priceObservations.length;
  const drinkWindowDraftCount = plan.payloads.drinkWindowObservations.length;

  console.log(`Batch: ${plan.report.importBatchId}`);
  console.log(`Mode: ${mode === "write-drafts" ? "WRITE DRAFTS" : "DRY RUN"}`);
  console.log(`Rows: ${plan.report.rows}`);
  console.log(`Matches: ${plan.report.matched} matched, ${plan.report.ambiguous} ambiguous, ${plan.report.unmatched} unmatched`);
  console.log(`Drafts: ${priceDraftCount} price drafts; ${drinkWindowDraftCount} drink-window drafts`);
  console.log(`Duplicates skipped: ${plan.report.inFileDuplicateCandidateKeys.length} in-file duplicate candidates; ${plan.report.existingDuplicateCandidateKeys.length} existing draft candidates`);
  console.log("Price draft counts by kind/source:");
  console.log(formatPriceDraftCounts(plan));

  if (plan.report.reviewWarnings.length > 0) {
    console.log("Review warnings:");
    for (const warning of plan.report.reviewWarnings) console.log(`  - ${warning}`);
  } else {
    console.log("Review warnings: none");
  }

  console.log("Per-row match status:");
  for (const row of plan.rowResults) {
    const identity = [row.normalizedIdentity.producer, row.normalizedIdentity.name, row.normalizedIdentity.vintage]
      .filter((part) => part !== null && part !== "")
      .join(" ");
    console.log(`  Row ${row.rowNumber}: ${row.matchStatus} (${identity || "unknown wine"}) price draft count=${row.priceDraftCount} drink-window draft=${row.drinkWindowDraft}`);
  }

  console.log("Cleanup instructions:");
  console.log(plan.cleanupInstructions);
  console.log(plan.cleanupSql);

  if (mode === "dry-run") {
    console.log("DRY RUN: No writes happened. Re-run with --write-drafts only after reviewing matched rows, draft counts, duplicate candidate keys, and cleanup SQL.");
    return;
  }

  console.log(`Inserted draft rows: ${insertResult?.priceDraftsInserted ?? 0} price drafts; ${insertResult?.drinkWindowDraftsInserted ?? 0} drink-window drafts`);
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const file = requireValue(options.file, `Missing --file <path>.\n\n${usage()}`);
  const ownerId = requireValue(
    options.ownerId ?? process.env.CELLARTRACKER_IMPORT_OWNER_ID,
    "Owner targeting is required for CellarTracker import inventory loading. Pass --owner-id <uuid> or set CELLARTRACKER_IMPORT_OWNER_ID."
  );
  const supabaseUrl = requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL; cannot load owned inventory for dry-run.");
  const serviceRoleKey = requireValue(process.env.SUPABASE_SERVICE_ROLE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY; cannot load owned inventory or write draft rows. The key is not printed.");

  const csvPath = resolve(file);
  const csv = readFileSync(csvPath, "utf8");
  const rows = parseCellarTrackerCsv(csv);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const inventory = await loadOwnedInventory(supabase, ownerId);
  const initialPlan = buildCellarTrackerImportPlan({ rows, inventory, ownerId, importBatchId: options.importBatchId ?? undefined });
  const existing = await loadExistingDuplicateCandidateKeys(supabase, ownerId, initialPlan);
  const plan = buildCellarTrackerImportPlan({
    rows,
    inventory,
    ownerId,
    importBatchId: initialPlan.importBatchId,
    existingDuplicateCandidateKeys: existing.keys,
  });

  if (existing.drinkWindowTableMissing && initialPlan.payloads.drinkWindowObservations.length > 0) {
    plan.report.reviewWarnings.push("wine_drink_window_observations is not available in this Supabase environment; write mode will abort before creating partial price-only imports.");
  }

  if (!options.writeDrafts) {
    printReport(plan, "dry-run");
    return;
  }

  if (existing.drinkWindowTableMissing && initialPlan.payloads.drinkWindowObservations.length > 0) {
    throw new Error("Refusing to write CellarTracker drafts because wine_drink_window_observations is unavailable; no price drafts were inserted.");
  }

  const insertResult = await insertDraftRows(supabase, plan);
  printReport(plan, "write-drafts", insertResult);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
