export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { VoiceTastingCapture } from "@/components/jarvis/voice-tasting-capture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getJarvisAccess } from "@/lib/jarvis/server";

export const metadata = {
  title: "Voice Capture | JARVIS",
};

export default async function JarvisVoiceCapturePage() {
  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    redirect("/login?redirect=%2Fjarvis%2Fvoice");
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <VoiceTastingCapture />
      </section>

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
            Voice capture standard
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm leading-7 text-muted-foreground md:grid-cols-3">
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-5">
            Speak naturally, but include vintage and producer when possible so the bottle match can be high-confidence.
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-5">
            JARVIS preserves the raw transcript in rating_signals.extracted_from_text so later Brian-Fit reads stay evidence-backed.
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted/30 p-5">
            Save only after the preview locks to a cellar bottle; ambiguous notes stay structured but unsaved.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
