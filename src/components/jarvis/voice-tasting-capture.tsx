"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Mic, MicOff, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createOfflineTastingDraft,
  drainSavedOfflineTastingDrafts,
  getOfflineTastingDrafts,
  markOfflineTastingDraftFailed,
  markOfflineTastingDraftSyncing,
  saveOfflineTastingDraft,
  type OfflineTastingDraft,
} from "@/lib/offline-tasting-drafts";
import type { VoiceTastingDraft } from "@/lib/voice-tasting-capture";

type VoiceTastingResponse = {
  success: boolean;
  mode?: "preview" | "saved";
  draft?: VoiceTastingDraft;
  message?: string;
  ratingId?: string;
  error?: string;
};

type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type BrowserWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const example =
  "Jarvis, log the 2018 Ridge Monte Bello. 96 points. Black cherry, cedar, graphite, firm tannins, bright acidity, long finish. Had it with steak at home. Definitely buy again; value feels strong.";

async function runVoiceCapture(transcript: string, save: boolean) {
  const response = await fetch("/api/voice-tasting-capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, save }),
  });
  const data = (await response.json()) as VoiceTastingResponse;
  if (!response.ok || !data.success) {
    const error = new Error(data.error || "Voice tasting capture failed.");
    Object.assign(error, { draft: data.draft });
    throw error;
  }
  return data;
}

export function VoiceTastingCapture() {
  const [transcript, setTranscript] = useState(example);
  const [draft, setDraft] = useState<VoiceTastingDraft | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineTastingDraft[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as BrowserWithSpeech;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshState = () => {
      setIsOnline(window.navigator.onLine);
      setOfflineDrafts(getOfflineTastingDrafts(window.localStorage));
    };

    refreshState();
    window.addEventListener("online", refreshState);
    window.addEventListener("offline", refreshState);

    return () => {
      window.removeEventListener("online", refreshState);
      window.removeEventListener("offline", refreshState);
    };
  }, []);

  const refreshOfflineDrafts = () => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);
    setOfflineDrafts(getOfflineTastingDrafts(window.localStorage));
  };

  const startListening = () => {
    if (typeof window === "undefined") return;
    const speechWindow = window as BrowserWithSpeech;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("This browser does not expose speech recognition. Paste or type the tasting instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let nextFinal = "";
      let nextInterim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) nextFinal += result[0].transcript;
        else nextInterim += result[0].transcript;
      }
      setTranscript((current) => `${current.replace(/\s+$/, "")} ${nextFinal || nextInterim}`.trim());
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const preview = async () => {
    const clean = transcript.trim();
    if (!clean) return;
    setIsBusy(true);
    try {
      const data = await runVoiceCapture(clean, false);
      setDraft(data.draft || null);
      toast.success("JARVIS structured the tasting draft.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Capture preview failed.");
    } finally {
      setIsBusy(false);
    }
  };

  const save = async () => {
    const clean = transcript.trim();
    if (!clean) return;

    if (typeof window !== "undefined" && !window.navigator.onLine) {
      const offlineDraft = saveOfflineTastingDraft(window.localStorage, createOfflineTastingDraft({ transcript: clean }));
      refreshOfflineDrafts();
      toast.info(`Queued tasting offline: ${offlineDraft.id}`);
      return;
    }

    setIsBusy(true);
    try {
      const data = await runVoiceCapture(clean, true);
      setDraft(data.draft || null);
      toast.success(data.message || "Tasting saved.");
    } catch (error) {
      const maybeDraft = error as Error & { draft?: VoiceTastingDraft };
      if (maybeDraft.draft) setDraft(maybeDraft.draft);
      if (typeof window !== "undefined") {
        saveOfflineTastingDraft(window.localStorage, createOfflineTastingDraft({ transcript: clean }));
        refreshOfflineDrafts();
      }
      toast.error(error instanceof Error ? `${error.message} Saved as an offline draft.` : "Tasting saved as an offline draft.");
    } finally {
      setIsBusy(false);
    }
  };

  const syncOfflineDrafts = async () => {
    if (typeof window === "undefined") return;
    if (!window.navigator.onLine) {
      toast.error("You are offline. Sync when the cellar is back online.");
      return;
    }

    const queued = getOfflineTastingDrafts(window.localStorage);
    if (!queued.length) return;

    setIsBusy(true);
    const savedIds: string[] = [];
    try {
      for (const offlineDraft of queued) {
        markOfflineTastingDraftSyncing(window.localStorage, offlineDraft.id);
        refreshOfflineDrafts();
        try {
          await runVoiceCapture(offlineDraft.transcript, true);
          savedIds.push(offlineDraft.id);
        } catch (error) {
          markOfflineTastingDraftFailed(
            window.localStorage,
            offlineDraft.id,
            error instanceof Error ? error.message : "Sync failed.",
          );
        }
      }
      drainSavedOfflineTastingDrafts(window.localStorage, savedIds);
      refreshOfflineDrafts();
      if (savedIds.length > 0) toast.success(`Synced ${savedIds.length} offline tasting ${savedIds.length === 1 ? "draft" : "drafts"}.`);
      if (savedIds.length < queued.length) toast.error("Some offline drafts still need attention.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-playfair text-3xl font-semibold tracking-tight">
            <Mic className="h-5 w-5 text-primary" /> Voice tasting capture
          </CardTitle>
          <CardDescription className="leading-7">
            Speak or paste a tasting. JARVIS turns the raw transcript into a rating draft, Brian-Fit signal, decision tags, and cellar-linked memory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant={isOnline ? "secondary" : "outline"} className="rounded-full">
              {isOnline ? "Online" : "Offline queue active"}
            </Badge>
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              className="rounded-full"
              onClick={isListening ? stopListening : startListening}
              disabled={!speechSupported}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isListening ? "Stop listening" : "Start voice"}
            </Button>
            {!speechSupported ? (
              <Badge variant="outline" className="rounded-full">Speech unsupported here; text mode ready</Badge>
            ) : null}
          </div>

          <Textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            className="min-h-56 rounded-3xl border-border/60 bg-background p-4 text-base leading-7"
            placeholder="Jarvis, log the 2018 Ridge Monte Bello..."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Button className="h-11 rounded-full" onClick={preview} disabled={isBusy || !transcript.trim()}>
              <Sparkles className="h-4 w-4" />
              {isBusy ? "Structuring..." : "Preview draft"}
            </Button>
            <Button className="h-11 rounded-full" variant="outline" onClick={save} disabled={isBusy || !transcript.trim()}>
              <Save className="h-4 w-4" />
              Save tasting
            </Button>
          </div>

          <OfflineQueue drafts={offlineDrafts} isBusy={isBusy} onSync={syncOfflineDrafts} />
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">Structured draft</CardTitle>
          <CardDescription>
            Save only when the bottle match is high-confidence. Otherwise use the cellar link to disambiguate first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {draft ? <DraftPreview draft={draft} /> : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-muted-foreground">
              No draft yet. Preview the transcript to see the bottle match and extracted rating signal.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OfflineQueue({
  drafts,
  isBusy,
  onSync,
}: {
  drafts: OfflineTastingDraft[];
  isBusy: boolean;
  onSync: () => void;
}) {
  if (!drafts.length) {
    return (
      <div className="rounded-3xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
        Offline queue empty. If the cellar signal drops, failed saves will wait here instead of vanishing.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Offline tasting drafts</div>
          <div className="text-xs text-muted-foreground">{drafts.length} waiting to sync into ratings.</div>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onSync} disabled={isBusy}>
          Sync now
        </Button>
      </div>
      <div className="space-y-2">
        {drafts.slice(0, 3).map((offlineDraft) => (
          <div key={offlineDraft.id} className="rounded-2xl border border-border/70 bg-background/70 p-3 text-xs leading-5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{offlineDraft.status}</span>
              <span className="text-muted-foreground">attempts {offlineDraft.attempts}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-muted-foreground">{offlineDraft.transcript}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftPreview({ draft }: { draft: VoiceTastingDraft }) {
  const statusLabel = draft.status === "ready_to_save" ? "Ready to save" : "Needs bottle match";

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={draft.status === "ready_to_save" ? "default" : "outline"} className="rounded-full">
            {statusLabel}
          </Badge>
          <div className="text-sm text-muted-foreground">{draft.rating.score} points</div>
        </div>
        <p className="mt-4 text-base leading-7 text-foreground">{draft.summary}</p>
      </div>

      {draft.matchedWine ? (
        <Link
          href={draft.matchedWine.href}
          className="group block rounded-3xl border border-border/70 bg-background p-5 transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-foreground group-hover:text-primary">{draft.matchedWine.displayName}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[draft.matchedWine.producer, draft.matchedWine.region].filter(Boolean).join(" • ")}
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full">{draft.matchedWine.confidence} confidence</Badge>
            <Badge variant="secondary" className="rounded-full">match {draft.matchedWine.matchScore}</Badge>
          </div>
        </Link>
      ) : (
        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/50 p-5 text-sm leading-6 text-amber-900">
          JARVIS could not lock this to a bottle. Add the producer, vintage, or wine name before saving.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SignalPill label="Food" value={draft.rating.food_pairing} />
        <SignalPill label="Venue" value={draft.rating.venue} />
        <SignalPill label="Tannins" value={draft.rating.tannins} />
        <SignalPill label="Acidity" value={draft.rating.acidity} />
        <SignalPill label="Finish" value={draft.rating.finish} />
        <SignalPill label="Value" value={draft.ratingSignal.value_feel} />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Decision tags</div>
        <div className="flex flex-wrap gap-2">
          {(draft.ratingSignal.decision_tags || []).map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full">{tag}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalPill({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value || "Not extracted"}</div>
    </div>
  );
}
