"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Brain, CheckCircle2, CircleDollarSign, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { summarizePricePosture, type PriceObservation, type SourceType } from "@/lib/current-intelligence/price-observations";

type RefreshObservation = Partial<PriceObservation> & { sourceType: SourceType; observedPriceCents?: number | null; confidence?: number };

type AnthropicRefreshCost = {
  estimatedCostUsd?: number | null;
  model?: string | null;
  webSearchUses?: number | null;
  usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    server_tool_use?: {
      web_search_requests?: number | null;
    } | null;
  } | null;
};

type RefreshProviderStatus = {
  anthropic?: AnthropicRefreshCost | null;
};

type Props = {
  inventoryId: string;
  wineReferenceId?: string | null;
  onApplyMarketValue?: (patch: { current_market_value_cents: number; market_value_source: "manual" | "estimate" | "wine-searcher" | "vivino"; market_value_updated_at: string }) => Promise<void>;
};

function money(cents?: number | null) {
  if (cents == null) return "Unknown";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function estimatedRefreshCost(status?: RefreshProviderStatus | null) {
  const anthropic = status?.anthropic;
  if (!anthropic?.estimatedCostUsd && anthropic?.estimatedCostUsd !== 0) return null;
  const searches = anthropic.usage?.server_tool_use?.web_search_requests ?? anthropic.webSearchUses ?? 0;
  const tokenParts = [
    anthropic.usage?.input_tokens != null ? `${anthropic.usage.input_tokens.toLocaleString()} in` : null,
    anthropic.usage?.output_tokens != null ? `${anthropic.usage.output_tokens.toLocaleString()} out` : null,
    searches ? `${searches} web search${searches === 1 ? "" : "es"}` : null,
  ].filter(Boolean).join(" · ");
  return {
    cost: `$${anthropic.estimatedCostUsd.toFixed(4)}`,
    detail: [anthropic.model, tokenParts].filter(Boolean).join(" · "),
  };
}

function marketSourceFor(sourceType: SourceType): "manual" | "estimate" | "wine-searcher" | "vivino" {
  if (sourceType === "manual" || sourceType === "cellartracker" || sourceType === "wine_market_journal") return "manual";
  if (sourceType === "wine_searcher_trial" || sourceType === "provider") return "wine-searcher";
  return "estimate";
}

export function PriceEvidencePanel({ inventoryId, wineReferenceId, onApplyMarketValue }: Props) {
  const [observations, setObservations] = useState<PriceObservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ observations: RefreshObservation[]; evidence: { title: string; detail?: string; confidence: number; sourceUrl?: string | null }[]; gaps: string[]; providerStatus?: RefreshProviderStatus | null } | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [manualKind, setManualKind] = useState("market_value");
  const [manualSourceType, setManualSourceType] = useState<SourceType>("manual");
  const [manualSourceName, setManualSourceName] = useState("Manual verified value");
  const [manualUrl, setManualUrl] = useState("");
  const [manualNotes, setManualNotes] = useState("");

  const posture = useMemo(() => summarizePricePosture(observations), [observations]);

  const loadObservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/price-observations?inventoryId=${inventoryId}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to load evidence");
      setObservations(payload.observations ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load price evidence");
    } finally {
      setIsLoading(false);
    }
  }, [inventoryId]);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

  async function saveObservation(input: RefreshObservation, reviewStatus: "draft" | "accepted" = "accepted") {
    const response = await fetch("/api/price-observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inventoryId,
        wineReferenceId,
        sourceType: input.sourceType,
        sourceName: input.sourceName ?? input.sourceType,
        sourceUrl: input.sourceUrl || null,
        observationKind: input.observationKind ?? "market_value",
        truthLabel: input.truthLabel,
        reviewStatus,
        observedPriceCents: input.observedPriceCents ?? null,
        currency: input.currency ?? "USD",
        bottleSizeMl: input.bottleSizeMl ?? 750,
        vintage: input.vintage ?? null,
        confidence: input.confidence ?? 75,
        observedAt: input.observedAt ?? new Date().toISOString(),
        notes: input.notes ?? null,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error ?? "Failed to save observation");
    return payload.observation as PriceObservation;
  }

  async function addManualEvidence() {
    const cents = Math.round(Number(manualValue) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Enter a valid value.");
      return;
    }
    try {
      await saveObservation({
        sourceType: manualSourceType,
        sourceName: manualSourceName,
        sourceUrl: manualUrl || null,
        observationKind: manualKind as PriceObservation["observationKind"],
        observedPriceCents: cents,
        confidence: manualSourceType === "manual" ? 92 : 75,
        notes: manualNotes || null,
      });
      toast.success("Price evidence saved.");
      setShowManualDialog(false);
      setManualValue("");
      await loadObservations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save evidence");
    }
  }

  async function refreshIntelligence(scope: "quick" | "pricing" | "readiness" | "deep" | "replacement" = "quick") {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/bottle-intelligence/refresh/${inventoryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, force: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Refresh failed");
      setRefreshResult({ observations: payload.observations ?? [], evidence: payload.evidence ?? [], gaps: payload.gaps ?? [], providerStatus: payload.providerStatus ?? null });
      setShowRefreshDialog(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh intelligence");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function acceptRefreshObservation(observation: RefreshObservation) {
    try {
      await saveObservation(observation, "accepted");
      toast.success("Evidence accepted.");
      await loadObservations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not accept evidence");
    }
  }

  async function applyMarketValue() {
    const market = posture.market.observation;
    if (!market?.observedPriceCents || !onApplyMarketValue) return;
    await onApplyMarketValue({
      current_market_value_cents: market.observedPriceCents,
      market_value_source: marketSourceFor(market.sourceType),
      market_value_updated_at: new Date().toISOString(),
    });
  }

  const refreshCost = estimatedRefreshCost(refreshResult?.providerStatus);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><BadgeDollarSign className="h-5 w-5" /> Current intelligence</CardTitle>
              <CardDescription>Evidence-backed pricing and refreshable bottle context without paid API dependency.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowManualDialog(true)}>Add price evidence</Button>
              <Button onClick={() => refreshIntelligence("quick")} disabled={isRefreshing}>
                <RefreshCw className="h-4 w-4" /> {isRefreshing ? "Refreshing..." : "Quick refresh"}
              </Button>
              <Button variant="outline" onClick={() => refreshIntelligence("deep")} disabled={isRefreshing}>
                Deep search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Market value</p>
              <p className="text-2xl font-semibold">{money(posture.market.valueCents)}</p>
              <p className="text-xs text-muted-foreground">{posture.market.sourceName ?? "No verified market evidence"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Replacement price</p>
              <p className="text-2xl font-semibold">{money(posture.replacement.valueCents)}</p>
              <p className="text-xs text-muted-foreground">Retailer/winery listings stay separate from market value.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidence health</p>
              <p className="text-2xl font-semibold">{posture.acceptedCount}</p>
              <p className="text-xs text-muted-foreground">accepted observations · {posture.staleCount} stale</p>
            </div>
          </div>

          {posture.market.observation && onApplyMarketValue && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
              <span>Best accepted market signal: {money(posture.market.valueCents)} from {posture.market.sourceName}.</span>
              <Button size="sm" variant="outline" onClick={applyMarketValue}>Use as current market value</Button>
            </div>
          )}

          <div className="space-y-2">
            {isLoading ? <p className="text-sm text-muted-foreground">Loading evidence...</p> : observations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No price evidence yet. Unknown stays Unknown until a source is saved.</p>
            ) : observations.slice(0, 6).map((observation) => (
              <div key={observation.id} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{money(observation.observedPriceCents)}</span>
                    <Badge variant="outline">{observation.observationKind.replace(/_/g, " ")}</Badge>
                    <Badge variant="secondary">{observation.truthLabel.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-muted-foreground">{observation.sourceName ?? observation.sourceType} · confidence {observation.confidence}%</p>
                </div>
                {observation.sourceUrl && <a className="text-xs underline" href={observation.sourceUrl} target="_blank" rel="noreferrer">source</a>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add price evidence</DialogTitle>
            <DialogDescription>Save the source first. You can apply it to cellar truth separately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Value</Label><Input value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="128" inputMode="decimal" /></div>
            <div className="grid gap-1"><Label>Kind</Label><Select value={manualKind} onValueChange={setManualKind}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="market_value">Market value</SelectItem><SelectItem value="replacement_price">Replacement price</SelectItem><SelectItem value="auction_comp">Auction comp</SelectItem><SelectItem value="purchase_price">Purchase price</SelectItem><SelectItem value="estimate">AI/manual estimate</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1"><Label>Source type</Label><Select value={manualSourceType} onValueChange={(value) => setManualSourceType(value as SourceType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual verified</SelectItem><SelectItem value="cellartracker">CellarTracker</SelectItem><SelectItem value="wine_market_journal">Wine Market Journal</SelectItem><SelectItem value="retailer">Retailer</SelectItem><SelectItem value="winery">Winery</SelectItem><SelectItem value="auction">Auction</SelectItem><SelectItem value="ai_inferred">AI inferred</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1"><Label>Source name</Label><Input value={manualSourceName} onChange={(event) => setManualSourceName(event.target.value)} /></div>
            <div className="grid gap-1"><Label>Source URL</Label><Input value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="Optional" /></div>
            <div className="grid gap-1"><Label>Notes</Label><Textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} placeholder="Tax/shipping excluded, exact vintage, auction premium included, etc." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowManualDialog(false)}>Cancel</Button><Button onClick={addManualEvidence}>Save evidence</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRefreshDialog} onOpenChange={setShowRefreshDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Intelligence refresh results</DialogTitle>
            <DialogDescription>Review source-backed findings. AI output is draft evidence until you accept it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {refreshCost ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">Refresh cost: {refreshCost.cost}</div>
                <p className="text-xs text-muted-foreground">{refreshCost.detail}</p>
              </div>
            ) : null}
            {refreshResult?.gaps?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{refreshResult.gaps.map((gap) => <p key={gap}>{gap}</p>)}</div> : null}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Price observations</p>
                <Button size="sm" variant="outline" onClick={() => setShowManualDialog(true)}>Add manually</Button>
              </div>
              {refreshResult?.observations?.length ? refreshResult.observations.map((observation, index) => (
                <div key={`${observation.sourceName}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /><span className="font-medium">{money(observation.observedPriceCents)}</span><Badge variant="outline">{observation.observationKind}</Badge></div>
                    <p className="text-sm text-muted-foreground">{observation.sourceName ?? observation.sourceType} · confidence {observation.confidence ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">{observation.notes}</p>
                  </div>
                  <Button size="sm" onClick={() => acceptRefreshObservation(observation)}><CheckCircle2 className="h-4 w-4" /> Accept</Button>
                </div>
              )) : <p className="text-sm text-muted-foreground">No price observations were produced. Market value remains Unknown until you save manual, CellarTracker, WMJ, auction, or provider evidence.</p>}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Source-backed findings</p>
              {refreshResult?.evidence?.length ? refreshResult.evidence.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="secondary">confidence {item.confidence}%</Badge>
                  </div>
                  {item.detail ? <p className="mt-1 text-muted-foreground">{item.detail}</p> : null}
                  {item.sourceUrl ? <a className="mt-2 inline-block text-xs underline" href={item.sourceUrl} target="_blank" rel="noreferrer">Open source</a> : null}
                </div>
              )) : <p className="text-sm text-muted-foreground">No source-backed findings were returned. Try Deep refresh, add manual evidence, or import CellarTracker export data.</p>}
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> Trust policy</div>
              <p className="text-muted-foreground">Retailer listings become replacement price; market value requires manual, CellarTracker, WMJ, or licensed/provider evidence.</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowRefreshDialog(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
