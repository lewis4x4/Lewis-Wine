import type { AcquisitionPriority, AcquisitionSourceKind, AcquisitionStatus } from "./acquisition-engine";

export type ReplenishmentInventoryStatus = "in_cellar" | "consumed" | "gifted" | "sold";
export type ReplenishmentUrgency = "now" | "soon" | "watch";
export type ReplenishmentReasonCode = "liked_consumed" | "low_stock_liked" | "low_stock" | "recently_acquired";

export type ReplenishmentInventorySignal = {
  id: string;
  wineReferenceId?: string | null;
  wineTitle: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
  quantity: number;
  lowStockThreshold?: number | null;
  lowStockAlertEnabled?: boolean | null;
  status: ReplenishmentInventoryStatus;
  consumedDate?: string | null;
  purchasePriceCents?: number | null;
  purchaseLocation?: string | null;
};

export type ReplenishmentRatingSignal = {
  id: string;
  inventoryId?: string | null;
  wineReferenceId?: string | null;
  score: number;
  tastingDate?: string | null;
  notes?: string | null;
};

export type ReplenishmentTastingSignal = {
  id: string;
  inventoryId?: string | null;
  wineReferenceId?: string | null;
  wineTitle: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
  score?: number | null;
  buyAgain?: "yes" | "no" | "maybe" | "cellar_only" | null;
  tastedAt?: string | null;
  notes?: string | null;
};

export type ReplenishmentAcquiredSignal = {
  id: string;
  inventoryId?: string | null;
  wineReferenceId?: string | null;
  wineTitle: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
  acquiredQuantity?: number | null;
  acquiredPriceCents?: number | null;
  acquiredAt?: string | null;
};

export type ExistingAcquisitionTargetSignal = {
  id: string;
  inventoryId?: string | null;
  wineReferenceId?: string | null;
  status: AcquisitionStatus;
};

export type ReplenishmentAutomationInput = {
  inventory: ReplenishmentInventorySignal[];
  ratings?: ReplenishmentRatingSignal[];
  tastings?: ReplenishmentTastingSignal[];
  acquiredTargets?: ReplenishmentAcquiredSignal[];
  existingTargets?: ExistingAcquisitionTargetSignal[];
  asOf?: string;
};

export type ReplenishmentPrompt = {
  id: string;
  inventoryId?: string | null;
  wineReferenceId?: string | null;
  wineTitle: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
  quantityOnHand: number;
  lowStockThreshold?: number | null;
  urgency: ReplenishmentUrgency;
  score?: number | null;
  buyAgain?: ReplenishmentTastingSignal["buyAgain"];
  lastSignalAt?: string | null;
  targetPriceCents?: number | null;
  desiredQuantity: number;
  reasonCodes: ReplenishmentReasonCode[];
  reasons: string[];
  suppressedReason?: "already_on_acquisition_board" | null;
};

export type ReplenishmentAutomation = {
  lanes: {
    buyAgainNow: ReplenishmentPrompt[];
    refillPrompts: ReplenishmentPrompt[];
    watch: ReplenishmentPrompt[];
    suppressed: ReplenishmentPrompt[];
  };
  summary: {
    totalSignals: number;
    buyAgainNowCount: number;
    refillPromptCount: number;
    watchCount: number;
    suppressedCount: number;
  };
};

export type ReplenishmentAcquisitionTargetPayload = {
  wineTitle: string;
  producer?: string | null;
  vintage?: number | null;
  region?: string | null;
  varietal?: string | null;
  wineReferenceId?: string | null;
  inventoryId?: string | null;
  sourceKind: AcquisitionSourceKind;
  sourceId: string;
  status: AcquisitionStatus;
  priority: AcquisitionPriority;
  desiredQuantity: number;
  targetPriceCents?: number | null;
  maxPriceCents?: number | null;
  notes: string;
};

const LIKED_SCORE = 90;
const WATCH_SCORE = 85;

function dateTime(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function wineKey(value: { inventoryId?: string | null; wineReferenceId?: string | null; wineTitle?: string | null; producer?: string | null; vintage?: number | null }) {
  if (value.inventoryId) return `inventory:${value.inventoryId}`;
  if (value.wineReferenceId) return `reference:${value.wineReferenceId}`;
  return `name:${[value.producer, value.vintage, value.wineTitle].filter(Boolean).join("|").toLowerCase()}`;
}

function isActiveTarget(target: ExistingAcquisitionTargetSignal) {
  return target.status === "watching" || target.status === "buy_now" || target.status === "ordered";
}

function bestRatingFor(inventory: ReplenishmentInventorySignal, ratings: ReplenishmentRatingSignal[]) {
  return ratings
    .filter((rating) => rating.inventoryId === inventory.id || (inventory.wineReferenceId && rating.wineReferenceId === inventory.wineReferenceId))
    .sort((a, b) => (b.score - a.score) || (dateTime(b.tastingDate) - dateTime(a.tastingDate)))[0] ?? null;
}

function bestTastingFor(inventory: ReplenishmentInventorySignal, tastings: ReplenishmentTastingSignal[]) {
  return tastings
    .filter((tasting) => tasting.inventoryId === inventory.id || (inventory.wineReferenceId && tasting.wineReferenceId === inventory.wineReferenceId) || tasting.wineTitle === inventory.wineTitle)
    .sort((a, b) => ((b.score ?? 0) - (a.score ?? 0)) || (dateTime(b.tastedAt) - dateTime(a.tastedAt)))[0] ?? null;
}

function liked(score?: number | null, buyAgain?: ReplenishmentTastingSignal["buyAgain"]) {
  return buyAgain === "yes" || (score ?? 0) >= LIKED_SCORE;
}

function createPrompt(params: {
  inventory: ReplenishmentInventorySignal;
  rating?: ReplenishmentRatingSignal | null;
  tasting?: ReplenishmentTastingSignal | null;
  reasonCodes: ReplenishmentReasonCode[];
  urgency: ReplenishmentUrgency;
  desiredQuantity?: number;
  suppressedReason?: ReplenishmentPrompt["suppressedReason"];
}): ReplenishmentPrompt {
  const score = Math.max(params.rating?.score ?? 0, params.tasting?.score ?? 0) || null;
  const reasons: string[] = [];
  if (params.reasonCodes.includes("liked_consumed")) reasons.push("Brian liked consumed bottle; it is eligible for a buy-again prompt.");
  if (params.reasonCodes.includes("low_stock_liked")) reasons.push("Low stock on a bottle with strong tasting evidence.");
  if (params.reasonCodes.includes("low_stock")) reasons.push("Low-stock alert threshold has been reached.");
  if (params.reasonCodes.includes("recently_acquired")) reasons.push("Recent acquisition gives Pourfolio a verified replenishment baseline.");
  if (params.inventory.purchaseLocation) reasons.push(`Last known source: ${params.inventory.purchaseLocation}.`);
  if (score) reasons.push(`Best personal score: ${score}/100.`);
  if (params.suppressedReason === "already_on_acquisition_board") reasons.push("Already has an active Acquisition Engine target.");

  return {
    id: `${params.inventory.id}:${params.reasonCodes.join("+")}`,
    inventoryId: params.inventory.id,
    wineReferenceId: params.inventory.wineReferenceId ?? null,
    wineTitle: params.inventory.wineTitle,
    producer: params.inventory.producer ?? null,
    vintage: params.inventory.vintage ?? null,
    region: params.inventory.region ?? null,
    varietal: params.inventory.varietal ?? null,
    quantityOnHand: params.inventory.quantity,
    lowStockThreshold: params.inventory.lowStockThreshold ?? null,
    urgency: params.urgency,
    score,
    buyAgain: params.tasting?.buyAgain ?? null,
    lastSignalAt: params.tasting?.tastedAt ?? params.rating?.tastingDate ?? params.inventory.consumedDate ?? null,
    targetPriceCents: params.inventory.purchasePriceCents ?? null,
    desiredQuantity: params.desiredQuantity ?? Math.max(1, params.inventory.lowStockThreshold ?? 2),
    reasonCodes: params.reasonCodes,
    reasons,
    suppressedReason: params.suppressedReason ?? null,
  };
}

function sortPrompts(a: ReplenishmentPrompt, b: ReplenishmentPrompt) {
  const urgencyWeight = { now: 3, soon: 2, watch: 1 } satisfies Record<ReplenishmentUrgency, number>;
  const urgencyDelta = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
  if (urgencyDelta) return urgencyDelta;
  const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
  if (scoreDelta) return scoreDelta;
  return dateTime(b.lastSignalAt) - dateTime(a.lastSignalAt);
}

export function buildReplenishmentAutomation(input: ReplenishmentAutomationInput): ReplenishmentAutomation {
  const ratings = input.ratings ?? [];
  const tastings = input.tastings ?? [];
  const activeTargetKeys = new Set((input.existingTargets ?? []).filter(isActiveTarget).map(wineKey));
  const acquiredByKey = new Map((input.acquiredTargets ?? []).map((target) => [wineKey(target), target]));
  const buyAgainNow = new Map<string, ReplenishmentPrompt>();
  const refillPrompts: ReplenishmentPrompt[] = [];
  const watch: ReplenishmentPrompt[] = [];
  const suppressed: ReplenishmentPrompt[] = [];
  let totalSignals = 0;

  for (const inventory of input.inventory) {
    const key = wineKey({ inventoryId: inventory.id, wineReferenceId: inventory.wineReferenceId, wineTitle: inventory.wineTitle, producer: inventory.producer, vintage: inventory.vintage });
    const referenceKey = wineKey({ wineReferenceId: inventory.wineReferenceId, wineTitle: inventory.wineTitle, producer: inventory.producer, vintage: inventory.vintage });
    const rating = bestRatingFor(inventory, ratings);
    const tasting = bestTastingFor(inventory, tastings);
    const bestScore = Math.max(rating?.score ?? 0, tasting?.score ?? 0) || null;
    const isLiked = liked(bestScore, tasting?.buyAgain);
    const lowStock = Boolean(inventory.lowStockAlertEnabled && inventory.lowStockThreshold != null && inventory.quantity <= inventory.lowStockThreshold);
    const alreadyOnBoard = activeTargetKeys.has(key) || activeTargetKeys.has(referenceKey);
    const acquired = acquiredByKey.get(key) ?? acquiredByKey.get(referenceKey);

    if (lowStock) {
      totalSignals += 1;
      const prompt = createPrompt({
        inventory,
        rating,
        tasting,
        reasonCodes: [isLiked ? "low_stock_liked" : "low_stock"],
        urgency: isLiked ? "now" : "soon",
        suppressedReason: alreadyOnBoard ? "already_on_acquisition_board" : null,
      });
      if (alreadyOnBoard) suppressed.push(prompt);
      else {
        refillPrompts.push(prompt);
        if (isLiked) buyAgainNow.set(inventory.id, prompt);
      }
    }

    if (inventory.status === "consumed" && isLiked) {
      totalSignals += 1;
      const prompt = createPrompt({
        inventory,
        rating,
        tasting,
        reasonCodes: ["liked_consumed"],
        urgency: "now",
        desiredQuantity: 2,
        suppressedReason: alreadyOnBoard ? "already_on_acquisition_board" : null,
      });
      if (alreadyOnBoard) suppressed.push(prompt);
      else buyAgainNow.set(inventory.id, prompt);
    }

    if (acquired) {
      totalSignals += 1;
      if (!buyAgainNow.has(inventory.id) && !alreadyOnBoard) {
        watch.push(createPrompt({
          inventory,
          rating,
          tasting,
          reasonCodes: ["recently_acquired"],
          urgency: "watch",
          desiredQuantity: Math.max(1, acquired.acquiredQuantity ?? 1),
        }));
      }
    }

    if (!lowStock && inventory.status !== "consumed" && !acquired && bestScore != null && bestScore >= WATCH_SCORE && !alreadyOnBoard) {
      watch.push(createPrompt({ inventory, rating, tasting, reasonCodes: ["low_stock_liked"], urgency: "watch" }));
    }
  }

  const buyAgainNowItems = [...buyAgainNow.values()].sort(sortPrompts);
  return {
    lanes: {
      buyAgainNow: buyAgainNowItems,
      refillPrompts: refillPrompts.sort(sortPrompts),
      watch: watch.sort(sortPrompts),
      suppressed: suppressed.sort(sortPrompts),
    },
    summary: {
      totalSignals,
      buyAgainNowCount: buyAgainNowItems.length,
      refillPromptCount: refillPrompts.length,
      watchCount: watch.length,
      suppressedCount: suppressed.length,
    },
  };
}

export function replenishmentPromptToAcquisitionTarget(prompt: ReplenishmentPrompt): ReplenishmentAcquisitionTargetPayload {
  const strong = prompt.urgency === "now" || (prompt.score ?? 0) >= LIKED_SCORE || prompt.buyAgain === "yes";
  const reasonText = prompt.reasonCodes.map((code) => code.replace(/_/g, " ")).join(", ");
  return {
    wineTitle: prompt.wineTitle,
    producer: prompt.producer ?? null,
    vintage: prompt.vintage ?? null,
    region: prompt.region ?? null,
    varietal: prompt.varietal ?? null,
    wineReferenceId: prompt.wineReferenceId ?? null,
    inventoryId: prompt.inventoryId ?? null,
    sourceKind: "replenishment",
    sourceId: prompt.inventoryId ?? prompt.wineReferenceId ?? prompt.id,
    status: strong ? "buy_now" : "watching",
    priority: strong ? "must_have" : "medium",
    desiredQuantity: prompt.desiredQuantity,
    targetPriceCents: prompt.targetPriceCents ?? null,
    maxPriceCents: prompt.targetPriceCents ? Math.round(prompt.targetPriceCents * 1.15) : null,
    notes: `Replenishment Automation: ${reasonText}. ${prompt.reasons.join(" ")}`,
  };
}
