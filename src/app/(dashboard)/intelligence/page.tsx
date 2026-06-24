import { BuyAgainLane } from "@/components/wine/buy-again-lane";
import { GreatWineCapture } from "@/components/wine/great-wine-capture";
import { TasteGenomeDashboard } from "@/components/wine/taste-genome-dashboard";
import { WineListAdvisor } from "@/components/wine/wine-list-advisor";

export const metadata = {
  title: "Intelligence | Pourfolio",
};

export default function PourfolioIntelligencePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-border/70 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm md:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary">Pourfolio Intelligence</p>
        <div className="mt-3 max-w-4xl space-y-3">
          <h1 className="font-playfair text-4xl font-semibold tracking-tight md:text-5xl">Taste, remember, buy, and choose wine better.</h1>
          <p className="text-lg leading-8 text-muted-foreground">Capture why Brian loves a bottle, mark 94+ wines as benchmarks, find more with sourced evidence, and rank restaurant lists against his real palate.</p>
        </div>
      </section>
      <GreatWineCapture />
      <BuyAgainLane />
      <TasteGenomeDashboard />
      <WineListAdvisor />
    </div>
  );
}
