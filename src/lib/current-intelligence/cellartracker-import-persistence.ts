import { createHash, randomUUID } from "node:crypto";
import type { DrinkWindowObservation } from "../drink-window-evidence";
import { drinkWindowObservationToDbInsert } from "../drink-window-observation-records";
import {
  buildCellarTrackerImportDraft,
  matchCellarTrackerRowToInventory,
  normalizeCellarTrackerRow,
  type CellarTrackerMatch,
  type CellarTrackerRow,
  type InventoryMatchRecord,
  type NormalizedCellarTrackerRow,
} from "./cellartracker-import";
import type { PriceObservation } from "./price-observations";

export type NormalizedCellarTrackerIdentity = {
  producer: string | null;
  name: string;
  vintage: number | null;
  bottleSizeMl: number | null;
  quantity: number | null;
};

export type NormalizedCellarTrackerRowSummary = NormalizedCellarTrackerIdentity & {
  marketValueCents: number | null;
  marketValueCurrency: string;
  communityValueCents: number | null;
  communityValueCurrency: string;
  userValueCents: number | null;
  userValueCurrency: string;
  auctionAverageCents: number | null;
  auctionAverageCurrency: string;
  purchasePriceCents: number | null;
  purchaseCurrency: string;
  drinkAfter: string | null;
  drinkBefore: string | null;
  peakStart: string | null;
  peakEnd: string | null;
  readyToDrink: string | null;
  availability: string | null;
  location: string | null;
  bin: string | null;
};

export type CellarTrackerImportRawPayload = {
  importBatchId: string;
  rowNumber: number;
  rowHash: string;
  originalRow: CellarTrackerRow;
  normalizedRow: NormalizedCellarTrackerRowSummary;
  duplicateCandidateKey: string;
};

export type WinePriceObservationInsertPayload = {
  inventory_id: string;
  wine_reference_id: string | null;
  source_type: PriceObservation["sourceType"];
  source_name: string | null;
  source_url: string | null;
  observation_kind: PriceObservation["observationKind"];
  truth_label: PriceObservation["truthLabel"];
  review_status: "draft";
  observed_price_cents: number | null;
  currency: string;
  bottle_size_ml: number | null;
  vintage: number | null;
  confidence: number;
  observed_at: string;
  notes: string | null;
  raw_payload: CellarTrackerImportRawPayload;
};

export type WineDrinkWindowObservationInsertPayload = Omit<ReturnType<typeof drinkWindowObservationToDbInsert>, "owner_id" | "review_status" | "raw_payload"> & {
  owner_id: string;
  review_status: "draft";
  raw_payload: CellarTrackerImportRawPayload;
};

export type CellarTrackerImportRowResult = {
  rowNumber: number;
  rowHash: string;
  matchStatus: CellarTrackerMatch["status"];
  confidence: number;
  matchedInventoryId: string | null;
  ambiguousInventoryIds: string[];
  normalizedIdentity: NormalizedCellarTrackerIdentity;
  priceDraftCount: number;
  drinkWindowDraft: boolean;
  duplicateCandidateKeys: string[];
  reviewWarnings: string[];
};

export type CellarTrackerImportReport = {
  importBatchId: string;
  rows: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  priceDraftCountsByKindSource: Record<string, number>;
  drinkWindowDraftCount: number;
  skippedExistingDraftCount: number;
  reviewWarnings: string[];
  rowResults: CellarTrackerImportRowResult[];
  duplicateCandidateKeys: string[];
  inFileDuplicateCandidateKeys: string[];
  existingDuplicateCandidateKeys: string[];
  cleanupSql: string;
  cleanupInstructions: string;
};

export type CellarTrackerImportPlan = {
  importBatchId: string;
  report: CellarTrackerImportReport;
  rowResults: CellarTrackerImportRowResult[];
  payloads: {
    priceObservations: WinePriceObservationInsertPayload[];
    drinkWindowObservations: WineDrinkWindowObservationInsertPayload[];
  };
  cleanupSql: string;
  cleanupInstructions: string;
};

export type CellarTrackerImportPlanInput = {
  rows: Array<CellarTrackerRow | NormalizedCellarTrackerRow>;
  inventory: InventoryMatchRecord[];
  ownerId: string;
  importBatchId?: string;
  observedAt?: string;
  existingDuplicateCandidateKeys?: ReadonlySet<string> | string[];
};

function stableJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`).join(",")}}`;
}

function isNormalizedCellarTrackerRow(row: CellarTrackerRow | NormalizedCellarTrackerRow): row is NormalizedCellarTrackerRow {
  return Object.prototype.hasOwnProperty.call(row, "raw") &&
    Object.prototype.hasOwnProperty.call(row, "valueCents") &&
    typeof (row as NormalizedCellarTrackerRow).name === "string";
}

function normalizeInputRow(row: CellarTrackerRow | NormalizedCellarTrackerRow) {
  return isNormalizedCellarTrackerRow(row) ? row : normalizeCellarTrackerRow(row);
}

export function summarizeCellarTrackerIdentity(row: NormalizedCellarTrackerRow): NormalizedCellarTrackerIdentity {
  return {
    producer: row.producer,
    name: row.name,
    vintage: row.vintage,
    bottleSizeMl: row.bottleSizeMl,
    quantity: row.quantity,
  };
}

export function summarizeNormalizedCellarTrackerRow(row: NormalizedCellarTrackerRow): NormalizedCellarTrackerRowSummary {
  return {
    ...summarizeCellarTrackerIdentity(row),
    marketValueCents: row.marketValueCents,
    marketValueCurrency: row.marketValueCurrency,
    communityValueCents: row.communityValueCents,
    communityValueCurrency: row.communityValueCurrency,
    userValueCents: row.userValueCents,
    userValueCurrency: row.userValueCurrency,
    auctionAverageCents: row.auctionAverageCents,
    auctionAverageCurrency: row.auctionAverageCurrency,
    purchasePriceCents: row.purchasePriceCents,
    purchaseCurrency: row.purchaseCurrency,
    drinkAfter: row.drinkAfter,
    drinkBefore: row.drinkBefore,
    peakStart: row.peakStart,
    peakEnd: row.peakEnd,
    readyToDrink: row.readyToDrink,
    availability: row.availability,
    location: row.location,
    bin: row.bin,
  };
}

export function stableCellarTrackerRowHash(row: NormalizedCellarTrackerRow): string {
  return createHash("sha256")
    .update(stableJson({ normalizedRow: summarizeNormalizedCellarTrackerRow(row), originalRow: row.raw }))
    .digest("hex");
}

function defaultImportBatchId() {
  return `cellartracker-${new Date().toISOString().replace(/[^0-9A-Za-z]+/g, "-")}-${randomUUID()}`;
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildCellarTrackerImportCleanupSql(importBatchId: string, ownerId: string) {
  const batch = sqlLiteral(importBatchId);
  const owner = sqlLiteral(ownerId);
  return [
    "-- CellarTracker draft-import cleanup SQL. Review before executing; this only targets owner-scoped draft rows stamped with the import batch id.",
    "delete from public.wine_price_observations price",
    "using public.cellar_inventory inventory",
    "join public.cellars cellar on cellar.id = inventory.cellar_id",
    "where price.inventory_id = inventory.id",
    `and cellar.owner_id = ${owner}`,
    "and price.review_status = 'draft'",
    "and price.source_type in ('cellartracker', 'manual', 'wine_market_journal')",
    `and price.raw_payload->>'importBatchId' = ${batch};`,
    "",
    "delete from public.wine_drink_window_observations",
    `where owner_id = ${owner}`,
    "and review_status = 'draft'",
    "and source_type = 'cellartracker'",
    `and raw_payload->>'importBatchId' = ${batch};`,
  ].join("\n");
}

function cleanupInstructions(importBatchId: string, ownerId: string) {
  return `Review before executing cleanup. The SQL only deletes owner-scoped draft observation rows for owner ${ownerId} whose raw_payload.importBatchId is ${importBatchId}; it does not touch inventory truth fields or accepted evidence.`;
}

function existingDuplicateCandidateSet(input: CellarTrackerImportPlanInput) {
  if (!input.existingDuplicateCandidateKeys) return new Set<string>();
  return input.existingDuplicateCandidateKeys instanceof Set
    ? new Set(input.existingDuplicateCandidateKeys)
    : new Set(input.existingDuplicateCandidateKeys);
}

function priceDraftCountKey(observation: PriceObservation) {
  return `${observation.sourceType}:${observation.observationKind}`;
}

function priceDuplicateCandidateKey(observation: PriceObservation, rowHash: string) {
  return [
    "wine_price_observations",
    observation.inventoryId,
    observation.sourceType,
    observation.observationKind,
    observation.observedPriceCents ?? "null",
    observation.currency,
    observation.bottleSizeMl ?? "null",
    observation.vintage ?? "null",
    rowHash,
  ].join("|");
}

function drinkWindowDuplicateCandidateKey(observation: DrinkWindowObservation, rowHash: string) {
  return [
    "wine_drink_window_observations",
    observation.inventoryId,
    observation.sourceType,
    observation.drinkAfter ?? "null",
    observation.drinkBefore ?? "null",
    observation.peakStart ?? "null",
    observation.peakEnd ?? "null",
    rowHash,
  ].join("|");
}

function rawPayloadFor(row: NormalizedCellarTrackerRow, importBatchId: string, rowNumber: number, rowHash: string, duplicateCandidateKey: string): CellarTrackerImportRawPayload {
  return {
    importBatchId,
    rowNumber,
    rowHash,
    originalRow: row.raw,
    normalizedRow: summarizeNormalizedCellarTrackerRow(row),
    duplicateCandidateKey,
  };
}

function priceObservationToDbInsert(observation: PriceObservation, observedAt: string, rawPayload: CellarTrackerImportRawPayload): WinePriceObservationInsertPayload {
  return {
    inventory_id: observation.inventoryId,
    wine_reference_id: observation.wineReferenceId ?? null,
    source_type: observation.sourceType,
    source_name: observation.sourceName ?? null,
    source_url: observation.sourceUrl || null,
    observation_kind: observation.observationKind,
    truth_label: observation.truthLabel,
    review_status: "draft",
    observed_price_cents: observation.observedPriceCents,
    currency: observation.currency,
    bottle_size_ml: observation.bottleSizeMl ?? null,
    vintage: observation.vintage ?? null,
    confidence: observation.confidence,
    observed_at: observedAt,
    notes: observation.notes ?? null,
    raw_payload: rawPayload,
  };
}

function drinkWindowObservationToDbInsertPayload(
  observation: DrinkWindowObservation,
  ownerId: string,
  observedAt: string,
  rawPayload: CellarTrackerImportRawPayload
): WineDrinkWindowObservationInsertPayload {
  const dbInsert = drinkWindowObservationToDbInsert({
    ...observation,
    reviewStatus: "draft",
    observedAt,
    rawPayload,
  }, ownerId);

  return {
    ...dbInsert,
    owner_id: ownerId,
    review_status: "draft",
    raw_payload: rawPayload,
  };
}

function matchedInventoryId(match: CellarTrackerMatch) {
  return match.status === "matched" ? match.inventoryId : null;
}

function ambiguousInventoryIds(match: CellarTrackerMatch) {
  return match.status === "ambiguous" ? match.inventoryIds : [];
}

export function buildCellarTrackerImportPlan(input: CellarTrackerImportPlanInput): CellarTrackerImportPlan {
  const importBatchId = input.importBatchId ?? defaultImportBatchId();
  const observedAt = input.observedAt ?? new Date().toISOString();
  const cleanupSql = buildCellarTrackerImportCleanupSql(importBatchId, input.ownerId);
  const cleanup = cleanupInstructions(importBatchId, input.ownerId);
  const existingDuplicateCandidates = existingDuplicateCandidateSet(input);

  const rowResults: CellarTrackerImportRowResult[] = [];
  const priceObservations: WinePriceObservationInsertPayload[] = [];
  const drinkWindowObservations: WineDrinkWindowObservationInsertPayload[] = [];
  const reviewWarnings: string[] = [];
  const priceDraftCountsByKindSource: Record<string, number> = {};
  const duplicateCandidateKeys: string[] = [];
  const inFileDuplicateCandidateKeys = new Set<string>();
  const existingDuplicateCandidateKeysInPlan = new Set<string>();
  const seenDuplicateCandidateKeys = new Set<string>();
  let skippedExistingDraftCount = 0;

  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  input.rows.map(normalizeInputRow).forEach((row, index) => {
    const rowNumber = index + 2;
    const rowHash = stableCellarTrackerRowHash(row);
    const match = matchCellarTrackerRowToInventory(row, input.inventory);
    const draft = buildCellarTrackerImportDraft(row, match);
    const rowDuplicateCandidateKeys: string[] = [];

    if (match.status === "matched") matched += 1;
    if (match.status === "ambiguous") ambiguous += 1;
    if (match.status === "unmatched") unmatched += 1;

    const rowWarnings = draft.reviewWarnings.map((warning) => `Row ${rowNumber}: ${warning}`);
    reviewWarnings.push(...rowWarnings);

    let rowPriceDraftCount = 0;
    let rowDrinkWindowDraft = false;

    function shouldSkipDuplicateCandidate(duplicateCandidateKey: string, label: string) {
      duplicateCandidateKeys.push(duplicateCandidateKey);
      rowDuplicateCandidateKeys.push(duplicateCandidateKey);

      const duplicateInFile = seenDuplicateCandidateKeys.has(duplicateCandidateKey);
      if (!duplicateInFile) seenDuplicateCandidateKeys.add(duplicateCandidateKey);
      if (duplicateInFile) {
        inFileDuplicateCandidateKeys.add(duplicateCandidateKey);
        const warning = `Row ${rowNumber}: duplicate ${label} candidate already appeared earlier in this CellarTracker CSV; skipping this draft to avoid duplicate review rows.`;
        rowWarnings.push(warning);
        reviewWarnings.push(warning);
      }

      if (existingDuplicateCandidates.has(duplicateCandidateKey)) {
        existingDuplicateCandidateKeysInPlan.add(duplicateCandidateKey);
        skippedExistingDraftCount += 1;
        const warning = `Row ${rowNumber}: duplicate ${label} candidate already exists as a draft observation; skipping insert payload.`;
        rowWarnings.push(warning);
        reviewWarnings.push(warning);
      }

      return duplicateInFile || existingDuplicateCandidates.has(duplicateCandidateKey);
    }

    for (const observation of draft.priceObservations) {
      const duplicateCandidateKey = priceDuplicateCandidateKey(observation, rowHash);
      if (shouldSkipDuplicateCandidate(duplicateCandidateKey, "price")) continue;
      const payload = priceObservationToDbInsert(
        observation,
        observedAt,
        rawPayloadFor(row, importBatchId, rowNumber, rowHash, duplicateCandidateKey)
      );
      priceObservations.push(payload);
      rowPriceDraftCount += 1;
      const countKey = priceDraftCountKey(observation);
      priceDraftCountsByKindSource[countKey] = (priceDraftCountsByKindSource[countKey] ?? 0) + 1;
    }

    if (draft.drinkWindowObservation) {
      const duplicateCandidateKey = drinkWindowDuplicateCandidateKey(draft.drinkWindowObservation, rowHash);
      if (shouldSkipDuplicateCandidate(duplicateCandidateKey, "drink-window")) {
        rowDrinkWindowDraft = false;
      } else {
        const payload = drinkWindowObservationToDbInsertPayload(
          draft.drinkWindowObservation,
          input.ownerId,
          observedAt,
          rawPayloadFor(row, importBatchId, rowNumber, rowHash, duplicateCandidateKey)
        );
        drinkWindowObservations.push(payload);
        rowDrinkWindowDraft = true;
      }
    }

    rowResults.push({
      rowNumber,
      rowHash,
      matchStatus: match.status,
      confidence: match.confidence,
      matchedInventoryId: matchedInventoryId(match),
      ambiguousInventoryIds: ambiguousInventoryIds(match),
      normalizedIdentity: summarizeCellarTrackerIdentity(row),
      priceDraftCount: rowPriceDraftCount,
      drinkWindowDraft: rowDrinkWindowDraft,
      duplicateCandidateKeys: rowDuplicateCandidateKeys,
      reviewWarnings: rowWarnings,
    });
  });

  const report: CellarTrackerImportReport = {
    importBatchId,
    rows: input.rows.length,
    matched,
    ambiguous,
    unmatched,
    priceDraftCountsByKindSource,
    drinkWindowDraftCount: drinkWindowObservations.length,
    skippedExistingDraftCount,
    reviewWarnings,
    rowResults,
    duplicateCandidateKeys,
    inFileDuplicateCandidateKeys: [...inFileDuplicateCandidateKeys],
    existingDuplicateCandidateKeys: [...existingDuplicateCandidateKeysInPlan],
    cleanupSql,
    cleanupInstructions: cleanup,
  };

  return {
    importBatchId,
    report,
    rowResults,
    payloads: {
      priceObservations,
      drinkWindowObservations,
    },
    cleanupSql,
    cleanupInstructions: cleanup,
  };
}
