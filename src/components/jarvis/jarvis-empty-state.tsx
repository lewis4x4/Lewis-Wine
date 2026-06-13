import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JarvisEmptyStateProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function JarvisEmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: JarvisEmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-border/80 bg-background/70 px-6 py-8 text-center">
      <div className="mx-auto max-w-xl space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Memory signal is thin
        </p>
        <h3 className="font-playfair text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        {actionHref && actionLabel ? (
          <Button asChild className="mt-2 rounded-full px-5">
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
