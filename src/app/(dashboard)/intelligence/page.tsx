import { Suspense } from "react";
import Link from "next/link";
import { AcquisitionEnginePanel } from "@/components/wine/acquisition-engine-panel";
import { AcquisitionReceiptPanel } from "@/components/wine/acquisition-receipt-panel";
import { BuyAgainLane } from "@/components/wine/buy-again-lane";
import { CaptureCommandCard } from "@/components/wine/capture-command-card";
import { IntelligenceDeepLink } from "@/components/wine/intelligence-deep-link";
import { ReplenishmentAutomationPanel } from "@/components/wine/replenishment-automation-panel";
import { PortfolioRadarPanel } from "@/components/wine/portfolio-radar-panel";
import { TasteGenomeDashboard } from "@/components/wine/taste-genome-dashboard";
import { WineListAdvisor } from "@/components/wine/wine-list-advisor";
import { BOUGHT_WINE_INTAKE, boughtWineIntakeHref } from "@/lib/purchase-intake";

export const metadata = {
  title: "Intelligence | Pourfolio",
};

export default function PourfolioIntelligencePage() {
  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <IntelligenceDeepLink />
      </Suspense>
      <section className="rounded-[32px] border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm md:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Pourfolio Intelligence</p>
        <div className="mt-3 max-w-4xl space-y-3">
          <h1 className="font-playfair text-4xl font-semibold tracking-tight md:text-5xl">Taste, remember, buy, and choose wine better.</h1>
          <p className="text-lg leading-8 text-muted-foreground">Capture why Brian loves a bottle, mark 94+ wines as benchmarks, find more with sourced evidence, and rank restaurant lists against his real palate.</p>
          <div className="flex flex-wrap gap-2 pt-3 text-sm">
            <Link href={boughtWineIntakeHref()} className="rounded-full border border-primary/30 bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">{BOUGHT_WINE_INTAKE.primaryLabel}</Link>
            <Link href="#portfolio-radar" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Portfolio Radar</Link>
            <Link href="/capture" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Capture bottle</Link>
            <Link href="#buy-again" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Buy Again</Link>
            <Link href="#replenishment" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Replenishment</Link>
            <Link href="#acquisition-engine" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Acquisition Engine</Link>
            <Link href="/shopping#shopping-mode" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Shopping Mode</Link>
            <Link href="#acquisition-receipt" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Receipt Capture</Link>
            <Link href="#taste-genome" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Taste Genome</Link>
            <Link href="#restaurant-mode" className="rounded-full border bg-background/80 px-4 py-2 font-medium transition-colors hover:bg-accent">Restaurant Mode</Link>
          </div>
        </div>
      </section>
      <PortfolioRadarPanel />
      <CaptureCommandCard />
      <BuyAgainLane />
      <ReplenishmentAutomationPanel />
      <AcquisitionEnginePanel />
      <AcquisitionReceiptPanel />
      <TasteGenomeDashboard />
      <WineListAdvisor />
    </div>
  );
}
