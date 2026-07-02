import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Offline | Pourfolio",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="text-5xl">🍷</span>
      <h1 className="font-playfair text-3xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-md text-muted-foreground">
        No signal down here. Pages you&apos;ve already visited still work, and any
        captures you queue will sync automatically when you&apos;re back online.
      </p>
      <div className="flex gap-3 pt-2">
        <Button asChild>
          <Link href="/capture">Open Capture</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/cellar">Open Cellar</Link>
        </Button>
      </div>
    </div>
  );
}
