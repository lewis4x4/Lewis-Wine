"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ClipboardList, HelpCircle, Loader2, RefreshCw, Search, Sparkles, Wine, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  buildCaptureFollowUpHint,
  buildCaptureWineRequest,
  buildReviewDraft,
  canSaveFieldCaptureDraft,
  createPostSaveActions,
  shouldEnterCaptureFollowUp,
  tapizDemoCandidate,
  type BuyAgain,
  type CaptureWineCandidate,
  type CaptureWineResponse,
  type FieldCaptureSaveMode,
  type ReviewDraft,
} from "@/lib/field-capture";

type FieldCaptureExperienceProps = {
  initialDemo?: boolean;
  inventoryId?: string | null;
};

const initialScore = 95;
const initialBuyAgain: BuyAgain = "yes";
const initialOccasion = "best wines ever — reference Cab";
const initialDescriptors = "smooth, rich, long finish";
const initialNotes = "One of the best wines ever.";

type Stage = "photo" | "follow_up" | "review" | "saving" | "done";

type SaveResult = {
  wine: { id: string; producer?: string | null; label?: string | null; vintage?: number | null };
  tasting: { id: string; wine_id: string; is_benchmark: boolean; buy_again: BuyAgain };
  inventory?: { id: string } | null;
  rating?: { id: string } | null;
};

function dataUrlFromFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function FieldValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-2xl border bg-background/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "—"}</div>
    </div>
  );
}

export function FieldCaptureExperience({ initialDemo = false, inventoryId = null }: FieldCaptureExperienceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>(initialDemo ? "review" : "photo");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CaptureWineCandidate | null>(initialDemo ? tapizDemoCandidate : null);
  const [score, setScore] = useState<number | null>(initialScore);
  const [buyAgain, setBuyAgain] = useState<BuyAgain>(initialBuyAgain);
  const [occasion, setOccasion] = useState(initialOccasion);
  const [descriptors, setDescriptors] = useState(initialDescriptors);
  const [notes, setNotes] = useState(initialNotes);
  const [saveMode, setSaveMode] = useState<FieldCaptureSaveMode>(inventoryId ? "link_existing_inventory" : "memory_only");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpAsked, setFollowUpAsked] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const draft: ReviewDraft | null = candidate
    ? {
        ...buildReviewDraft(candidate, { score, buy_again: buyAgain, occasion, descriptors, notes }),
        save_mode: saveMode,
        inventory_id: saveMode === "link_existing_inventory" ? inventoryId : null,
      }
    : null;
  const saveReadiness = draft ? canSaveFieldCaptureDraft(draft) : { ok: false, reason: "Capture a bottle first." };

  async function analyzeDataUrl(dataUrl: string, options: { hint?: string | null; followUpAlreadyAsked?: boolean } = {}) {
    setStage("photo");
    const request = buildCaptureWineRequest(dataUrl, options.hint);
    const { data, error } = await supabase.functions.invoke("capture-wine", { body: request });
    if (error) throw error;
    const response = data as CaptureWineResponse | null;
    if (!response?.candidate) throw new Error("No candidate returned from capture-wine");
    const nextCandidate = response.candidate;
    setCandidate(nextCandidate);
    if (shouldEnterCaptureFollowUp(response, options.followUpAlreadyAsked ?? followUpAsked)) {
      setFollowUpQuestion(response.follow_up_question);
      setFollowUpAnswer("");
      setFollowUpAsked(true);
      setStage("follow_up");
      return;
    }
    setFollowUpQuestion(null);
    setStage("review");
  }

  async function handleFile(file: File) {
    try {
      const dataUrl = await dataUrlFromFile(file);
      setImageDataUrl(dataUrl);
      setFollowUpQuestion(null);
      setFollowUpAnswer("");
      setFollowUpAsked(false);
      toast.loading("Reading the label…", { id: "field-capture" });
      await analyzeDataUrl(dataUrl);
      toast.success("Bottle parsed. Review before saving.", { id: "field-capture" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not parse bottle", { id: "field-capture" });
    }
  }

  async function answerFollowUp() {
    if (!imageDataUrl) {
      toast.error("The original bottle photo is no longer available. Please capture it again.");
      setStage("photo");
      return;
    }
    const hint = buildCaptureFollowUpHint(followUpQuestion, followUpAnswer);
    if (!hint) {
      toast.error("Add one answer before continuing.");
      return;
    }
    try {
      toast.loading("Using your answer to finish the label…", { id: "field-capture" });
      await analyzeDataUrl(imageDataUrl, { hint, followUpAlreadyAsked: true });
      toast.success("Bottle identity updated. Review before saving.", { id: "field-capture" });
    } catch (error) {
      setStage("follow_up");
      toast.error(error instanceof Error ? error.message : "Could not finish the follow-up", { id: "field-capture" });
    }
  }

  async function saveDraft() {
    if (!draft) return;
    const readiness = canSaveFieldCaptureDraft(draft);
    if (!readiness.ok) {
      toast.error(readiness.reason ?? "Review the bottle identity before saving.");
      return;
    }
    setStage("saving");
    try {
      const response = await fetch("/api/field-capture/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, evidence_data_url: imageDataUrl }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Could not save capture");
      setResult({ wine: payload.wine, tasting: payload.tasting, inventory: payload.inventory, rating: payload.rating });
      setStage("done");
      toast.success(draft.is_benchmark ? "Benchmark saved to Pourfolio." : "Tasting saved to Pourfolio.");
    } catch (error) {
      setStage("review");
      toast.error(error instanceof Error ? error.message : "Could not save capture");
    }
  }

  const actions = result ? createPostSaveActions({
    wine_id: result.wine.id,
    tasting_id: result.tasting.id,
    inventory_id: result.inventory?.id ?? null,
    rating_id: result.rating?.id ?? null,
    is_benchmark: result.tasting.is_benchmark,
    buy_again: result.tasting.buy_again,
  }) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 md:pb-8">
      <section className="overflow-hidden rounded-[2rem] border bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.55))] p-5 shadow-sm md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-4">
            <Badge className="rounded-full px-3 py-1">Field Intelligence</Badge>
            <div className="space-y-3">
              <h1 className="font-playfair text-4xl font-bold tracking-tight md:text-6xl">Capture the wine while the moment is still alive.</h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                Bottle photo → structured identity → editable tasting memory → benchmark, Buy Again, and bottle intelligence actions in one mobile-first flow.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["20 sec", "target capture time"],
                ["94+", "benchmark trigger"],
                ["1 tap", "find more after save"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border bg-background/70 p-4">
                  <div className="text-2xl font-semibold">{value}</div>
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <Card className="border-primary/20 bg-background/85 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Real-world modes</CardTitle>
              <CardDescription>Designed for dinner tables, wine shops, and tastings — not a desktop admin screen.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl border p-3"><Camera className="h-5 w-5 text-primary" /> Bottle label capture</div>
              <Link href="/intelligence#restaurant-mode" className="flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-accent"><ClipboardList className="h-5 w-5 text-primary" /> Restaurant Mode</Link>
              <Link href="/intelligence#buy-again" className="flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-accent"><Search className="h-5 w-5 text-primary" /> Buy Again evidence lane</Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wine className="h-5 w-5 text-primary" /> 1. Photo</CardTitle>
            <CardDescription>Take a clear bottle photo. You can use the live parser or the Tapiz benchmark demo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="relative flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed bg-muted/30 text-left transition-colors hover:border-primary/70"
            >
              {imageDataUrl ? (
                <Image src={imageDataUrl} alt="Captured wine label" fill className="object-contain p-3" />
              ) : (
                <div className="max-w-xs space-y-3 p-8 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"><Camera className="h-9 w-9 text-primary" /></div>
                  <div className="text-lg font-semibold">Take bottle photo</div>
                  <p className="text-sm text-muted-foreground">Fill the frame with the front label. Avoid glare. We’ll preserve the raw evidence separately as the capture grows.</p>
                </div>
              )}
            </button>
            <Input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" onClick={() => inputRef.current?.click()}><Camera className="mr-2 h-4 w-4" /> Take / upload photo</Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/capture?demo=tapiz"><Sparkles className="mr-2 h-4 w-4" /> Load Tapiz demo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Review before save</CardTitle>
            <CardDescription>Nothing becomes cellar truth until you approve it. That is the quality bar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!draft && stage !== "saving" && stage !== "done" ? (
              <div className="rounded-3xl border bg-muted/30 p-8 text-center text-muted-foreground">Capture or load a bottle to begin.</div>
            ) : null}

            {stage === "follow_up" && followUpQuestion ? (
              <div className="space-y-4 rounded-3xl border border-amber-500/40 bg-amber-500/10 p-5">
                <div className="flex items-start gap-3">
                  <HelpCircle className="mt-1 h-5 w-5 text-amber-700 dark:text-amber-300" />
                  <div>
                    <div className="font-semibold text-amber-950 dark:text-amber-100">One quick label check</div>
                    <p className="mt-1 text-sm text-amber-950/80 dark:text-amber-100/80">{followUpQuestion}</p>
                    <p className="mt-1 text-xs text-amber-950/65 dark:text-amber-100/70">I’ll ask once, use your answer as a hint, then move you back to review.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow-up-answer">Answer</Label>
                  <Input id="follow-up-answer" value={followUpAnswer} onChange={(event) => setFollowUpAnswer(event.target.value)} placeholder="e.g. Tapiz, 2021, Mendoza" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={answerFollowUp}><Sparkles className="mr-2 h-4 w-4" /> Use answer and continue</Button>
                  <Button variant="outline" onClick={() => { setFollowUpQuestion(null); setStage("review"); }}>Review without answer</Button>
                </div>
              </div>
            ) : null}

            {draft && stage !== "follow_up" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{draft.confidence_label}</Badge>
                  {draft.is_benchmark ? <Badge className="bg-amber-600 text-white hover:bg-amber-600">Benchmark bottle</Badge> : <Badge variant="outline">Standard tasting</Badge>}
                  {draft.ambiguous_fields?.length ? <Badge variant="outline">Needs review: {draft.ambiguous_fields.join(", ")}</Badge> : null}
                </div>

                {draft.confidence_label !== "High confidence" || draft.ambiguous_fields?.length ? (
                  <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
                    <div className="font-semibold text-amber-950 dark:text-amber-100">Review carefully</div>
                    <p className="mt-1 text-sm text-amber-950/80 dark:text-amber-100/80">
                      Label confidence is not perfect. Check producer, label, and vintage before this becomes Pourfolio memory.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FieldValue label="Producer" value={draft.producer} />
                  <FieldValue label="Label" value={draft.label} />
                  <FieldValue label="Vintage" value={draft.vintage} />
                  <FieldValue label="Region" value={draft.region} />
                  <FieldValue label="Varietal" value={draft.varietal} />
                  <FieldValue label="Type" value={draft.wine_type} />
                </div>

                {draft.benchmark_prompt ? (
                  <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-4">
                    <div className="font-semibold text-amber-900 dark:text-amber-200">Benchmark trigger</div>
                    <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">{draft.benchmark_prompt}</p>
                  </div>
                ) : null}

                <div className="rounded-3xl border bg-muted/30 p-4">
                  <Label htmlFor="save-mode">Where should this memory land?</Label>
                  <select id="save-mode" value={saveMode} onChange={(event) => setSaveMode(event.target.value as FieldCaptureSaveMode)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="memory_only">Just remember this tasting</option>
                    {inventoryId ? <option value="link_existing_inventory">Link to this cellar bottle</option> : null}
                    <option value="add_to_cellar">Add one bottle to cellar</option>
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {saveMode === "link_existing_inventory"
                      ? "This will save a canonical cellar rating and open the right Bottle Intelligence page."
                      : saveMode === "add_to_cellar"
                        ? "This will create a one-bottle cellar record and attach the tasting to it."
                        : "This stays as capture memory; no broken cellar route will be created."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="score">Brian score</Label>
                    <Input id="score" type="number" min={0} max={100} value={score ?? ""} onChange={(event) => setScore(event.target.value ? Number(event.target.value) : null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buy-again">Buy again?</Label>
                    <select id="buy-again" value={buyAgain} onChange={(event) => setBuyAgain(event.target.value as BuyAgain)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="yes">Yes — find more</option>
                      <option value="maybe">Maybe — remember it</option>
                      <option value="cellar_only">Cellar only</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="occasion">Moment / occasion</Label>
                    <Input id="occasion" value={occasion} onChange={(event) => setOccasion(event.target.value)} placeholder="Anniversary dinner, shop tasting, best wines ever…" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="descriptors">Why it mattered</Label>
                    <Input id="descriptors" value={descriptors} onChange={(event) => setDescriptors(event.target.value)} placeholder="smooth, rich, long finish" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="What should future Brian remember?" />
                  </div>
                </div>

                {!saveReadiness.ok ? <p className="text-sm text-destructive">{saveReadiness.reason}</p> : null}
                <Button size="lg" className="w-full" onClick={saveDraft} disabled={stage === "saving" || !saveReadiness.ok}>
                  {stage === "saving" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {stage === "saving" ? "Saving to Pourfolio…" : draft.is_benchmark ? "Save benchmark memory" : "Save tasting memory"}
                </Button>
              </>
            ) : null}

            {stage === "done" && result ? (
              <div className="space-y-4 rounded-3xl border bg-primary/5 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-6 w-6 text-primary" />
                  <div>
                    <div className="text-lg font-semibold">Saved. Now make it useful.</div>
                    <p className="text-sm text-muted-foreground">The bottle is in Pourfolio. Choose the next action while the signal is fresh.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {actions.map((action) => (
                    <Link key={action.id} href={action.href} className={action.primary ? "rounded-2xl border border-primary bg-primary p-4 text-primary-foreground" : "rounded-2xl border bg-background p-4 transition-colors hover:bg-accent"}>
                      <div className="font-semibold">{action.label}</div>
                      <div className={action.primary ? "text-sm text-primary-foreground/80" : "text-sm text-muted-foreground"}>{action.description}</div>
                    </Link>
                  ))}
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setStage("photo"); setCandidate(null); setResult(null); setImageDataUrl(null); setFollowUpQuestion(null); setFollowUpAnswer(""); setFollowUpAsked(false); }}><RefreshCw className="mr-2 h-4 w-4" /> Reset capture</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
