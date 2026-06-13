import { JarvisNav } from "@/components/jarvis/jarvis-nav";

export default function JarvisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="rounded-[32px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 px-7 py-8 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              JARVIS Memory OS
            </div>
            <div className="max-w-3xl space-y-3">
              <h1 className="font-playfair text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Keep the operating context live.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                A quiet executive layer for canonical capture, commitments, timeline memory, and the daily brief. Built inside Pourfolio without disturbing the wine product.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-border/70 bg-background/88 p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Capture discipline
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">
                One intake path for notes, transcripts, and manual memory so evidence lands in the same system every time.
              </p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/88 p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Operating truth
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Commitments, decisions, and daily brief context stay queryable instead of dissolving into chat history.
              </p>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/88 p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Phase 1 scope
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">
                This slice is intentionally narrow: capture, commitments, timeline, and briefing with safe Supabase fallbacks.
              </p>
            </div>
          </div>

          <JarvisNav />
        </div>
      </section>

      {children}
    </div>
  );
}
