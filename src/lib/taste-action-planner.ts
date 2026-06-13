import type { TasteGenome, TasteGenomeAction } from "./taste-genome";

export type TasteActionBottle = {
  id: string;
  name?: string | null;
  custom_name?: string | null;
  producer?: string | null;
  custom_producer?: string | null;
  region?: string | null;
  custom_region?: string | null;
  wine_type?: string | null;
  custom_wine_type?: string | null;
  vintage?: number | null;
  custom_vintage?: number | null;
  quantity: number;
  ratings_count?: number | null;
  rating_signal_count?: number | null;
  purchase_price_cents?: number | null;
  current_market_value_cents?: number | null;
  brian_fit_score?: number | null;
};

export type TasteBottleActionLane = "taste-next" | "replace-proven" | "retaste-resolve" | "capture-signal";

export type TasteBottleAction = {
  lane: TasteBottleActionLane;
  bottleId: string;
  displayName: string;
  action: string;
  reason: string;
  evidence: string;
  href: string;
  priority: number;
};

export type TasteBottleActionPlan = {
  tasteNext: TasteBottleAction[];
  replaceProven: TasteBottleAction[];
  retasteResolve: TasteBottleAction[];
  captureSignal: TasteBottleAction[];
};

function displayName(bottle: TasteActionBottle) {
  const name = bottle.name || bottle.custom_name || "Unknown wine";
  const vintage = bottle.vintage || bottle.custom_vintage;
  return vintage ? `${vintage} ${name}` : name;
}

function producerName(bottle: TasteActionBottle) {
  return bottle.producer || bottle.custom_producer || null;
}

function regionName(bottle: TasteActionBottle) {
  return bottle.region || bottle.custom_region || null;
}

function wineTypeName(bottle: TasteActionBottle) {
  return bottle.wine_type || bottle.custom_wine_type || null;
}

function normalized(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function bottleMatchesTarget(bottle: TasteActionBottle, target: string) {
  const needle = normalized(target);
  return [regionName(bottle), wineTypeName(bottle), producerName(bottle)]
    .map(normalized)
    .some((candidate) => candidate === needle || (candidate.length > 0 && needle.includes(candidate)));
}

function scoreBottleForAction(bottle: TasteActionBottle) {
  return (bottle.brian_fit_score ?? 0) + Math.min(bottle.quantity, 4) + ((bottle.ratings_count ?? 0) === 0 ? 10 : 0);
}

function actionForBottle(params: {
  lane: TasteBottleActionLane;
  bottle: TasteActionBottle;
  source: TasteGenomeAction;
  action: string;
  reason: string;
  priority: number;
}): TasteBottleAction {
  const { lane, bottle, source, action, reason, priority } = params;
  return {
    lane,
    bottleId: bottle.id,
    displayName: displayName(bottle),
    action,
    reason,
    evidence: source.evidence,
    href: `/cellar/${bottle.id}`,
    priority: priority + scoreBottleForAction(bottle),
  };
}

function uniqueByBottle(actions: TasteBottleAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.lane}:${action.bottleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function byPriority(a: TasteBottleAction, b: TasteBottleAction) {
  return b.priority - a.priority || a.displayName.localeCompare(b.displayName);
}

export function buildTasteBottleActions({
  genome,
  bottles,
  laneLimit = 4,
}: {
  genome: TasteGenome;
  bottles: TasteActionBottle[];
  laneLimit?: number;
}): TasteBottleActionPlan {
  const owned = bottles.filter((bottle) => bottle.quantity > 0);

  const tasteNext = uniqueByBottle(
    genome.actionPlan.compareNext.flatMap((source) =>
      owned
        .filter((bottle) => bottleMatchesTarget(bottle, source.target))
        .filter((bottle) => (bottle.ratings_count ?? 0) === 0)
        .map((bottle) => actionForBottle({
          lane: "taste-next",
          bottle,
          source,
          action: "Taste next",
          reason: `${source.target} is thin but promising; taste this owned bottle before treating the lane as proven.`,
          priority: 80,
        }))
    )
  ).sort(byPriority).slice(0, laneLimit);

  const replaceProven = uniqueByBottle(
    genome.actionPlan.buyMore.flatMap((source) =>
      owned
        .filter((bottle) => bottleMatchesTarget(bottle, source.target))
        .filter((bottle) => bottle.quantity <= 1)
        .map((bottle) => actionForBottle({
          lane: "replace-proven",
          bottle,
          source,
          action: "Replace proven favorite",
          reason: `${source.target} is a proven Brian lane and this owned bottle is low stock.`,
          priority: 70,
        }))
    )
  ).sort(byPriority).slice(0, laneLimit);

  const retasteResolve = uniqueByBottle(
    genome.actionPlan.watchlist.flatMap((source) =>
      owned
        .filter((bottle) => bottleMatchesTarget(bottle, source.target) || normalized(displayName(bottle)) === normalized(source.target))
        .map((bottle) => actionForBottle({
          lane: "retaste-resolve",
          bottle,
          source,
          action: "Retaste before replacing",
          reason: `${source.target} is an expensive underperformer; retaste or confirm before avoiding the whole lane.`,
          priority: 75,
        }))
    )
  ).sort(byPriority).slice(0, laneLimit);

  const captureSignal = owned
    .filter((bottle) => (bottle.ratings_count ?? 0) > 0 && (bottle.rating_signal_count ?? 0) === 0)
    .map((bottle) => ({
      lane: "capture-signal" as const,
      bottleId: bottle.id,
      displayName: displayName(bottle),
      action: "Capture structure signal",
      reason: "This bottle has a rating but no structural signal, so it cannot teach the Taste Genome why it worked.",
      evidence: `${bottle.ratings_count ?? 0} rating${(bottle.ratings_count ?? 0) === 1 ? "" : "s"} · 0 structure signals`,
      href: `/cellar/${bottle.id}`,
      priority: 60 + (bottle.brian_fit_score ?? 0),
    }))
    .sort(byPriority)
    .slice(0, laneLimit);

  return { tasteNext, replaceProven, retasteResolve, captureSignal };
}
