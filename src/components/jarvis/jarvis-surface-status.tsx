import { Activity, AlertTriangle, DatabaseZap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JarvisSurfaceStatus } from "@/lib/jarvis/types";

const statusStyles = {
  live: {
    icon: Activity,
    className: "border-emerald-200/80 bg-emerald-50/80 text-emerald-900",
  },
  demo: {
    icon: DatabaseZap,
    className: "border-amber-200/80 bg-amber-50/80 text-amber-900",
  },
  degraded: {
    icon: AlertTriangle,
    className: "border-red-200/80 bg-red-50/80 text-red-900",
  },
} as const;

export function JarvisSurfaceStatus({ status }: { status: JarvisSurfaceStatus }) {
  if (status.mode === "live") {
    return null;
  }

  const style = statusStyles[status.mode];
  const Icon = style.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-4", style.className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{status.title}</p>
        <p className="text-sm leading-6 opacity-90">{status.detail}</p>
      </div>
    </div>
  );
}
