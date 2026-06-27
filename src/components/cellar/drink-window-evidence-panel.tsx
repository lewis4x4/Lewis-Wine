"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Pencil, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewStatus, SourceType, TruthLabel } from "@/lib/current-intelligence/types";
import type { DrinkWindowObservation } from "@/lib/drink-window-evidence";
import type { WineReadinessProfile } from "@/lib/wine-readiness";

const sourceOptions: Array<{ value: SourceType; label: string }> = [
  { value: "manual", label: "Manual / first-party" },
  { value: "cellartracker", label: "CellarTracker" },
  { value: "wine_market_journal", label: "Wine Market Journal" },
  { value: "provider", label: "Provider" },
  { value: "wine_searcher_trial", label: "Wine-Searcher" },
  { value: "winery", label: "Winery / producer" },
  { value: "retailer", label: "Retailer" },
  { value: "auction", label: "Auction" },
  { value: "public_web", label: "Public web" },
  { value: "ai_search", label: "AI web search" },
  { value: "ai_inferred", label: "AI inferred" },
  { value: "unknown", label: "Unknown" },
];

const truthOptions: Array<{ value: TruthLabel; label: string }> = [
  { value: "verified", label: "Verified" },
  { value: "estimated", label: "Estimated" },
  { value: "ai_inferred", label: "AI inferred" },
  { value: "unknown", label: "Unknown" },
  { value: "stale", label: "Stale" },
  { value: "rejected", label: "Rejected" },
];

type Props = {
  inventoryId: string;
  wineReferenceId?: string | null;
};

type ApiPayload = {
  success: boolean;
  tableReady?: boolean;
  observations?: DrinkWindowObservation[];
  appliedObservation?: DrinkWindowObservation | null;
  readiness?: WineReadinessProfile | null;
  message?: string;
  error?: string;
  issues?: string[];
};

type FormState = {
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string;
  truthLabel: TruthLabel;
  drinkAfter: string;
  drinkBefore: string;
  peakStart: string;
  peakEnd: string;
  servingGuidance: string;
  confidence: string;
  notes: string;
};

function blankForm(): FormState {
  return {
    sourceType: "winery",
    sourceName: "Producer drink-window note",
    sourceUrl: "",
    truthLabel: "estimated",
    drinkAfter: "",
    drinkBefore: "",
    peakStart: "",
    peakEnd: "",
    servingGuidance: "",
    confidence: "72",
    notes: "",
  };
}

function formFromObservation(observation: DrinkWindowObservation): FormState {
  return {
    sourceType: observation.sourceType,
    sourceName: observation.sourceName,
    sourceUrl: observation.sourceUrl ?? "",
    truthLabel: observation.truthLabel,
    drinkAfter: observation.drinkAfter ?? "",
    drinkBefore: observation.drinkBefore ?? "",
    peakStart: observation.peakStart ?? "",
    peakEnd: observation.peakEnd ?? "",
    servingGuidance: observation.servingGuidance ?? "",
    confidence: String(observation.confidence),
    notes: observation.notes ?? "",
  };
}

function confidenceFromForm(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function compactDate(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 10);
}

function statusVariant(status: ReviewStatus) {
  if (status === "accepted") return "secondary" as const;
  if (status === "rejected") return "destructive" as const;
  return "outline" as const;
}

function readinessLabel(profile?: WineReadinessProfile | null) {
  if (!profile) return "Not projected yet";
  return profile.phase.replace(/_/g, " ");
}

export function DrinkWindowEvidencePanel({ inventoryId, wineReferenceId }: Props) {
  const [observations, setObservations] = useState<DrinkWindowObservation[]>([]);
  const [appliedObservation, setAppliedObservation] = useState<DrinkWindowObservation | null>(null);
  const [readiness, setReadiness] = useState<WineReadinessProfile | null>(null);
  const [tableReady, setTableReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingObservation, setEditingObservation] = useState<DrinkWindowObservation | null>(null);
  const [addForm, setAddForm] = useState<FormState>(() => blankForm());
  const [editForm, setEditForm] = useState<FormState>(() => blankForm());

  const counts = useMemo(() => ({
    draft: observations.filter((item) => item.reviewStatus === "draft").length,
    accepted: observations.filter((item) => item.reviewStatus === "accepted").length,
    rejected: observations.filter((item) => item.reviewStatus === "rejected").length,
  }), [observations]);

  const loadObservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/drink-window-observations?inventoryId=${encodeURIComponent(inventoryId)}`);
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load drink-window evidence");
      setObservations(payload.observations ?? []);
      setAppliedObservation(payload.appliedObservation ?? null);
      setReadiness(payload.readiness ?? null);
      setTableReady(payload.tableReady !== false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load drink-window evidence");
    } finally {
      setIsLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

  async function saveNewObservation() {
    setIsSaving(true);
    try {
      const response = await fetch("/api/drink-window-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryId,
          wineReferenceId: wineReferenceId ?? null,
          sourceType: addForm.sourceType,
          sourceName: addForm.sourceName,
          sourceUrl: addForm.sourceUrl || null,
          truthLabel: addForm.truthLabel,
          reviewStatus: "draft",
          drinkAfter: addForm.drinkAfter || null,
          drinkBefore: addForm.drinkBefore || null,
          peakStart: addForm.peakStart || null,
          peakEnd: addForm.peakEnd || null,
          servingGuidance: addForm.servingGuidance || null,
          confidence: confidenceFromForm(addForm.confidence),
          notes: addForm.notes || null,
        }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.success) throw new Error(payload.issues?.join("; ") || payload.error || "Failed to save drink-window evidence");
      toast.success("Drink-window evidence saved for review.");
      setShowAddDialog(false);
      setAddForm(blankForm());
      await loadObservations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save drink-window evidence");
    } finally {
      setIsSaving(false);
    }
  }

  async function patchObservation(id: string, patch: Record<string, unknown>, successMessage: string) {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/drink-window-observations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.success) throw new Error(payload.issues?.join("; ") || payload.error || "Could not review drink-window evidence");
      toast.success(successMessage);
      await loadObservations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review drink-window evidence");
    } finally {
      setIsSaving(false);
    }
  }

  function openEdit(observation: DrinkWindowObservation) {
    setEditingObservation(observation);
    setEditForm(formFromObservation(observation));
  }

  async function saveEdit(reviewStatus?: ReviewStatus) {
    if (!editingObservation) return;
    await patchObservation(editingObservation.id, {
      reviewStatus: reviewStatus ?? editingObservation.reviewStatus,
      sourceType: editForm.sourceType,
      sourceName: editForm.sourceName,
      sourceUrl: editForm.sourceUrl || null,
      truthLabel: editForm.truthLabel,
      drinkAfter: editForm.drinkAfter || null,
      drinkBefore: editForm.drinkBefore || null,
      peakStart: editForm.peakStart || null,
      peakEnd: editForm.peakEnd || null,
      servingGuidance: editForm.servingGuidance || null,
      confidence: confidenceFromForm(editForm.confidence),
      notes: editForm.notes || null,
    }, reviewStatus === "accepted" ? "Edited evidence accepted." : "Evidence updated.");
    setEditingObservation(null);
  }

  const activeProjection = appliedObservation
    ? `${appliedObservation.sourceName} · ${appliedObservation.confidence}% confidence`
    : tableReady
      ? "No accepted source-backed drink-window evidence is currently driving readiness."
      : "Local migration pending before review/apply can store structured evidence.";

  return (
    <>
      <Card id="drink-window-evidence" className="border-muted/80">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-primary" />
                Drink-window evidence
              </CardTitle>
              <CardDescription>
                Reviewable aging guidance. Accepted evidence can project readiness; cellar truth is not overwritten.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setShowAddDialog(true)} disabled={!tableReady}>Add window evidence</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected readiness</p>
              <p className="mt-1 text-lg font-semibold capitalize">{readinessLabel(readiness)}</p>
              <p className="text-xs text-muted-foreground">{readiness?.confidence.replace("-", " ") ?? "unknown"}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Applied evidence</p>
              <p className="mt-1 text-sm font-medium">{activeProjection}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Review queue</p>
              <p className="mt-1 text-lg font-semibold">{counts.draft}</p>
              <p className="text-xs text-muted-foreground">draft observations</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Trusted rows</p>
              <p className="mt-1 text-lg font-semibold">{counts.accepted}</p>
              <p className="text-xs text-muted-foreground">accepted · {counts.rejected} rejected</p>
            </div>
          </div>

          {!tableReady && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              The local API/UI path is wired, but this environment has not applied the drink-window observation migration yet.
            </div>
          )}

          <div className="space-y-2">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading drink-window evidence...</p> : observations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No structured drink-window evidence yet. Add a producer sheet, import row, or manual judgment as draft evidence first.</p>
            ) : observations.map((observation) => (
              <div key={observation.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{observation.sourceName}</span>
                      <Badge variant={statusVariant(observation.reviewStatus)} className="capitalize">{observation.reviewStatus}</Badge>
                      <Badge variant="outline" className="capitalize">{observation.truthLabel.replace(/_/g, " ")}</Badge>
                      {appliedObservation?.id === observation.id && <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" /> Applied</Badge>}
                    </div>
                    <p className="text-muted-foreground">
                      Drink {compactDate(observation.drinkAfter)} → {compactDate(observation.drinkBefore)}
                      {observation.peakStart || observation.peakEnd ? ` · peak ${compactDate(observation.peakStart)} → ${compactDate(observation.peakEnd)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{observation.sourceType.replace(/_/g, " ")} · confidence {observation.confidence}% · observed {compactDate(observation.observedAt)}</p>
                    {observation.servingGuidance && <p className="text-xs text-muted-foreground">{observation.servingGuidance}</p>}
                    {observation.sourceUrl && <a className="text-xs underline" href={observation.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(observation)} disabled={isSaving}><Pencil className="h-4 w-4" /> Edit</Button>
                    {observation.reviewStatus !== "accepted" && (
                      <Button size="sm" onClick={() => patchObservation(observation.id, { reviewStatus: "accepted" }, "Drink-window evidence accepted.")} disabled={isSaving}>
                        <CheckCircle2 className="h-4 w-4" /> Accept
                      </Button>
                    )}
                    {observation.reviewStatus !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => patchObservation(observation.id, { reviewStatus: "rejected" }, "Drink-window evidence rejected.")} disabled={isSaving}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    )}
                    {observation.reviewStatus === "accepted" && (
                      <Button size="sm" variant="outline" onClick={() => patchObservation(observation.id, { reviewStatus: "superseded" }, "Drink-window evidence superseded.")} disabled={isSaving}>
                        Supersede
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EvidenceDialog
        title="Add drink-window evidence"
        description="Save as draft first. Brian can accept it after reviewing the source."
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        form={addForm}
        setForm={setAddForm}
        onSave={saveNewObservation}
        saveLabel={isSaving ? "Saving..." : "Save draft"}
        disabled={isSaving}
      />

      <EvidenceDialog
        title="Edit drink-window evidence"
        description="Edit the source facts, then save or accept the reviewed row."
        open={Boolean(editingObservation)}
        onOpenChange={(open) => { if (!open) setEditingObservation(null); }}
        form={editForm}
        setForm={setEditForm}
        onSave={() => saveEdit()}
        onAccept={() => saveEdit("accepted")}
        saveLabel={isSaving ? "Saving..." : "Save edit"}
        disabled={isSaving}
      />
    </>
  );
}

type EvidenceDialogProps = {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormState;
  setForm: (form: FormState) => void;
  onSave: () => void | Promise<void>;
  onAccept?: () => void | Promise<void>;
  saveLabel: string;
  disabled?: boolean;
};

function EvidenceDialog({ title, description, open, onOpenChange, form, setForm, onSave, onAccept, saveLabel, disabled }: EvidenceDialogProps) {
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2 md:grid-cols-2">
          <div className="grid gap-1">
            <Label>Source type</Label>
            <Select value={form.sourceType} onValueChange={(value) => update("sourceType", value as SourceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{sourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Truth label</Label>
            <Select value={form.truthLabel} onValueChange={(value) => update("truthLabel", value as TruthLabel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{truthOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 md:col-span-2"><Label>Source name</Label><Input value={form.sourceName} onChange={(event) => update("sourceName", event.target.value)} /></div>
          <div className="grid gap-1 md:col-span-2"><Label>Source URL</Label><Input value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="Optional, required for web/winery/retailer evidence to drive readiness" /></div>
          <div className="grid gap-1"><Label>Drink after</Label><Input value={form.drinkAfter} onChange={(event) => update("drinkAfter", event.target.value)} placeholder="2026 or 2026-01-01" /></div>
          <div className="grid gap-1"><Label>Drink before</Label><Input value={form.drinkBefore} onChange={(event) => update("drinkBefore", event.target.value)} placeholder="2032 or 2032-12-31" /></div>
          <div className="grid gap-1"><Label>Peak start</Label><Input value={form.peakStart} onChange={(event) => update("peakStart", event.target.value)} placeholder="Optional" /></div>
          <div className="grid gap-1"><Label>Peak end</Label><Input value={form.peakEnd} onChange={(event) => update("peakEnd", event.target.value)} placeholder="Optional" /></div>
          <div className="grid gap-1"><Label>Confidence</Label><Input value={form.confidence} onChange={(event) => update("confidence", event.target.value)} inputMode="numeric" /></div>
          <div className="grid gap-1 md:col-span-2"><Label>Serving guidance</Label><Textarea value={form.servingGuidance} onChange={(event) => update("servingGuidance", event.target.value)} placeholder="Decanting, temperature, or opening guidance" /></div>
          <div className="grid gap-1 md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Why this source should or should not drive readiness" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={disabled}>Cancel</Button>
          {onAccept && <Button variant="outline" onClick={onAccept} disabled={disabled}>Accept edited</Button>}
          <Button onClick={onSave} disabled={disabled}>{saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
