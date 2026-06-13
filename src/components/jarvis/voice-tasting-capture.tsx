"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Mic, MicOff, Pencil, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createOfflineTastingDraft,
  deleteOfflineTastingDraft,
  drainSavedOfflineTastingDrafts,
  getOfflineTastingDrafts,
  markOfflineTastingDraftFailed,
  markOfflineTastingDraftSyncing,
  saveOfflineTastingDraft,
  updateOfflineTastingDraft,
  type OfflineTastingDraft,
} from "@/lib/offline-tasting-drafts";
import type { VoiceTastingDraft, VoiceTastingMatch } from "@/lib/voice-tasting-capture";
import { shouldQueueVoiceTastingFailure, voiceTastingFailureMessage } from "@/lib/voice-tasting-sync";

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

const transcriptPlaceholder =
  "Jarvis, log the 2018 Ridge Monte Bello. 96 points. Black cherry, cedar, graphite, firm tannins, bright acidity, long finish. Had it with steak at home. Definitely buy again; value feels strong.";

async function runVoiceCapture(
  transcript: string,
  save: boolean,
  idempotencyKey?: string,
  selectedInventoryId?: string | null,
) {
  const response = await fetch("/api/voice-tasting-capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, save, idempotencyKey, selectedInventoryId }),
  });
  const data = (await response.json()) as VoiceTastingResponse;
  if (!response.ok || !data.success) {
    const error = new Error(data.error || "Voice tasting capture failed.");
    Object.assign(error, { draft: data.draft, status: response.status });
    throw error;
  }
  return data;
}

export function VoiceTastingCapture() {
  const searchParams = useSearchParams();
  const deepLinkedInventoryId = searchParams.get("inventoryId");
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<VoiceTastingDraft | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(deepLinkedInventoryId);
  const [isListening, setIsListening] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineTastingDraft[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    const speechWindow = window as BrowserWithSpeech;
    return Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    setSelectedInventoryId(deepLinkedInventoryId);
  }, [deepLinkedInventoryId]);

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
      const data = await runVoiceCapture(clean, false, undefined, selectedInventoryId);
      setDraft(data.draft || null);
      if (data.draft?.matchedWine) setSelectedInventoryId(data.draft.matchedWine.id);
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
      const offlineDraft = saveOfflineTastingDraft(
        window.localStorage,
        createOfflineTastingDraft({ transcript: clean, selectedInventoryId }),
      );
      refreshOfflineDrafts();
      toast.info(`Queued tasting offline: ${offlineDraft.id}`);
      return;
    }

    const saveDraft = createOfflineTastingDraft({ transcript: clean, selectedInventoryId });

    setIsBusy(true);
    try {
      const data = await runVoiceCapture(clean, true, saveDraft.idempotencyKey, selectedInventoryId);
      setDraft(data.draft || null);
      if (data.draft?.matchedWine) setSelectedInventoryId(data.draft.matchedWine.id);
      toast.success(data.message || "Tasting saved.");
    } catch (error) {
      const maybeDraft = error as Error & { draft?: VoiceTastingDraft; status?: number };
      if (maybeDraft.draft) setDraft(maybeDraft.draft);

      const shouldQueue = shouldQueueVoiceTastingFailure({
        isOnline: typeof window === "undefined" ? true : window.navigator.onLine,
        status: maybeDraft.status,
      });

      if (shouldQueue && typeof window !== "undefined") {
        saveOfflineTastingDraft(window.localStorage, saveDraft);
        refreshOfflineDrafts();
      }

      const fallback = voiceTastingFailureMessage(maybeDraft.status);
      toast.error(error instanceof Error ? (shouldQueue ? `${error.message} ${fallback}` : fallback) : fallback);
    } finally {
      setIsBusy(false);
    }
  };

  const syncOneOfflineDraft = async (offlineDraft: OfflineTastingDraft) => {
    if (typeof window === "undefined") return false;
    markOfflineTastingDraftSyncing(window.localStorage, offlineDraft.id);
    refreshOfflineDrafts();
    try {
      await runVoiceCapture(
        offlineDraft.transcript,
        true,
        offlineDraft.idempotencyKey || offlineDraft.id,
        offlineDraft.selectedInventoryId,
      );
      drainSavedOfflineTastingDrafts(window.localStorage, [offlineDraft.id]);
      refreshOfflineDrafts();
      toast.success("Offline tasting synced.");
      return true;
    } catch (error) {
      markOfflineTastingDraftFailed(
        window.localStorage,
        offlineDraft.id,
        error instanceof Error ? error.message : "Sync failed.",
      );
      refreshOfflineDrafts();
      toast.error("Offline draft still needs attention.");
      return false;
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
    let savedCount = 0;
    try {
      for (const offlineDraft of queued) {
        const saved = await syncOneOfflineDraft(offlineDraft);
        if (saved) savedCount += 1;
      }
      if (savedCount > 0) toast.success(`Synced ${savedCount} offline tasting ${savedCount === 1 ? "draft" : "drafts"}.`);
      if (savedCount < queued.length) toast.error("Some offline drafts still need attention.");
    } finally {
      setIsBusy(false);
    }
  };

  const retryOfflineDraft = async (offlineDraft: OfflineTastingDraft) => {
    if (typeof window === "undefined") return;
    if (!window.navigator.onLine) {
      toast.error("Still offline. Retry when the cellar is back online.");
      return;
    }
    setIsBusy(true);
    try {
      await syncOneOfflineDraft(offlineDraft);
    } finally {
      setIsBusy(false);
    }
  };

  const beginEditOfflineDraft = (offlineDraft: OfflineTastingDraft) => {
    setEditingDraftId(offlineDraft.id);
    setEditingTranscript(offlineDraft.transcript);
  };

  const saveEditedOfflineDraft = (offlineDraft: OfflineTastingDraft) => {
    if (typeof window === "undefined") return;
    updateOfflineTastingDraft(window.localStorage, offlineDraft.id, {
      transcript: editingTranscript,
      selectedInventoryId: offlineDraft.selectedInventoryId,
    });
    setEditingDraftId(null);
    setEditingTranscript("");
    refreshOfflineDrafts();
    toast.success("Offline draft updated.");
  };

  const removeOfflineDraft = (offlineDraft: OfflineTastingDraft) => {
    if (typeof window === "undefined") return;
    deleteOfflineTastingDraft(window.localStorage, offlineDraft.id);
    refreshOfflineDrafts();
    toast.success("Offline draft deleted.");
  };

  const chooseBottle = (match: VoiceTastingMatch) => {
    setSelectedInventoryId(match.id);
    if (draft) {
      setDraft({
        ...draft,
        matchedWine: match,
        alternatives: draft.alternatives.filter((candidate) => candidate.id !== match.id),
        status: "ready_to_save",
        warnings: [],
      });
    }
    toast.success(`Selected ${match.displayName} for this tasting.`);
  };

  const canSave = Boolean(transcript.trim()) && draft?.status === "ready_to_save" && Boolean(selectedInventoryId || draft.matchedWine?.id);

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
            {selectedInventoryId ? (
              <Badge variant="outline" className="rounded-full">Bottle selected from cellar</Badge>
            ) : null}
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
            placeholder={transcriptPlaceholder}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Start blank in the field. Paste a note, dictate one, or launch from a bottle page to lock the tasting to that bottle.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button className="h-11 rounded-full" onClick={preview} disabled={isBusy || !transcript.trim()}>
              <Sparkles className="h-4 w-4" />
              {isBusy ? "Structuring..." : "Preview draft"}
            </Button>
            <Button className="h-11 rounded-full" variant="outline" onClick={save} disabled={isBusy || !canSave}>
              <Save className="h-4 w-4" />
              Save tasting
            </Button>
          </div>

          <OfflineQueue
            drafts={offlineDrafts}
            isBusy={isBusy}
            editingDraftId={editingDraftId}
            editingTranscript={editingTranscript}
            onEditTranscript={setEditingTranscript}
            onBeginEdit={beginEditOfflineDraft}
            onCancelEdit={() => setEditingDraftId(null)}
            onSaveEdit={saveEditedOfflineDraft}
            onDelete={removeOfflineDraft}
            onRetry={retryOfflineDraft}
            onSync={syncOfflineDrafts}
          />
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">Structured draft</CardTitle>
          <CardDescription>
            Save only when the bottle match is high-confidence. If JARVIS is unsure, choose one of the cellar alternatives first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {draft ? <DraftPreview draft={draft} onChooseBottle={chooseBottle} /> : (
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
  editingDraftId,
  editingTranscript,
  onEditTranscript,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onRetry,
  onSync,
}: {
  drafts: OfflineTastingDraft[];
  isBusy: boolean;
  editingDraftId: string | null;
  editingTranscript: string;
  onEditTranscript: (value: string) => void;
  onBeginEdit: (draft: OfflineTastingDraft) => void;
  onCancelEdit: () => void;
  onSaveEdit: (draft: OfflineTastingDraft) => void;
  onDelete: (draft: OfflineTastingDraft) => void;
  onRetry: (draft: OfflineTastingDraft) => void;
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
          Sync all
        </Button>
      </div>
      <div className="space-y-2">
        {drafts.slice(0, 5).map((offlineDraft) => {
          const isEditing = editingDraftId === offlineDraft.id;
          return (
            <div key={offlineDraft.id} className="rounded-2xl border border-border/70 bg-background/70 p-3 text-xs leading-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{offlineDraft.status}</span>
                <span className="text-muted-foreground">attempts {offlineDraft.attempts}</span>
              </div>
              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={editingTranscript}
                    onChange={(event) => onEditTranscript(event.target.value)}
                    className="min-h-24 rounded-2xl text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="rounded-full" onClick={() => onSaveEdit(offlineDraft)} disabled={!editingTranscript.trim()}>
                      <Check className="h-3.5 w-3.5" /> Save edit
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onCancelEdit}>
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 line-clamp-2 text-muted-foreground">{offlineDraft.transcript}</p>
                  {offlineDraft.selectedInventoryId ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">Bottle locked from cellar link.</div>
                  ) : null}
                  {offlineDraft.lastError ? <p className="mt-1 text-[11px] text-destructive">{offlineDraft.lastError}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onRetry(offlineDraft)} disabled={isBusy}>
                      <RotateCcw className="h-3.5 w-3.5" /> Retry
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => onBeginEdit(offlineDraft)} disabled={isBusy}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={() => onDelete(offlineDraft)} disabled={isBusy}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftPreview({ draft, onChooseBottle }: { draft: VoiceTastingDraft; onChooseBottle: (match: VoiceTastingMatch) => void }) {
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
        <WineMatchCard match={draft.matchedWine} selected />
      ) : (
        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/50 p-5 text-sm leading-6 text-amber-900">
          JARVIS could not lock this to a bottle. Add the producer, vintage, or wine name — or choose a cellar alternative below.
        </div>
      )}

      {draft.alternatives.length ? (
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Cellar alternatives</div>
          <div className="space-y-2">
            {draft.alternatives.map((match) => (
              <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{match.displayName}</div>
                  <div className="text-xs text-muted-foreground">{[match.producer, match.region].filter(Boolean).join(" • ")}</div>
                </div>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onChooseBottle(match)}>
                  Use this bottle
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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

function WineMatchCard({ match, selected }: { match: VoiceTastingMatch; selected?: boolean }) {
  return (
    <Link
      href={match.href}
      className="group block rounded-3xl border border-border/70 bg-background p-5 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground group-hover:text-primary">{match.displayName}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {[match.producer, match.region].filter(Boolean).join(" • ")}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline" className="rounded-full">{match.confidence} confidence</Badge>
        <Badge variant="secondary" className="rounded-full">match {match.matchScore}</Badge>
        {selected ? <Badge variant="default" className="rounded-full">selected bottle</Badge> : null}
      </div>
    </Link>
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
