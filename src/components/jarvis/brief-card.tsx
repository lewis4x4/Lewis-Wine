import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getJarvisDecisionImpactMeta,
  getJarvisDecisionStatusMeta,
  getJarvisLaneMeta,
} from "@/lib/jarvis/constants";
import { formatJarvisDate } from "@/lib/jarvis/format";
import type { JarvisBriefView, JarvisDecisionView } from "@/lib/jarvis/types";

export function BriefCard({
  brief,
  decisions,
}: {
  brief: JarvisBriefView;
  decisions: JarvisDecisionView[];
}) {
  return (
    <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Latest briefing
            </div>
            <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
              {brief.title}
            </CardTitle>
          </div>
          <Badge variant="outline">{formatJarvisDate(brief.briefDate)}</Badge>
        </div>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{brief.summary}</p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_1.15fr]">
        <BriefList
          eyebrow="Priorities"
          items={brief.priorities}
          emptyLabel="No explicit priorities captured yet."
        />
        <BriefList
          eyebrow="Blockers"
          items={brief.blockers}
          emptyLabel="No blockers are currently logged."
        />
        <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/30 p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Watch items
          </div>
          {brief.watchItems.length > 0 ? (
            <ul className="space-y-3 text-sm leading-6 text-foreground">
              {brief.watchItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No watch items have been published yet.</p>
          )}

          {decisions.length > 0 ? (
            <div className="space-y-3 border-t border-border/70 pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Decision stack
              </div>
              <div className="space-y-3">
                {decisions.map((decision) => {
                  const laneMeta = getJarvisLaneMeta(decision.businessLane);
                  const statusMeta = getJarvisDecisionStatusMeta(decision.status);
                  const impactMeta = getJarvisDecisionImpactMeta(decision.impactLevel);

                  return (
                    <div key={decision.id} className="space-y-2 rounded-2xl border border-border/70 bg-background/80 p-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={laneMeta.badgeClassName}>
                          {laneMeta.label}
                        </Badge>
                        <Badge variant="outline">{statusMeta.label}</Badge>
                        <Badge variant="outline">{impactMeta.label}</Badge>
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{decision.title}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{decision.summary}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BriefList({
  eyebrow,
  items,
  emptyLabel,
}: {
  eyebrow: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/30 p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-3 text-sm leading-6 text-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
