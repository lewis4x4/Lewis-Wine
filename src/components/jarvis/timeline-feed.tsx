import {
  CheckCircle2,
  FileText,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getJarvisLaneMeta } from "@/lib/jarvis/constants";
import { formatJarvisDateTime, formatJarvisRelativeTime } from "@/lib/jarvis/format";
import type { JarvisTimelineGroup } from "@/lib/jarvis/types";
import { cn } from "@/lib/utils";

const eventTypeMeta = {
  capture: {
    label: "Capture",
    icon: FileText,
  },
  commitment: {
    label: "Commitment",
    icon: CheckCircle2,
  },
  decision: {
    label: "Decision",
    icon: Sparkles,
  },
  brief: {
    label: "Daily brief",
    icon: ScrollText,
  },
} as const;

export function TimelineFeed({ groups }: { groups: JarvisTimelineGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label} className="space-y-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-3">
            {group.items.map((item) => {
              const laneMeta = getJarvisLaneMeta(item.businessLane);
              const eventMeta = eventTypeMeta[item.eventType];
              const Icon = eventMeta.icon;

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-border/70 bg-background/85 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/60">
                        <Icon className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{eventMeta.label}</Badge>
                          <Badge variant="outline" className={cn(laneMeta.badgeClassName)}>
                            {laneMeta.label}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold tracking-tight text-foreground">
                            {item.headline}
                          </h3>
                          {item.summary ? (
                            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                              {item.summary}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground lg:text-right">
                      <p>{formatJarvisDateTime(item.happenedAt)}</p>
                      <p className="font-medium text-foreground">
                        {formatJarvisRelativeTime(item.happenedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
