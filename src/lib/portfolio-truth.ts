export type PortfolioTruthWine = {
  id: string;
  name?: string | null;
  custom_name?: string | null;
  producer?: string | null;
  custom_producer?: string | null;
  region?: string | null;
  custom_region?: string | null;
  wine_type?: string | null;
  custom_wine_type?: string | null;
  quantity: number;
  purchase_price_cents?: number | null;
  current_market_value_cents?: number | null;
};

export type PortfolioConfidenceLevel = "empty" | "thin" | "developing" | "strong";

export type PortfolioConcentration = {
  name: string;
  bottles: number;
  valueCents: number;
  shareOfValue: number;
};

export type PortfolioUpdateAction = {
  id: string;
  displayName: string;
  reason: string;
  missing: "market-value" | "purchase-basis" | "purchase-and-market";
  estimatedValueCents: number;
  href: string;
};

export type PortfolioTruth = {
  totals: {
    totalBottles: number;
    uniqueWines: number;
    knownValueCents: number;
    estimatedValueCents: number;
    unknownBottles: number;
    displayValueCents: number;
  };
  coverage: {
    marketBottleCoverage: number;
    marketUniqueCoverage: number;
    valueCoverage: number;
    unknownBottleShare: number;
  };
  confidence: {
    level: PortfolioConfidenceLevel;
    label: string;
    reason: string;
  };
  performance: {
    costBasisCents: number;
    marketValueWithBasisCents: number;
    unrealizedGainLossCents: number;
    gainLossPercent: number;
  };
  concentration: {
    regions: PortfolioConcentration[];
    producers: PortfolioConcentration[];
    types: PortfolioConcentration[];
  };
  updateNext: PortfolioUpdateAction[];
  executiveBrief: string;
  bestNextMove: string;
};

function displayName(wine: PortfolioTruthWine) {
  const name = wine.name || wine.custom_name || "Unknown wine";
  return name;
}

function regionName(wine: PortfolioTruthWine) {
  return wine.region || wine.custom_region || "Unknown region";
}

function producerName(wine: PortfolioTruthWine) {
  return wine.producer || wine.custom_producer || "Unknown producer";
}

function typeName(wine: PortfolioTruthWine) {
  return wine.wine_type || wine.custom_wine_type || "Unknown type";
}

function valueForDisplay(wine: PortfolioTruthWine) {
  return wine.current_market_value_cents ?? wine.purchase_price_cents ?? 0;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function buildConcentration(
  wines: PortfolioTruthWine[],
  totalValueCents: number,
  keyFn: (wine: PortfolioTruthWine) => string
): PortfolioConcentration[] {
  const map = new Map<string, { bottles: number; valueCents: number }>();
  wines.forEach((wine) => {
    const key = keyFn(wine);
    const current = map.get(key) ?? { bottles: 0, valueCents: 0 };
    const bottleValue = valueForDisplay(wine) * Math.max(wine.quantity, 0);
    map.set(key, {
      bottles: current.bottles + Math.max(wine.quantity, 0),
      valueCents: current.valueCents + bottleValue,
    });
  });

  return [...map.entries()]
    .map(([name, data]) => ({
      name,
      bottles: data.bottles,
      valueCents: data.valueCents,
      shareOfValue: totalValueCents > 0 ? data.valueCents / totalValueCents : 0,
    }))
    .sort((a, b) => b.valueCents - a.valueCents || b.bottles - a.bottles || a.name.localeCompare(b.name));
}

function confidenceFor(marketBottleCoverage: number, valueCoverage: number, totalBottles: number) {
  if (totalBottles === 0) {
    return {
      level: "empty" as const,
      label: "No portfolio signal",
      reason: "No active bottles are available for valuation.",
    };
  }

  if (marketBottleCoverage >= 0.75 && valueCoverage >= 0.8) {
    return {
      level: "strong" as const,
      label: "Strong market truth",
      reason: `${percent(marketBottleCoverage)} of bottles have market value and ${percent(valueCoverage)} of displayed value is market-known.`,
    };
  }

  if (marketBottleCoverage >= 0.4 && valueCoverage >= 0.5) {
    return {
      level: "developing" as const,
      label: "Developing market truth",
      reason: `${percent(marketBottleCoverage)} of bottles have market value; update gaps before treating the total as precise.`,
    };
  }

  return {
    level: "thin" as const,
    label: "Thin market truth",
    reason: `Only ${percent(marketBottleCoverage)} of bottles have market value; the total leans on estimates and unknowns.`,
  };
}

function buildUpdateNext(wines: PortfolioTruthWine[]): PortfolioUpdateAction[] {
  return wines
    .filter((wine) => wine.quantity > 0)
    .filter((wine) => wine.current_market_value_cents == null || wine.purchase_price_cents == null)
    .map((wine) => {
      const estimatedValueCents = valueForDisplay(wine) * Math.max(wine.quantity, 0);
      const missingMarket = wine.current_market_value_cents == null;
      const missingPurchase = wine.purchase_price_cents == null;
      const missing = missingMarket && missingPurchase
        ? "purchase-and-market" as const
        : missingMarket
          ? "market-value" as const
          : "purchase-basis" as const;
      const reason = missing === "purchase-and-market"
        ? "Missing purchase and market value, so portfolio truth cannot price it."
        : missing === "market-value"
          ? "Missing market value on meaningful estimated value."
          : "Missing purchase basis, so performance and gain/loss cannot be trusted.";
      return {
        id: wine.id,
        displayName: displayName(wine),
        reason,
        missing,
        estimatedValueCents,
        href: `/cellar/${wine.id}`,
      };
    })
    .sort((a, b) => b.estimatedValueCents - a.estimatedValueCents || a.displayName.localeCompare(b.displayName))
    .slice(0, 6);
}

export function buildPortfolioTruth(wines: PortfolioTruthWine[]): PortfolioTruth {
  const active = wines.filter((wine) => wine.quantity > 0);
  const totalBottles = active.reduce((sum, wine) => sum + wine.quantity, 0);
  const uniqueWines = active.length;

  const knownValueCents = active.reduce(
    (sum, wine) => sum + (wine.current_market_value_cents ?? 0) * wine.quantity,
    0
  );
  const estimatedValueCents = active.reduce(
    (sum, wine) => sum + (wine.current_market_value_cents == null ? (wine.purchase_price_cents ?? 0) * wine.quantity : 0),
    0
  );
  const unknownBottles = active.reduce(
    (sum, wine) => sum + (wine.current_market_value_cents == null && wine.purchase_price_cents == null ? wine.quantity : 0),
    0
  );
  const displayValueCents = knownValueCents + estimatedValueCents;
  const marketBottles = active.reduce((sum, wine) => sum + (wine.current_market_value_cents != null ? wine.quantity : 0), 0);
  const marketUnique = active.filter((wine) => wine.current_market_value_cents != null).length;

  const performanceWines = active.filter((wine) => wine.current_market_value_cents != null && wine.purchase_price_cents != null);
  const costBasisCents = performanceWines.reduce((sum, wine) => sum + (wine.purchase_price_cents ?? 0) * wine.quantity, 0);
  const marketValueWithBasisCents = performanceWines.reduce((sum, wine) => sum + (wine.current_market_value_cents ?? 0) * wine.quantity, 0);
  const unrealizedGainLossCents = marketValueWithBasisCents - costBasisCents;
  const gainLossPercent = costBasisCents > 0 ? unrealizedGainLossCents / costBasisCents : 0;

  const coverage = {
    marketBottleCoverage: totalBottles > 0 ? marketBottles / totalBottles : 0,
    marketUniqueCoverage: uniqueWines > 0 ? marketUnique / uniqueWines : 0,
    valueCoverage: displayValueCents > 0 ? knownValueCents / displayValueCents : 0,
    unknownBottleShare: totalBottles > 0 ? unknownBottles / totalBottles : 0,
  };

  const confidence = confidenceFor(coverage.marketBottleCoverage, coverage.valueCoverage, totalBottles);
  const concentration = {
    regions: buildConcentration(active, displayValueCents, regionName).slice(0, 5),
    producers: buildConcentration(active, displayValueCents, producerName).slice(0, 5),
    types: buildConcentration(active, displayValueCents, typeName).slice(0, 5),
  };
  const updateNext = buildUpdateNext(active);

  const executiveBrief = totalBottles === 0
    ? "No active bottles are available for portfolio truth yet."
    : `${formatCurrency(displayValueCents)} displayed value: ${formatCurrency(knownValueCents)} market-known, ${formatCurrency(estimatedValueCents)} estimated, ${unknownBottles} unpriced bottle${unknownBottles === 1 ? "" : "s"}.`;
  const bestNextMove = updateNext[0]
    ? `Update ${updateNext[0].displayName}: ${updateNext[0].reason}`
    : confidence.level === "strong"
      ? "Portfolio truth is strong; use concentration and gain/loss to guide drink, hold, and buy-more decisions."
      : "Add market values to the highest-value bottles so the portfolio total becomes decision-grade.";

  return {
    totals: {
      totalBottles,
      uniqueWines,
      knownValueCents,
      estimatedValueCents,
      unknownBottles,
      displayValueCents,
    },
    coverage,
    confidence,
    performance: {
      costBasisCents,
      marketValueWithBasisCents,
      unrealizedGainLossCents,
      gainLossPercent,
    },
    concentration,
    updateNext,
    executiveBrief,
    bestNextMove,
  };
}
