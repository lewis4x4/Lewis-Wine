export type BoughtWineIntakeInput = {
  bottleCount?: number | null;
  hasReceipt?: boolean | null;
};

export type BoughtWineIntakeRoute = {
  href: string;
  reason: "receipt or order confirmation" | "multiple bottles" | "single bottle label capture";
};

export const BOUGHT_WINE_INTAKE = {
  primaryLabel: "Add Purchase",
  mobileLabel: "Purchase",
  shortDescription: "Receipt or label intake for newly purchased bottles.",
  receiptHref: "/intelligence?intake=purchase#acquisition-receipt",
  singleBottleHref: "/capture?intent=purchase&save_mode=add_to_cellar",
} as const;

export function chooseBoughtWineIntake(input: BoughtWineIntakeInput = {}): BoughtWineIntakeRoute {
  if (input.hasReceipt || (input.bottleCount == null && input.hasReceipt == null)) {
    return { href: BOUGHT_WINE_INTAKE.receiptHref, reason: "receipt or order confirmation" };
  }
  if ((input.bottleCount ?? 0) > 1) {
    return { href: BOUGHT_WINE_INTAKE.receiptHref, reason: "multiple bottles" };
  }
  return { href: BOUGHT_WINE_INTAKE.singleBottleHref, reason: "single bottle label capture" };
}

export function boughtWineIntakeHref(input: BoughtWineIntakeInput = {}) {
  return chooseBoughtWineIntake(input).href;
}
