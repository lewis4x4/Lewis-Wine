import { Badge } from "@/components/ui/badge";
import { getJarvisLaneMeta, getJarvisSourceTypeMeta } from "@/lib/jarvis/constants";
import { formatJarvisDateTime, formatJarvisRelativeTime } from "@/lib/jarvis/format";
import type { JarvisCaptureSummary } from "@/lib/jarvis/types";
import { cn } from "@/lib/utils";

export function CaptureList({
  captures,
  compact = false,
}: {
  captures: JarvisCaptureSummary[];
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {captures.map((capture) => {
        const laneMeta = getJarvisLaneMeta(capture.businessLane);
        const sourceMeta = getJarvisSourceTypeMeta(capture.sourceType);

        return (
          <div
            key={capture.id}
            className="rounded-3xl border border-border/70 bg-background/85 p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={laneMeta.badgeClassName}>
                    {laneMeta.label}
                  </Badge>
                  <Badge variant="outline">{sourceMeta.label}</Badge>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {capture.title}
                  </h3>
                  {capture.preview ? (
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {capture.preview}
                    </p>
                  ) : null}
                </div>
                {!compact && capture.participants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {capture.participants.map((participant) => (
                      <Badge key={participant} variant="secondary">
                        {participant}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={cn("space-y-2 text-sm text-muted-foreground", compact && "lg:text-right")}>
                <p>{formatJarvisDateTime(capture.happenedAt ?? capture.capturedAt)}</p>
                <p className="font-medium text-foreground">
                  {formatJarvisRelativeTime(capture.capturedAt)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
