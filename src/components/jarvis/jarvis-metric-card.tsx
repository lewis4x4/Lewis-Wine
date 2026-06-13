import { Card, CardContent } from "@/components/ui/card";
import type { JarvisMetric } from "@/lib/jarvis/types";

export function JarvisMetricCard({ metric }: { metric: JarvisMetric }) {
  return (
    <Card className="border-border/70 bg-background/88 shadow-sm">
      <CardContent className="space-y-3 py-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {metric.label}
        </div>
        <div className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</div>
        <p className="text-sm leading-6 text-muted-foreground">{metric.detail}</p>
      </CardContent>
    </Card>
  );
}
