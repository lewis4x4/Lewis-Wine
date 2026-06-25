import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, Repeat2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BOUGHT_WINE_INTAKE, boughtWineIntakeHref } from "@/lib/purchase-intake";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CaptureCommandCard() {
  return (
    <Card className="rounded-[28px] border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Badge className="w-fit rounded-full">Canonical capture path</Badge>
            <CardTitle className="flex items-center gap-2 font-playfair text-3xl">
              <Camera className="h-7 w-7 text-primary" />
              Capture bottle memory in the field
            </CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Use the mobile-first capture flow for real bottle photos, review-before-save tasting memory,
              benchmark detection, and immediate downstream actions. This replaces the old demo-only capture panel.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
            <Button asChild className="rounded-full">
              <Link href="/capture">
                Open Capture
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="rounded-full">
              <Link href={boughtWineIntakeHref()}>
                {BOUGHT_WINE_INTAKE.primaryLabel}
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-background/75 p-4">
            <Camera className="mb-3 h-5 w-5 text-primary" />
            <div className="font-semibold">Photo → review</div>
            <p className="mt-1 text-sm text-muted-foreground">Bottle image extraction stays behind the protected Supabase capture-wine function.</p>
          </div>
          <div className="rounded-2xl border bg-background/75 p-4">
            <CheckCircle2 className="mb-3 h-5 w-5 text-primary" />
            <div className="font-semibold">Human-approved memory</div>
            <p className="mt-1 text-sm text-muted-foreground">Nothing becomes Pourfolio truth until Brian reviews score, descriptors, buy-again intent, and notes.</p>
          </div>
          <div className="rounded-2xl border bg-background/75 p-4">
            <Repeat2 className="mb-3 h-5 w-5 text-primary" />
            <div className="font-semibold">Immediate next action</div>
            <p className="mt-1 text-sm text-muted-foreground">Benchmark and buy-again signals route into Bottle Intelligence, Buy Again, and acquisition workflows.</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-primary/5 p-4 text-sm text-primary">
          <Sparkles className="mr-2 inline h-4 w-4" />
          Purchase intake now routes through receipt closeout first, with single-bottle label capture still available when you only have a bottle photo.
        </div>
      </CardContent>
    </Card>
  );
}
