import { normalizePriceObservation, type PriceObservation } from "./price-observations";

export type CellarTrackerRow = Record<string, string>;
export type NormalizedCellarTrackerRow = {
  producer: string | null;
  name: string;
  vintage: number | null;
  bottleSizeMl: number | null;
  quantity: number | null;
  valueCents: number | null;
  purchasePriceCents: number | null;
  location: string | null;
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

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

export function parseCellarTrackerCsv(text: string): CellarTrackerRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<CellarTrackerRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function firstValue(row: CellarTrackerRow, keys: string[]) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (value) return value.trim();
  }
  return "";
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function parseSize(value: string) {
  const normalized = value.toLowerCase().replace(/\s/g, "");
  if (!normalized) return null;
  if (normalized.includes("1.5") || normalized.includes("1500")) return 1500;
  const ml = normalized.match(/(\d+)ml/);
  if (ml) return Number(ml[1]);
  const liter = normalized.match(/([0-9.]+)l/);
  if (liter) return Math.round(Number(liter[1]) * 1000);
  return null;
}

export function normalizeCellarTrackerRow(row: CellarTrackerRow): NormalizedCellarTrackerRow {
  const vintage = Number(firstValue(row, ["Vintage", "Year"]));
  const quantity = Number(firstValue(row, ["Quantity", "Qty", "Count"]));
  return {
    producer: firstValue(row, ["Producer", "Winery"]) || null,
    name: firstValue(row, ["Wine", "Name", "Wine Name"]),
    vintage: Number.isFinite(vintage) ? vintage : null,
    bottleSizeMl: parseSize(firstValue(row, ["Size", "Bottle Size"])),
    quantity: Number.isFinite(quantity) ? quantity : null,
    valueCents: parseMoney(firstValue(row, ["Value", "Valuation", "Community Value", "Market Value"])),
    purchasePriceCents: parseMoney(firstValue(row, ["Purchase Price", "Cost", "Price"])),
    location: firstValue(row, ["Location", "Bin"]) || null,
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

export function buildCellarTrackerObservationDraft(row: NormalizedCellarTrackerRow, match: CellarTrackerMatch): { marketObservation: PriceObservation | null; purchaseObservation: PriceObservation | null; match: CellarTrackerMatch } {
  if (match.status !== "matched") return { marketObservation: null, purchaseObservation: null, match };
  const observedAt = new Date().toISOString();
  const base = {
    inventoryId: match.inventoryId,
    sourceType: "cellartracker" as const,
    sourceName: "CellarTracker import",
    bottleSizeMl: row.bottleSizeMl ?? 750,
    vintage: row.vintage,
    confidence: Math.min(96, match.confidence),
    observedAt,
    rawPayload: row.raw,
  };
  return {
    marketObservation: row.valueCents == null ? null : normalizePriceObservation({ ...base, observationKind: "market_value", observedPriceCents: row.valueCents, reviewStatus: "draft" }),
    purchaseObservation: row.purchasePriceCents == null ? null : normalizePriceObservation({ ...base, observationKind: "purchase_price", observedPriceCents: row.purchasePriceCents, reviewStatus: "draft" }),
    match,
  };
}
