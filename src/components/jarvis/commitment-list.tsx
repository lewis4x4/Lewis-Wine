import { Badge } from "@/components/ui/badge";
import {
  getJarvisCommitmentPriorityMeta,
  getJarvisCommitmentStatusMeta,
  getJarvisLaneMeta,
} from "@/lib/jarvis/constants";
import { formatJarvisDate, formatJarvisRelativeTime } from "@/lib/jarvis/format";
import type { JarvisCommitmentView } from "@/lib/jarvis/types";
import { cn } from "@/lib/utils";

export function CommitmentList({
  commitments,
  compact = false,
}: {
  commitments: JarvisCommitmentView[];
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {commitments.map((commitment) => {
        const laneMeta = getJarvisLaneMeta(commitment.businessLane);
        const statusMeta = getJarvisCommitmentStatusMeta(commitment.status);
        const priorityMeta = getJarvisCommitmentPriorityMeta(commitment.priority);

        return (
          <div
            key={commitment.id}
            className={cn(
              "rounded-3xl border border-border/70 bg-background/85 p-5 shadow-sm",
              commitment.isOverdue && "border-red-200 bg-red-50/50",
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={laneMeta.badgeClassName}>
                    {laneMeta.label}
                  </Badge>
                  <Badge variant="outline" className={statusMeta.badgeClassName}>
                    {statusMeta.label}
                  </Badge>
                  <Badge variant="outline" className={priorityMeta.badgeClassName}>
                    {priorityMeta.label}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {commitment.title}
                  </h3>
                  {commitment.description ? (
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                      {commitment.description}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={cn("space-y-2 text-sm text-muted-foreground", compact && "lg:text-right")}>
                <p>
                  Due{" "}
                  <span className="font-medium text-foreground">
                    {commitment.dueAt ? formatJarvisDate(commitment.dueAt) : "when ready"}
                  </span>
                </p>
                <p>
                  Updated{" "}
                  <span className="font-medium text-foreground">
                    {formatJarvisRelativeTime(commitment.updatedAt)}
                  </span>
                </p>
                {commitment.counterparty ? (
                  <p>
                    Counterparty{" "}
                    <span className="font-medium text-foreground">{commitment.counterparty}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {!compact && commitment.participants.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {commitment.participants.map((participant) => (
                  <Badge key={participant} variant="secondary">
                    {participant}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
