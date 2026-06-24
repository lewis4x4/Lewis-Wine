import type { PriceObservation } from "./current-intelligence/price-observations";

export type ReceiptVendorType = "retailer" | "winery" | "auction" | "private" | "other";
export type AcquisitionReceiptAction = "close_acquisition_and_add_to_cellar" | "add_to_cellar" | "record_only";

export type ParsedReceiptItem = {
  id: string;
  rawText: string;
  wineTitle: string;
  producer: string | null;
  label: string;
  vintage: number | null;
  region: string | null;
  varietal: string | null;
  quantity: number;
  unitPriceCents: number | null;
  lineTotalCents: number | null;
};

export type AcquisitionReceiptInputItem = ParsedReceiptItem & {
  acquisitionTargetId?: string | null;
  selected?: boolean;
};

export type AcquisitionReceiptInput = {
  vendor?: string | null;
  vendorType?: ReceiptVendorType | null;
  purchaseDate?: string | null;
  subtotalCents?: number | null;
  taxCents?: number | null;
  totalCents?: number | null;
  receiptText?: string | null;
  notes?: string | null;
  items: AcquisitionReceiptInputItem[];
};

export type AcquisitionReceiptItem = AcquisitionReceiptInputItem & {
  selected: boolean;
  action: AcquisitionReceiptAction;
  purchaseStory: string;
};

export type AcquisitionReceipt = Omit<AcquisitionReceiptInput, "items"> & {
  vendor: string | null;
  vendorType: ReceiptVendorType;
  purchaseDate: string;
  items: AcquisitionReceiptItem[];
  summary: {
    selectedItems: number;
    totalBottles: number;
    totalWineSpendCents: number;
    closeoutCount: number;
    cellarIntakeCount: number;
  };
  purchaseStory: string;
};

export type CellarReceiptPayload = {
  cellar_id: string;
  custom_name: string;
  custom_producer: string | null;
  custom_vintage: number | null;
  custom_region: string | null;
  vintage: number | null;
  quantity: number;
  purchase_price_cents: number | null;
  purchase_date: string;
  purchase_location: string | null;
  status: "in_cellar";
  notes: string;
  tags: string[];
};

export type AcquisitionTargetReceiptUpdate = {
  status: "acquired";
  acquiredQuantity: number;
  acquiredPriceCents: number | null;
};

function clean(value: string) {
  return value.replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
}

function centsFromPrice(value: string | null | undefined) {
  if (!value) return null;
  const number = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function dateFromText(text: string) {
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

function inferRegion(text: string) {
  const lowered = text.toLowerCase();
  if (/mendoza/.test(lowered)) return "Mendoza";
  if (/napa/.test(lowered)) return "Napa Valley";
  if (/willamette/.test(lowered)) return "Willamette Valley";
  if (/bordeaux/.test(lowered)) return "Bordeaux";
  if (/sonoma/.test(lowered)) return "Sonoma";
  if (/rioja/.test(lowered)) return "Rioja";
  return null;
}

function inferVarietal(text: string) {
  const lowered = text.toLowerCase();
  if (/cabernet|cab\b/.test(lowered)) return "Cabernet Sauvignon";
  if (/pinot noir/.test(lowered)) return "Pinot Noir";
  if (/merlot/.test(lowered)) return "Merlot";
  if (/malbec/.test(lowered)) return "Malbec";
  if (/chardonnay/.test(lowered)) return "Chardonnay";
  return null;
}

function parseProducerAndLabel(line: string, vintage: number | null, quantity: number, unitPriceCents: number | null, region: string | null, varietal: string | null) {
  let working = line;
  working = working.replace(/^\s*\d+\s*x\s*/i, " ");
  if (vintage) working = working.replace(String(vintage), " ");
  if (region) working = working.replace(new RegExp(`\\b${region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), " ");
  if (unitPriceCents) {
    const dollars = (unitPriceCents / 100).toFixed(2).replace(/\.00$/, "(?:\\.00)?");
    working = working.replace(new RegExp(`@?\\s*\\$?${dollars}`, "i"), " ");
  }
  working = clean(working.replace(/[,|-]/g, " "));
  const tokens = working.split(" ").filter(Boolean);
  if (!tokens.length) return { producer: null, label: clean(line) };
  let producerLength = 1;
  if (tokens[0]?.toLowerCase() === "lewis" && tokens[1]?.toLowerCase() === "cellars") producerLength = 2;
  else if (["cellars", "estate", "winery", "vineyard", "vineyards", "domaine", "chateau", "bodega", "bodegas"].includes(tokens[1]?.toLowerCase())) producerLength = 2;
  const producer = tokens.slice(0, producerLength).join(" ");
  const label = clean(tokens.slice(producerLength).join(" ") || varietal || line);
  return { producer, label };
}

function itemFromLine(line: string, index: number): ParsedReceiptItem | null {
  const priceMatches = [...line.matchAll(/\$?([0-9]{1,5}(?:\.[0-9]{2})?)/g)];
  const moneyMatches = priceMatches.filter((match) => line.slice(Math.max(0, match.index ?? 0 - 2), (match.index ?? 0) + match[0].length + 1).includes("$") || /@\s*\$?/.test(line.slice(Math.max(0, (match.index ?? 0) - 3), (match.index ?? 0) + 2)));
  const price = moneyMatches.length ? centsFromPrice(moneyMatches[moneyMatches.length - 1][1]) : null;
  const quantity = Number(line.match(/^\s*(\d+)\s*x\b/i)?.[1] ?? 1);
  const vintage = Number(line.match(/\b(19\d{2}|20\d{2})\b/)?.[1] ?? 0) || null;
  if (!vintage && !price) return null;
  if (/subtotal|tax|total/i.test(line)) return null;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(line) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(line)) return null;
  const region = inferRegion(line);
  const varietal = inferVarietal(line);
  const { producer, label } = parseProducerAndLabel(line, vintage, quantity, price, region, varietal);
  const lineTotalCents = price != null ? price * quantity : null;
  return {
    id: `receipt-item-${index + 1}`,
    rawText: clean(line),
    wineTitle: [vintage, producer, label].filter(Boolean).join(" "),
    producer,
    label,
    vintage,
    region,
    varietal,
    quantity,
    unitPriceCents: price,
    lineTotalCents,
  };
}

export function parseReceiptText(text: string) {
  const lines = text.split(/\n+/).map(clean).filter(Boolean);
  const purchaseDate = dateFromText(text);
  const subtotalCents = centsFromPrice(lines.find((line) => /^subtotal\b/i.test(line))?.match(/\$?([0-9,]+(?:\.[0-9]{2})?)/)?.[1]);
  const taxCents = centsFromPrice(lines.find((line) => /^tax\b/i.test(line))?.match(/\$?([0-9,]+(?:\.[0-9]{2})?)/)?.[1]);
  const totalCents = centsFromPrice(lines.find((line) => /^total\b/i.test(line))?.match(/\$?([0-9,]+(?:\.[0-9]{2})?)/)?.[1]);
  const vendor = lines.find((line) => !dateFromText(line) && !/^\d+\s*x\b/i.test(line) && !/subtotal|tax|total/i.test(line)) ?? null;
  const items = lines.map(itemFromLine).filter((item): item is ParsedReceiptItem => Boolean(item));
  return { vendor, vendorType: "retailer" as ReceiptVendorType, purchaseDate, subtotalCents, taxCents, totalCents, items, rawText: text };
}

export function buildAcquisitionReceipt(input: AcquisitionReceiptInput): AcquisitionReceipt {
  const purchaseDate = input.purchaseDate ?? new Date().toISOString().slice(0, 10);
  const vendor = input.vendor ?? null;
  const items = input.items.map((item) => {
    const selected = item.selected ?? true;
    const action: AcquisitionReceiptAction = !selected ? "record_only" : item.acquisitionTargetId ? "close_acquisition_and_add_to_cellar" : "add_to_cellar";
    return {
      ...item,
      selected,
      action,
      purchaseStory: `${item.quantity} × ${item.wineTitle} from ${vendor ?? "receipt"}`,
    };
  });
  const selectedItems = items.filter((item) => item.selected);
  const totalBottles = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalWineSpendCents = selectedItems.reduce((sum, item) => sum + (item.lineTotalCents ?? 0), 0);
  const purchaseStory = `${vendor ?? "Receipt"} captured ${totalBottles} bottle${totalBottles === 1 ? "" : "s"} for ${formatCents(totalWineSpendCents)} on ${purchaseDate}.`;
  return {
    vendor,
    vendorType: input.vendorType ?? "retailer",
    purchaseDate,
    subtotalCents: input.subtotalCents ?? null,
    taxCents: input.taxCents ?? null,
    totalCents: input.totalCents ?? null,
    receiptText: input.receiptText ?? null,
    notes: input.notes ?? null,
    items,
    summary: {
      selectedItems: selectedItems.length,
      totalBottles,
      totalWineSpendCents,
      closeoutCount: selectedItems.filter((item) => item.acquisitionTargetId).length,
      cellarIntakeCount: selectedItems.length,
    },
    purchaseStory,
  };
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function receiptItemToCellarPayload(item: AcquisitionReceiptItem, cellarId: string, receipt: AcquisitionReceipt): CellarReceiptPayload {
  return {
    cellar_id: cellarId,
    custom_name: item.label,
    custom_producer: item.producer,
    custom_vintage: item.vintage,
    custom_region: item.region,
    vintage: item.vintage,
    quantity: item.quantity,
    purchase_price_cents: item.unitPriceCents,
    purchase_date: receipt.purchaseDate,
    purchase_location: receipt.vendor,
    status: "in_cellar",
    notes: `Acquisition Receipt Capture: ${item.purchaseStory}. ${receipt.notes ?? ""}`.trim(),
    tags: ["acquisition-receipt", "receipt_scan", item.acquisitionTargetId ? "acquisition-closeout" : "cellar-intake"],
  };
}

export function receiptItemToPriceObservation(item: AcquisitionReceiptItem, inventoryId: string, receipt: AcquisitionReceipt): PriceObservation {
  return {
    id: `receipt-price-${inventoryId}-${item.id}`,
    inventoryId,
    wineReferenceId: null,
    sourceType: receipt.vendorType === "winery" ? "winery" : receipt.vendorType === "auction" ? "auction" : "retailer",
    sourceName: receipt.vendor,
    sourceUrl: null,
    observationKind: "purchase_price",
    truthLabel: "verified",
    reviewStatus: "accepted",
    observedPriceCents: item.unitPriceCents,
    currency: "USD",
    bottleSizeMl: null,
    vintage: item.vintage,
    confidence: 95,
    observedAt: `${receipt.purchaseDate}T12:00:00.000Z`,
    notes: `Verified purchase receipt: ${item.rawText}`,
    rawPayload: { receiptText: receipt.receiptText, item },
  };
}

export function receiptItemToTargetUpdate(item: AcquisitionReceiptItem): AcquisitionTargetReceiptUpdate {
  return {
    status: "acquired",
    acquiredQuantity: item.quantity,
    acquiredPriceCents: item.lineTotalCents,
  };
}
