import Link from "next/link";
import { ArrowUpRight, Brain, CircleAlert, Clock3, RefreshCw, Sparkles, Wine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CellarCommandCenter as CellarCommandCenterModel, CellarCommandItem } from "@/lib/cellar-command-center";
import type { TasteBottleAction } from "@/lib/taste-action-planner";

type CellarCommandCenterProps = {
  center: CellarCommandCenterModel;
  compact?: boolean;
};

const metricLabels = [
  { key: "readyNow", label: "Open now" },
  { key: "pastPeak", label: "At risk" },
  { key: "replace", label: "Replace" },
  { key: "needsSignal", label: "Learn" },
  { key: "missingMarketValues", label: "Price gaps" },
  { key: "recentUnreviewed", label: "New unreviewed" },
] as const;

export function CellarCommandCenter({ center, compact = false }: CellarCommandCenterProps) {
  return (
    <section className="rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 p-1 shadow-[0_24px_70px_-48px_rgba(120,24,40,0.42)]">
      <div className="rounded-[28px] bg-background/88 p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Cellar command center
            </div>
            <div>
              <h2 className="font-playfair text-3xl font-semibold tracking-tight sm:text-4xl">
                Tonight, risk, replacement, and learning — in one view.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {center.executiveBrief}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-3xl border border-border/60 bg-muted/20 p-4 lg:min-w-[320px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Best next move</div>
            <p className="text-sm font-medium leading-6 text-foreground">{center.bestNextMove}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {metricLabels.map((metric) => (
            <div key={metric.key} className="rounded-3xl border border-border/60 bg-background/90 p-4 shadow-sm">
              <div className="text-3xl font-semibold tracking-tight tabular-nums">{center.metrics[metric.key]}</div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>

        <div className={cn("mt-6 grid gap-4", compact ? "lg:grid-cols-2" : "xl:grid-cols-4")}>
          <CommandLane
            title="Drink now"
            description="Best candidates for tonight or the next near-term dinner."
            icon={<Wine className="h-4 w-4" />}
            items={center.lanes.drinkNow}
            empty="No clearly ready bottles yet. Add or tighten drink windows."
            tone="success"
          />
          <CommandLane
            title="At risk"
            description="Bottles past peak or demanding a decision soon."
            icon={<CircleAlert className="h-4 w-4" />}
            items={center.lanes.atRisk}
            empty="No past-peak bottles detected. Good cellar discipline."
            tone="warning"
          />
          <CommandLane
            title="Replace"
            description="Low-stock or high Brian-Fit bottles worth replenishing."
            icon={<RefreshCw className="h-4 w-4" />}
            items={center.lanes.replace}
            empty="No replacement pressure yet."
            tone="primary"
          />
          <CommandLane
            title="Learn next"
            description="Bottles that need first-party taste signal."
            icon={<Brain className="h-4 w-4" />}
            items={center.lanes.learn}
            empty="Every visible bottle has at least some memory. Excellent."
            tone="muted"
          />
        </div>

        <div className={cn("mt-4 grid gap-4", compact ? "lg:grid-cols-3" : "xl:grid-cols-3")}>
          <CommandLane
            title="Value without memory"
            description="Meaningful cellar value that still lacks a tasting read."
            icon={<Brain className="h-4 w-4" />}
            items={center.lanes.unlovedExpensive}
            empty="No expensive blind spots. The valuable bottles have memory."
            tone="warning"
          />
          <CommandLane
            title="Market gaps"
            description="Bottles where portfolio truth is held back by missing current value."
            icon={<Sparkles className="h-4 w-4" />}
            items={center.lanes.missingMarketValue}
            empty="No market-value gaps detected in the visible cellar."
            tone="primary"
          />
          <CommandLane
            title="New unreviewed"
            description="Recent additions that should be checked before they fade into inventory."
            icon={<Clock3 className="h-4 w-4" />}
            items={center.lanes.recentUnreviewed}
            empty="No recent additions waiting for review."
            tone="muted"
          />
        </div>

        <div className={cn("mt-4 grid gap-4", compact ? "lg:grid-cols-2" : "xl:grid-cols-4")}>
          <TasteActionLane
            title="Taste to confirm"
            description="Owned bottles that can prove or disprove a promising thin lane."
            items={center.tasteActions.tasteNext}
            empty="No owned bottles currently match thin-but-promising lanes."
          />
          <TasteActionLane
            title="Replace proven"
            description="Low-stock bottles tied to proven Brian taste lanes."
            items={center.tasteActions.replaceProven}
            empty="No proven taste lane is creating replacement pressure."
          />
          <TasteActionLane
            title="Retaste resolve"
            description="Expensive underperformers to confirm before avoiding or replacing."
            items={center.tasteActions.retasteResolve}
            empty="No expensive underperformer needs a taste decision."
          />
          <TasteActionLane
            title="Capture why"
            description="Rated bottles missing the structure signal the genome needs."
            items={center.tasteActions.captureSignal}
            empty="No rated bottles are missing structure signal."
          />
        </div>
      </div>
    </section>
  );
}

function TasteActionLane({
  title,
  description,
  items,
  empty,
}: {
  title: string;
  description: string;
  items: TasteBottleAction[];
  empty: string;
}) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-amber-500/20 bg-amber-500/5 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <Sparkles className="h-4 w-4" />
            </span>
            {title}
          </CardTitle>
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] tabular-nums">
            {items.length}
          </Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
            {empty}
          </div>
        ) : (
          items.slice(0, 3).map((item) => <TasteActionRow key={`${item.lane}-${item.bottleId}`} item={item} />)
        )}
      </CardContent>
    </Card>
  );
}

function TasteActionRow({ item }: { item: TasteBottleAction }) {
  return (
    <Link
      href={item.href}
      className="group block rounded-2xl border border-border/60 bg-background/80 p-3 transition-colors hover:border-amber-500/30 hover:bg-amber-500/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-medium leading-5 text-foreground group-hover:text-primary">
            {item.displayName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{item.action}</div>
        </div>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <Badge variant="secondary" className="mt-3 rounded-full px-2.5 py-1 text-[11px]">
        {item.evidence}
      </Badge>
      <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{item.reason}</p>
    </Link>
  );
}

function CommandLane({
  title,
  description,
  icon,
  items,
  empty,
  tone,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: CellarCommandItem[];
  empty: string;
  tone: "success" | "warning" | "primary" | "muted";
}) {
  const toneClass = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    primary: "border-primary/20 bg-primary/5 text-primary",
    muted: "border-border/60 bg-muted/30 text-muted-foreground",
  }[tone];

  return (
    <Card className="overflow-hidden rounded-[28px] border-border/60 bg-background/96 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base tracking-tight">
            <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border", toneClass)}>{icon}</span>
            {title}
          </CardTitle>
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] tabular-nums">
            {items.length}
          </Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
            {empty}
          </div>
        ) : (
          items.slice(0, 4).map((item) => <CommandWineRow key={item.id} item={item} />)
        )}
      </CardContent>
    </Card>
  );
}

function CommandWineRow({ item }: { item: CellarCommandItem }) {
  return (
    <Link
      href={item.href}
      className="group block rounded-2xl border border-border/60 bg-muted/10 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-sm font-medium leading-5 text-foreground group-hover:text-primary">
            {item.displayName}
          </div>
          <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {[item.producerName, item.regionName].filter(Boolean).join(" • ") || "Producer/region not captured"}
          </div>
        </div>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.brian_fit_score != null && (
          <Badge className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10">
            {item.brian_fit_score} Brian-Fit
          </Badge>
        )}
        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
          {item.quantity} {item.quantity === 1 ? "bottle" : "bottles"}
        </Badge>
        {item.readiness === "hold" && (
          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
            <Clock3 className="h-3 w-3" /> Hold
          </Badge>
        )}
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.reason}</p>
    </Link>
  );
}
