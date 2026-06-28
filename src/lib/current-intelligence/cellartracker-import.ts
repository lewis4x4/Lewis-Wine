import { normalizeDrinkWindowObservation, validateDrinkWindowObservation, type DrinkWindowObservation } from "../drink-window-evidence";
import { normalizePriceObservation, type PriceObservation } from "./price-observations";

export type CellarTrackerRow = Record<string, string>;
export type NormalizedCellarTrackerRow = {
  producer: string | null;
  name: string;
  vintage: number | null;
  bottleSizeMl: number | null;
  quantity: number | null;
  valueCents: number | null;
  valueCurrency: string;
  valuationCents: number | null;
  valuationCurrency: string;
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
  raw: CellarTrackerRow;
};

export type InventoryMatchRecord = {
  id: string;
  custom_producer?: string | null;
  custom_name?: string | null;
  vintage?: number | null;
  custom_vintage?: number | null;
  wine_reference?: { producer?: string | null; name?: string | null } | null;
};

export type CellarTrackerMatch =
  | { status: "matched"; inventoryId: string; confidence: number }
  | { status: "ambiguous"; inventoryIds: string[]; confidence: number }
  | { status: "unmatched"; confidence: number };

export type CellarTrackerImportDraft = {
  priceObservations: PriceObservation[];
  drinkWindowObservation: DrinkWindowObservation | null;
  match: CellarTrackerMatch;
  reviewWarnings: string[];
};

type ParsedMoney = { cents: number; currency: string };

const DEFAULT_CURRENCY = "USD";

const PRODUCER_KEYS = ["Producer", "Winery", "Producer Name", "Producer/Winery"];
const NAME_KEYS = ["Wine", "Name", "Wine Name", "WineName", "Full Wine Name"];
const VINTAGE_KEYS = ["Vintage", "Year"];
const SIZE_KEYS = ["Size", "Bottle Size", "BottleSize", "Bottle Format", "Format"];
const QUANTITY_KEYS = ["Quantity", "Qty", "Count", "# Bottles", "Bottles", "On Hand", "OnHand"];
const PURCHASE_KEYS = ["BottleCost", "Bottle Cost", "Purchase Price", "PurchasePrice", "Purchase Cost", "Cost/Bottle", "Unit Cost", "Avg Cost", "Average Cost", "Cost", "Price Paid", "Price"];
const PURCHASE_CURRENCY_KEYS = ["Purchase Currency", "BottleCost Currency", "Cost Currency", "Currency"];
const MARKET_VALUE_KEYS = ["Market Value", "MarketValue", "Valuation", "Current Value", "Current Valuation", "Value"];
const MARKET_CURRENCY_KEYS = ["Market Currency", "Valuation Currency", "Value Currency", "Currency"];
const COMMUNITY_VALUE_KEYS = ["Community Value", "CommunityValue", "CellarTracker Value", "CellarTracker Community Value", "CT Value", "Community Average", "Community Avg"];
const COMMUNITY_CURRENCY_KEYS = ["Community Currency", "Community Value Currency", "Currency"];
const USER_VALUE_KEYS = ["User Value", "Manual Value", "My Value", "My Valuation", "Your Value", "Personal Value", "User Valuation", "Private Value"];
const USER_CURRENCY_KEYS = ["User Currency", "Manual Currency", "My Value Currency", "Currency"];
const AUCTION_AVERAGE_KEYS = ["WMJ Auction Average", "Wine Market Journal Auction Average", "WMJ Average", "WMJ Avg", "WMJ Value", "WMJ Valuation", "Auction Average", "Auction Avg", "Auction Value", "Auction Valuation"];
const AUCTION_CURRENCY_KEYS = ["WMJ Currency", "Auction Currency", "Auction Average Currency", "Currency"];
const DRINK_AFTER_KEYS = ["Begin Consume", "BeginConsume", "Begin Drinking", "Drink From", "DrinkFrom", "Drink After", "DrinkAfter", "Start Drink", "Start Drinking", "Drinking From"];
const DRINK_BEFORE_KEYS = ["End Consume", "EndConsume", "End Drinking", "Drink To", "DrinkTo", "Drink Before", "DrinkBefore", "End Drink", "End Drinking", "Drinking To"];
const PEAK_START_KEYS = ["Peak Start", "PeakStart", "Peak Begin", "Begin Peak", "Peak From"];
const PEAK_END_KEYS = ["Peak End", "PeakEnd", "End Peak", "Peak To"];
const READY_TO_DRINK_KEYS = ["Ready to Drink", "ReadyToDrink", "Drinkability", "Drinkability Index", "Readiness", "Drink Status"];
const AVAILABILITY_KEYS = ["Availability", "Availability Text", "Available", "Drink Availability"];
const LOCATION_KEYS = ["Location", "Storage Location", "Cellar Location", "Store Location"];
const BIN_KEYS = ["Bin", "Bin Location", "Storage Bin", "Cellar Bin"];

function pushCsvRecord(records: string[][], record: string[]) {
  if (record.some((cell) => cell.trim().length > 0)) {
    records.push(record.map((cell, index) => (index === 0 ? cell.replace(/^\uFEFF/, "") : cell).trim()));
  }
}

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      record.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      record.push(cell.trim());
      pushCsvRecord(records, record);
      record = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || record.length > 0) {
    record.push(cell.trim());
    pushCsvRecord(records, record);
  }

  return records;
}

export function parseCellarTrackerCsv(text: string): CellarTrackerRow[] {
  const records = parseCsvRecords(text);
  if (records.length < 2) return [];
  const headers = records[0];
  return records.slice(1).map((values) => {
    return headers.reduce<CellarTrackerRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function canonicalFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function firstValue(row: CellarTrackerRow, keys: string[]) {
  const valuesByCanonicalKey = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    const canonical = canonicalFieldName(key);
    if (!valuesByCanonicalKey.has(canonical) || !valuesByCanonicalKey.get(canonical)?.trim()) {
      valuesByCanonicalKey.set(canonical, value);
    }
  }

  for (const key of keys) {
    const value = valuesByCanonicalKey.get(canonicalFieldName(key));
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeCurrencyCode(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const iso = upper.match(/\b(USD|EUR|GBP|CAD|AUD|NZD|CHF|JPY|HKD|SGD)\b/);
  if (iso) return iso[1];
  if (upper.includes("C$")) return "CAD";
  if (upper.includes("A$")) return "AUD";
  if (upper.includes("US$") || upper.includes("$") || upper.includes("DOLLAR")) return "USD";
  if (upper.includes("€") || upper.includes("EURO")) return "EUR";
  if (upper.includes("£") || upper.includes("GBP") || upper.includes("POUND")) return "GBP";
  if (upper.includes("¥") || upper.includes("YEN")) return "JPY";
  return null;
}

function parseMoneyValue(value: string, currencyHint?: string | null): ParsedMoney | null {
  const trimmed = value.trim();
  if (!trimmed || /^(?:n\/?a|none|null|unknown|-)$/i.test(trimmed)) return null;

  const currency = normalizeCurrencyCode(trimmed) ?? normalizeCurrencyCode(currencyHint) ?? DEFAULT_CURRENCY;
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round((negative && parsed > 0 ? -parsed : parsed) * 100);
  return { cents, currency };
}

function readMoney(row: CellarTrackerRow, valueKeys: string[], currencyKeys: string[]): ParsedMoney | null {
  const value = firstValue(row, valueKeys);
  if (!value) return null;
  return parseMoneyValue(value, firstValue(row, currencyKeys));
}

function parseSize(value: string) {
  const normalized = value.toLowerCase().replace(/[\s,]/g, "");
  if (!normalized) return null;
  const ml = normalized.match(/([0-9]+(?:\.[0-9]+)?)ml/);
  if (ml) return Math.round(Number(ml[1]));
  const liter = normalized.match(/([0-9]+(?:\.[0-9]+)?)l/);
  if (liter) return Math.round(Number(liter[1]) * 1000);
  if (normalized.includes("half")) return 375;
  if (normalized.includes("doublemagnum")) return 3000;
  if (normalized.includes("magnum") || normalized.includes("1.5") || normalized.includes("1500")) return 1500;
  const numeric = Number(normalized.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric > 100) return Math.round(numeric);
    if (numeric <= 20) return Math.round(numeric * 1000);
  }
  return null;
}

function parseVintage(value: string) {
  const match = value.match(/\b(18|19|20|21)\d{2}\b/);
  if (!match) return null;
  const vintage = Number(match[0]);
  return Number.isFinite(vintage) ? vintage : null;
}

function parseQuantity(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeCellarTrackerRow(row: CellarTrackerRow): NormalizedCellarTrackerRow {
  const marketMoney = readMoney(row, MARKET_VALUE_KEYS, MARKET_CURRENCY_KEYS);
  const communityMoney = readMoney(row, COMMUNITY_VALUE_KEYS, COMMUNITY_CURRENCY_KEYS);
  const userMoney = readMoney(row, USER_VALUE_KEYS, USER_CURRENCY_KEYS);
  const auctionMoney = readMoney(row, AUCTION_AVERAGE_KEYS, AUCTION_CURRENCY_KEYS);
  const purchaseMoney = readMoney(row, PURCHASE_KEYS, PURCHASE_CURRENCY_KEYS);
  const valueMoney = marketMoney;

  return {
    producer: trimOrNull(firstValue(row, PRODUCER_KEYS)),
    name: firstValue(row, NAME_KEYS),
    vintage: parseVintage(firstValue(row, VINTAGE_KEYS)),
    bottleSizeMl: parseSize(firstValue(row, SIZE_KEYS)),
    quantity: parseQuantity(firstValue(row, QUANTITY_KEYS)),
    valueCents: valueMoney?.cents ?? null,
    valueCurrency: valueMoney?.currency ?? DEFAULT_CURRENCY,
    valuationCents: marketMoney?.cents ?? null,
    valuationCurrency: marketMoney?.currency ?? DEFAULT_CURRENCY,
    marketValueCents: marketMoney?.cents ?? null,
    marketValueCurrency: marketMoney?.currency ?? DEFAULT_CURRENCY,
    communityValueCents: communityMoney?.cents ?? null,
    communityValueCurrency: communityMoney?.currency ?? DEFAULT_CURRENCY,
    userValueCents: userMoney?.cents ?? null,
    userValueCurrency: userMoney?.currency ?? DEFAULT_CURRENCY,
    auctionAverageCents: auctionMoney?.cents ?? null,
    auctionAverageCurrency: auctionMoney?.currency ?? DEFAULT_CURRENCY,
    purchasePriceCents: purchaseMoney?.cents ?? null,
    purchaseCurrency: purchaseMoney?.currency ?? DEFAULT_CURRENCY,
    drinkAfter: trimOrNull(firstValue(row, DRINK_AFTER_KEYS)),
    drinkBefore: trimOrNull(firstValue(row, DRINK_BEFORE_KEYS)),
    peakStart: trimOrNull(firstValue(row, PEAK_START_KEYS)),
    peakEnd: trimOrNull(firstValue(row, PEAK_END_KEYS)),
    readyToDrink: trimOrNull(firstValue(row, READY_TO_DRINK_KEYS)),
    availability: trimOrNull(firstValue(row, AVAILABILITY_KEYS)),
    location: trimOrNull(firstValue(row, LOCATION_KEYS)),
    bin: trimOrNull(firstValue(row, BIN_KEYS)),
    raw: row,
  };
}

function normalizeText(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreMatch(row: NormalizedCellarTrackerRow, inventory: InventoryMatchRecord) {
  const producer = normalizeText(inventory.wine_reference?.producer ?? inventory.custom_producer);
  const name = normalizeText(inventory.wine_reference?.name ?? inventory.custom_name);
  const vintage = inventory.vintage ?? inventory.custom_vintage ?? null;
  if (row.vintage && vintage && vintage !== row.vintage) return 0;
  let score = 0;
  if (row.producer && producer.includes(normalizeText(row.producer))) score += 36;
  if (name && normalizeText(row.name) && (name.includes(normalizeText(row.name)) || normalizeText(row.name).includes(name))) score += 42;
  if (row.vintage && vintage === row.vintage) score += 18;
  return score;
}

export function matchCellarTrackerRowToInventory(row: NormalizedCellarTrackerRow, inventory: InventoryMatchRecord[]): CellarTrackerMatch {
  const scored = inventory.map((item) => ({ id: item.id, score: scoreMatch(row, item) })).filter((item) => item.score >= 70).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { status: "unmatched", confidence: 0 };
  if (scored.length > 1 && scored[0].score === scored[1].score) return { status: "ambiguous", inventoryIds: scored.map((item) => item.id), confidence: scored[0].score };
  return { status: "matched", inventoryId: scored[0].id, confidence: scored[0].score };
}

function priceConfidence(match: Extract<CellarTrackerMatch, { status: "matched" }>, ceiling: number, penalty = 0) {
  return Math.max(1, Math.min(ceiling, Math.round(match.confidence - penalty)));
}

function addObservation(observations: PriceObservation[], input: Parameters<typeof normalizePriceObservation>[0] & { observedPriceCents: number | null }) {
  if (input.observedPriceCents == null || input.observedPriceCents <= 0) return;
  observations.push(normalizePriceObservation(input));
}

function drinkWindowNotes(row: NormalizedCellarTrackerRow) {
  const notes: string[] = [];
  if (row.readyToDrink) notes.push(`Ready to drink: ${row.readyToDrink}`);
  if (row.availability) notes.push(`Availability: ${row.availability}`);
  return notes.length > 0 ? notes.join("\n") : null;
}

export function buildCellarTrackerImportDraft(row: NormalizedCellarTrackerRow, match: CellarTrackerMatch): CellarTrackerImportDraft {
  const reviewWarnings: string[] = [];
  if (match.status !== "matched") {
    reviewWarnings.push(match.status === "ambiguous"
      ? `CellarTracker row is ambiguous across multiple inventory records (${match.inventoryIds.join(", ")}); no valuation or drink-window evidence draft was created.`
      : "CellarTracker row is unmatched to inventory; no valuation or drink-window evidence draft was created.");
    return { priceObservations: [], drinkWindowObservation: null, match, reviewWarnings };
  }

  const observedAt = new Date().toISOString();
  const base = {
    inventoryId: match.inventoryId,
    bottleSizeMl: row.bottleSizeMl ?? 750,
    vintage: row.vintage,
    observedAt,
    rawPayload: row.raw,
  };
  const priceObservations: PriceObservation[] = [];

  addObservation(priceObservations, {
    ...base,
    sourceType: "cellartracker",
    sourceName: "CellarTracker market/valuation export",
    observationKind: "market_value",
    truthLabel: "verified",
    reviewStatus: "draft",
    observedPriceCents: row.marketValueCents,
    currency: row.marketValueCurrency,
    confidence: priceConfidence(match, 82, 10),
  });

  addObservation(priceObservations, {
    ...base,
    sourceType: "cellartracker",
    sourceName: "CellarTracker community value export (context only)",
    observationKind: "estimate",
    truthLabel: "estimated",
    reviewStatus: "draft",
    observedPriceCents: row.communityValueCents,
    currency: row.communityValueCurrency,
    confidence: priceConfidence(match, 64, 24),
    notes: "CellarTracker community value is imported as context-only estimate evidence and should not silently drive market value.",
  });

  addObservation(priceObservations, {
    ...base,
    sourceType: "manual",
    sourceName: "User/manual valuation via CellarTracker export",
    observationKind: "market_value",
    truthLabel: "verified",
    reviewStatus: "draft",
    observedPriceCents: row.userValueCents,
    currency: row.userValueCurrency,
    confidence: priceConfidence(match, 88, 4),
  });

  addObservation(priceObservations, {
    ...base,
    sourceType: "wine_market_journal",
    sourceName: "Wine Market Journal auction average via CellarTracker export",
    observationKind: "auction_comp",
    truthLabel: "verified",
    reviewStatus: "draft",
    observedPriceCents: row.auctionAverageCents,
    currency: row.auctionAverageCurrency,
    confidence: priceConfidence(match, 90),
  });

  addObservation(priceObservations, {
    ...base,
    sourceType: "cellartracker",
    sourceName: "CellarTracker purchase cost import",
    observationKind: "purchase_price",
    truthLabel: "verified",
    reviewStatus: "draft",
    observedPriceCents: row.purchasePriceCents,
    currency: row.purchaseCurrency,
    confidence: priceConfidence(match, 86, 6),
  });

  const drinkWindowObservation = row.drinkAfter || row.drinkBefore
    ? normalizeDrinkWindowObservation({
      inventoryId: match.inventoryId,
      sourceType: "cellartracker",
      sourceName: "CellarTracker drinkability export",
      truthLabel: "verified",
      reviewStatus: "draft",
      drinkAfter: row.drinkAfter,
      drinkBefore: row.drinkBefore,
      peakStart: row.peakStart,
      peakEnd: row.peakEnd,
      confidence: Math.max(1, Math.min(84, Math.round(match.confidence - 8))),
      observedAt,
      notes: drinkWindowNotes(row),
      rawPayload: row.raw,
    })
    : null;

  if (drinkWindowObservation) {
    if (!row.drinkAfter || !row.drinkBefore) {
      reviewWarnings.push("CellarTracker drink-window export is partial; it was preserved as a draft for human review and did not overwrite cellar truth.");
    }
    const drinkWindowIssues = validateDrinkWindowObservation(drinkWindowObservation);
    reviewWarnings.push(...drinkWindowIssues.map((issue) => `CellarTracker drink-window draft needs review: ${issue}.`));
  }

  return { priceObservations, drinkWindowObservation, match, reviewWarnings };
}

export function buildCellarTrackerObservationDraft(row: NormalizedCellarTrackerRow, match: CellarTrackerMatch): { marketObservation: PriceObservation | null; purchaseObservation: PriceObservation | null; match: CellarTrackerMatch } {
  const draft = buildCellarTrackerImportDraft(row, match);
  return {
    marketObservation: draft.priceObservations.find((observation) => observation.sourceType === "cellartracker" && observation.observationKind === "market_value") ?? draft.priceObservations.find((observation) => observation.observationKind === "market_value") ?? null,
    purchaseObservation: draft.priceObservations.find((observation) => observation.observationKind === "purchase_price") ?? null,
    match,
  };
}
