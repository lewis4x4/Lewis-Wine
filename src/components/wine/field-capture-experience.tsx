"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ClipboardList, HelpCircle, Loader2, RefreshCw, RotateCcw, Search, Sparkles, Trash2, Wine, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOfflineFieldCaptureDraft,
  deleteOfflineFieldCaptureDraft,
  drainSavedOfflineFieldCaptureDrafts,
  getOfflineFieldCaptureDrafts,
  markOfflineFieldCaptureDraftFailed,
  markOfflineFieldCaptureDraftSyncing,
  saveOfflineFieldCaptureDraft,
  type OfflineFieldCaptureDraft,
} from "@/lib/offline-field-capture-drafts";
import { fieldCaptureFailureMessage, shouldQueueFieldCaptureFailure } from "@/lib/field-capture-sync";
import {
  buildCaptureFollowUpHint,
  buildCaptureWineRequest,
  buildFieldCaptureCandidateFromLabelScan,
  buildReviewDraft,
  canSaveFieldCaptureDraft,
  createPostSaveActions,
  tapizDemoCandidate,
  type BuyAgain,
  type CaptureWineCandidate,
  type FieldCaptureSaveMode,
  type ReviewDraft,
} from "@/lib/field-capture";
import type { LabelScanResult } from "@/types/database";

type FieldCaptureExperienceProps = {
  initialDemo?: boolean;
  inventoryId?: string | null;
  initialSaveMode?: FieldCaptureSaveMode | null;
};

const initialScore = 95;
const initialBuyAgain: BuyAgain = "yes";
const initialOccasion = "best wines ever — reference Cab";
const initialDescriptors = "smooth, rich, long finish";
const initialNotes = "One of the best wines ever.";

type Stage = "photo" | "analyzing" | "follow_up" | "review" | "saving" | "done";

type SaveResult = {
  wine: { id: string; producer?: string | null; label?: string | null; vintage?: number | null };
  tasting: { id: string; wine_id: string; is_benchmark: boolean; buy_again: BuyAgain };
  inventory?: { id: string } | null;
  rating?: { id: string } | null;
};

type FieldCaptureSaveResponse = SaveResult & {
  success?: boolean;
  error?: string;
  replayed?: boolean;
};

const maxCaptureImageDataUrlChars = 5_500_000;
const maxCaptureImageDimension = 1800;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function loadImageFromObjectUrl(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for capture"));
    image.src = objectUrl;
  });
}

async function dataUrlFromFile(file: File) {
  if (typeof window === "undefined" || typeof document === "undefined") return readFileAsDataUrl(file);
  if (file.size <= 3_500_000 && ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    const original = await readFileAsDataUrl(file);
    if (original.length <= maxCaptureImageDataUrlChars) return original;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const scale = Math.min(1, maxCaptureImageDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare image for capture");
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const compressed = canvas.toDataURL("image/jpeg", quality);
      if (compressed.length <= maxCaptureImageDataUrlChars) return compressed;
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  throw new Error("Photo is too large to prepare automatically. Please crop closer to the label and try again.");
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(`${fallbackMessage} Server returned an unreadable response (${response.status}).`);
  }
}

async function labelScanFromDataUrl(dataUrl: string, hint?: string | null): Promise<LabelScanResult> {
  const request = buildCaptureWineRequest(dataUrl, hint);
  const response = await fetch("/api/label/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ media_type: request.media_type, image_base64: request.image_base64, hint: request.hint }),
  });
  const data = await parseJsonResponse<LabelScanResult>(response, "Could not read the label.");
  if (!response.ok || !data.success || !data.wine) throw new Error(data.error || "Could not read the label");
  return data;
}

async function postFieldCapturePayload(payload: unknown) {
  const response = await fetch("/api/field-capture/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<FieldCaptureSaveResponse>(response, "Could not save capture.");
  if (!response.ok || !data.success) {
    const error = new Error(data.error || "Could not save capture");
    Object.assign(error, { status: response.status, payload: data });
    throw error;
  }
  return data;
}

function createFieldCaptureIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `field-capture-${crypto.randomUUID()}`;
  return `field-capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function labelId(label: string) {
  return `field-capture-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function FieldCaptureExperience({ initialDemo = false, inventoryId = null, initialSaveMode = null }: FieldCaptureExperienceProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const captureSequenceRef = useRef(0);
  const idempotencyKeyRef = useRef(createFieldCaptureIdempotencyKey());
  const [stage, setStage] = useState<Stage>(initialDemo ? "review" : "photo");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CaptureWineCandidate | null>(initialDemo ? tapizDemoCandidate : null);
  const [score, setScore] = useState<number | null>(initialDemo ? initialScore : null);
  const [buyAgain, setBuyAgain] = useState<BuyAgain>(initialDemo ? initialBuyAgain : "maybe");
  const [occasion, setOccasion] = useState(initialDemo ? initialOccasion : "");
  const [descriptors, setDescriptors] = useState(initialDescriptors);
  const [notes, setNotes] = useState(initialNotes);
  const [saveMode, setSaveMode] = useState<FieldCaptureSaveMode>(initialSaveMode ?? (inventoryId ? "link_existing_inventory" : "memory_only"));
  const [result, setResult] = useState<SaveResult | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineFieldCaptureDraft[]>([]);

  const refreshOfflineDrafts = () => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);
    setOfflineDrafts(getOfflineFieldCaptureDrafts(window.localStorage));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    refreshOfflineDrafts();
    window.addEventListener("online", refreshOfflineDrafts);
    window.addEventListener("offline", refreshOfflineDrafts);
    return () => {
      window.removeEventListener("online", refreshOfflineDrafts);
      window.removeEventListener("offline", refreshOfflineDrafts);
    };
  }, []);

  const draft: ReviewDraft | null = candidate
    ? {
        ...buildReviewDraft(candidate, { score, buy_again: buyAgain, occasion, descriptors, notes }),
        save_mode: saveMode,
        idempotency_key: idempotencyKeyRef.current,
        inventory_id: saveMode === "link_existing_inventory" ? inventoryId : null,
      }
    : null;
  const saveReadiness = draft ? canSaveFieldCaptureDraft(draft) : { ok: false, reason: "Capture a bottle first." };

  function updateCandidateField<K extends keyof CaptureWineCandidate>(field: K, value: CaptureWineCandidate[K]) {
    setCandidate((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: value,
        ambiguous_fields: (current.ambiguous_fields ?? []).filter((ambiguous) => ambiguous !== field),
      };
    });
  }

  function updateCandidateTextField(field: keyof Pick<CaptureWineCandidate, "producer" | "label" | "region" | "subregion" | "country" | "varietal">, value: string) {
    updateCandidateField(field, value.trim() ? value : null);
  }

  function updateCandidateVintage(value: string) {
    const parsed = Number(value);
    updateCandidateField("vintage", Number.isInteger(parsed) && parsed >= 1800 && parsed <= 2200 ? parsed : null);
  }

  async function analyzeDataUrl(dataUrl: string, hint?: string | null, sequence = captureSequenceRef.current) {
    setStage("analyzing");
    const scan = await labelScanFromDataUrl(dataUrl, hint);
    if (sequence !== captureSequenceRef.current) return false;
    if (!scan.wine) throw new Error("No candidate returned from label scan");
    const nextCandidate = buildFieldCaptureCandidateFromLabelScan(scan.wine);
    setCandidate(nextCandidate);
    setDescriptors(scan.wine.detected_descriptors?.join(", ") || initialDescriptors);
    setNotes(scan.wine.suggested_tasting_note || scan.raw_text || initialNotes);
    setFollowUpQuestion(null);
    setStage("review");
    return true;
  }

  async function handleFile(file: File) {
    const sequence = captureSequenceRef.current + 1;
    captureSequenceRef.current = sequence;
    try {
      const dataUrl = await dataUrlFromFile(file);
      if (sequence !== captureSequenceRef.current) return;
      idempotencyKeyRef.current = createFieldCaptureIdempotencyKey();
      setCandidate(null);
      setResult(null);
      setImageDataUrl(dataUrl);
      setFollowUpQuestion(null);
      setFollowUpAnswer("");
      toast.loading("Reading the label…", { id: "field-capture" });
      const completed = await analyzeDataUrl(dataUrl, null, sequence);
      if (completed) toast.success("Bottle parsed. Review before saving.", { id: "field-capture" });
    } catch (error) {
      if (sequence !== captureSequenceRef.current) return;
      setCandidate(null);
      setResult(null);
      setImageDataUrl(null);
      setStage("photo");
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
      const completed = await analyzeDataUrl(imageDataUrl, hint, captureSequenceRef.current);
      if (completed) toast.success("Bottle identity updated. Review before saving.", { id: "field-capture" });
    } catch (error) {
      setStage("follow_up");
      toast.error(error instanceof Error ? error.message : "Could not finish the follow-up", { id: "field-capture" });
    }
  }

  function queueCurrentFieldCapture(reason?: string) {
    if (!draft || typeof window === "undefined") return null;
    try {
      const offlineDraft = saveOfflineFieldCaptureDraft(
        window.localStorage,
        createOfflineFieldCaptureDraft({ reviewDraft: draft, evidenceDataUrl: imageDataUrl }),
      );
      refreshOfflineDrafts();
      if (reason) toast.info(`${reason} Queued field capture: ${offlineDraft.id}`);
      else toast.info(`Queued field capture: ${offlineDraft.id}`);
      return offlineDraft;
    } catch (error) {
      const message = error instanceof DOMException && error.name === "QuotaExceededError"
        ? "Offline storage is full. Please crop or retake the label photo, or save when back online."
        : error instanceof Error
          ? error.message
          : "Could not queue this capture offline.";
      toast.error(message);
      return null;
    }
  }

  async function syncOneOfflineFieldDraft(offlineDraft: OfflineFieldCaptureDraft) {
    if (typeof window === "undefined") return false;
    markOfflineFieldCaptureDraftSyncing(window.localStorage, offlineDraft.id);
    refreshOfflineDrafts();
    try {
      const payload = await postFieldCapturePayload(offlineDraft.payload);
      drainSavedOfflineFieldCaptureDrafts(window.localStorage, [offlineDraft.id]);
      refreshOfflineDrafts();
      toast.success(payload.replayed ? "Offline field capture already saved." : "Offline field capture synced.");
      return true;
    } catch (error) {
      markOfflineFieldCaptureDraftFailed(window.localStorage, offlineDraft.id, error instanceof Error ? error.message : "Sync failed.");
      refreshOfflineDrafts();
      toast.error("Offline field capture still needs attention.");
      return false;
    }
  }

  async function syncOfflineFieldDrafts() {
    if (typeof window === "undefined") return;
    if (!window.navigator.onLine) {
      toast.error("You are offline. Sync when the cellar is back online.");
      return;
    }
    const queued = getOfflineFieldCaptureDrafts(window.localStorage);
    if (!queued.length) return;
    setStage("saving");
    let savedCount = 0;
    try {
      for (const offlineDraft of queued) {
        const saved = await syncOneOfflineFieldDraft(offlineDraft);
        if (saved) savedCount += 1;
      }
      if (savedCount > 0) toast.success(`Synced ${savedCount} field capture ${savedCount === 1 ? "draft" : "drafts"}.`);
      if (savedCount < queued.length) toast.error("Some field captures still need attention.");
    } finally {
      setStage(draft ? "review" : "photo");
    }
  }

  async function retryOfflineFieldDraft(offlineDraft: OfflineFieldCaptureDraft) {
    if (typeof window === "undefined") return;
    if (!window.navigator.onLine) {
      toast.error("Still offline. Retry when the cellar is back online.");
      return;
    }
    setStage("saving");
    try {
      await syncOneOfflineFieldDraft(offlineDraft);
    } finally {
      setStage(draft ? "review" : "photo");
    }
  }

  function removeOfflineFieldDraft(offlineDraft: OfflineFieldCaptureDraft) {
    if (typeof window === "undefined") return;
    deleteOfflineFieldCaptureDraft(window.localStorage, offlineDraft.id);
    refreshOfflineDrafts();
    toast.success("Offline field capture deleted.");
  }

  async function saveDraft() {
    if (!draft) return;
    const readiness = canSaveFieldCaptureDraft(draft);
    if (!readiness.ok) {
      toast.error(readiness.reason ?? "Review the bottle identity before saving.");
      return;
    }
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      queueCurrentFieldCapture("Offline.");
      return;
    }
    setStage("saving");
    try {
      const payload = await postFieldCapturePayload({ ...draft, evidence_data_url: imageDataUrl });
      setResult({ wine: payload.wine, tasting: payload.tasting, inventory: payload.inventory, rating: payload.rating });
      setStage("done");
      toast.success(draft.is_benchmark ? "Benchmark saved to Pourfolio." : "Tasting saved to Pourfolio.");
      router.push(`/capture/saved/${encodeURIComponent(payload.tasting.id)}`);
    } catch (error) {
      const maybeError = error as Error & { status?: number };
      const shouldQueue = shouldQueueFieldCaptureFailure({
        isOnline: typeof window === "undefined" ? true : window.navigator.onLine,
        status: maybeError.status,
      });
      if (shouldQueue) queueCurrentFieldCapture(fieldCaptureFailureMessage(maybeError.status));
      setStage("review");
      const saveMessage = error instanceof Error
        ? shouldQueue
          ? `${error.message} ${fieldCaptureFailureMessage(maybeError.status)}`
          : `${error.message}. ${fieldCaptureFailureMessage(maybeError.status)}`
        : fieldCaptureFailureMessage(maybeError.status);
      toast.error(saveMessage);
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
  const isCaptureBusy = stage === "analyzing" || stage === "saving";

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
              onClick={() => { if (!isCaptureBusy) inputRef.current?.click(); }}
              disabled={isCaptureBusy}
              className="relative flex min-h-[360px] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed bg-muted/30 text-left transition-colors hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
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
            <Input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={isCaptureBusy}
              className="hidden"
              onChange={(event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (file) void handleFile(file).finally(() => { input.value = ""; });
                else input.value = "";
              }}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" onClick={() => inputRef.current?.click()} disabled={isCaptureBusy}><Camera className="mr-2 h-4 w-4" /> Take / upload photo</Button>
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
            {!draft && stage !== "analyzing" && stage !== "saving" && stage !== "done" ? (
              <>
                <div className="rounded-3xl border bg-muted/30 p-8 text-center text-muted-foreground">Capture or load a bottle to begin.</div>
                <FieldCaptureOfflineQueue
                  drafts={offlineDrafts}
                  isOnline={isOnline}
                  isBusy={isCaptureBusy}
                  onSync={syncOfflineFieldDrafts}
                  onRetry={retryOfflineFieldDraft}
                  onDelete={removeOfflineFieldDraft}
                />
              </>
            ) : null}

            {stage === "analyzing" ? (
              <div className="flex items-center justify-center gap-3 rounded-3xl border bg-muted/30 p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Reading the label and building the review draft…
              </div>
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
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Producer")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Producer</Label>
                    <Input id={labelId("Producer")} value={candidate?.producer ?? ""} onChange={(event) => updateCandidateTextField("producer", event.target.value)} placeholder="Zuccardi Q" />
                  </div>
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Label")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Label</Label>
                    <Input id={labelId("Label")} value={candidate?.label ?? ""} onChange={(event) => updateCandidateTextField("label", event.target.value)} placeholder="Cabernet Sauvignon" />
                  </div>
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Vintage")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Vintage</Label>
                    <Input id={labelId("Vintage")} type="number" inputMode="numeric" value={candidate?.vintage ?? ""} onChange={(event) => updateCandidateVintage(event.target.value)} placeholder="2020" />
                  </div>
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Region")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Region</Label>
                    <Input id={labelId("Region")} value={candidate?.region ?? ""} onChange={(event) => updateCandidateTextField("region", event.target.value)} placeholder="Valle de Uco, Mendoza" />
                  </div>
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Varietal")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Varietal</Label>
                    <Input id={labelId("Varietal")} value={candidate?.varietal ?? ""} onChange={(event) => updateCandidateTextField("varietal", event.target.value)} placeholder="Cabernet Sauvignon" />
                  </div>
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Type")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Type</Label>
                    <select id={labelId("Type")} value={candidate?.wine_type ?? ""} onChange={(event) => updateCandidateField("wine_type", (event.target.value || null) as CaptureWineCandidate["wine_type"])} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                      <option value="">Unknown</option>
                      <option value="red">red</option>
                      <option value="white">white</option>
                      <option value="rose">rose</option>
                      <option value="sparkling">sparkling</option>
                      <option value="dessert">dessert</option>
                      <option value="fortified">fortified</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Subregion")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Subregion / appellation</Label>
                    <Input id={labelId("Subregion")} value={candidate?.subregion ?? ""} onChange={(event) => updateCandidateTextField("subregion", event.target.value)} placeholder="Valle de Uco" />
                  </div>
                  <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
                    <Label htmlFor={labelId("Country")} className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Country</Label>
                    <Input id={labelId("Country")} value={candidate?.country ?? ""} onChange={(event) => updateCandidateTextField("country", event.target.value)} placeholder="Argentina" />
                  </div>
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
                    <Input id="score" type="number" min={50} max={100} value={score ?? ""} onChange={(event) => setScore(event.target.value ? Number(event.target.value) : null)} />
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
                <FieldCaptureOfflineQueue
                  drafts={offlineDrafts}
                  isOnline={isOnline}
                  isBusy={isCaptureBusy}
                  onSync={syncOfflineFieldDrafts}
                  onRetry={retryOfflineFieldDraft}
                  onDelete={removeOfflineFieldDraft}
                />
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
                <Button variant="outline" className="w-full" onClick={() => { idempotencyKeyRef.current = createFieldCaptureIdempotencyKey(); setStage("photo"); setCandidate(null); setResult(null); setImageDataUrl(null); setFollowUpQuestion(null); setFollowUpAnswer(""); }}><RefreshCw className="mr-2 h-4 w-4" /> Reset capture</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function FieldCaptureOfflineQueue({
  drafts,
  isOnline,
  isBusy,
  onSync,
  onRetry,
  onDelete,
}: {
  drafts: OfflineFieldCaptureDraft[];
  isOnline: boolean;
  isBusy: boolean;
  onSync: () => void;
  onRetry: (draft: OfflineFieldCaptureDraft) => void;
  onDelete: (draft: OfflineFieldCaptureDraft) => void;
}) {
  if (!drafts.length) {
    return (
      <div className="rounded-3xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
        Field queue empty. If mobile service drops during save, this reviewed capture will wait here with its retry key intact.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Offline field captures</div>
          <div className="text-xs text-muted-foreground">{drafts.length} reviewed capture {drafts.length === 1 ? "draft" : "drafts"} waiting to sync.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "secondary" : "outline"} className="rounded-full">{isOnline ? "Online" : "Offline"}</Badge>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onSync} disabled={isBusy || !isOnline}>
            Sync all
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {drafts.slice(0, 5).map((offlineDraft) => {
          const wineLabel = [offlineDraft.payload.vintage, offlineDraft.payload.producer, offlineDraft.payload.label ?? offlineDraft.payload.varietal]
            .filter(Boolean)
            .join(" ") || "Captured wine";
          return (
            <div key={offlineDraft.id} className="rounded-2xl border border-border/70 bg-background/70 p-3 text-xs leading-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{wineLabel}</span>
                <span className="text-muted-foreground">{offlineDraft.status} · attempts {offlineDraft.attempts}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{offlineDraft.payload.notes || offlineDraft.payload.occasion || "Reviewed field capture waiting for safe retry."}</p>
              <div className="mt-1 text-[11px] text-muted-foreground">Retry key preserved: {offlineDraft.idempotencyKey.slice(0, 36)}…</div>
              {offlineDraft.lastError ? <p className="mt-1 text-[11px] text-destructive">{offlineDraft.lastError}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onRetry(offlineDraft)} disabled={isBusy || !isOnline}>
                  <RotateCcw className="h-3.5 w-3.5" /> Retry
                </Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={() => onDelete(offlineDraft)} disabled={isBusy}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          );
        })}
        {drafts.length > 5 ? <p className="text-xs text-muted-foreground">Showing 5 of {drafts.length} queued captures. Sync all to process the full queue.</p> : null}
      </div>
    </div>
  );
}
