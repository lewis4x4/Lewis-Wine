"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Brain, ArrowUpRight, Send, Sparkles, ShieldCheck, Lightbulb, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type {
  BottleBrainAnswer,
  BottleBrainCitation,
  BottleBrainDecisionMode,
  BottleBrainEvidenceClaim,
  BottleBrainEvidencePacket,
  BottleBrainIntent,
  BottleBrainNextSignal,
} from "@/lib/bottle-brain";

type BottleBrainResponse = Partial<BottleBrainAnswer> & {
  success: boolean;
  question?: string;
  intent?: BottleBrainIntent;
  decisionMode?: BottleBrainDecisionMode;
  answer?: string;
  confidenceNote?: string;
  citations?: BottleBrainCitation[];
  evidencePackets?: BottleBrainEvidencePacket[];
  groundedClaims?: BottleBrainEvidenceClaim[];
  knownFromCellar?: BottleBrainEvidenceClaim[];
  inferredFromBrianFit?: BottleBrainEvidenceClaim[];
  needsMoreSignal?: BottleBrainEvidenceClaim[];
  nextSignals?: BottleBrainNextSignal[];
  searchedRecords?: number;
  error?: string;
};

const starterQuestions = [
  "What should I open tonight with high Brian-Fit?",
  "For guests, compare the Cabernet vs Pinot and give me the safe pick",
  "Steak dinner celebration tonight — give me a safe pick and an interesting alternate",
  "Audit what Bottle Brain knows and where it is guessing",
  "Which bottles need tasting memory next?",
  "What is at risk or past peak?",
  "What should I replace before I run out?",
];

const modeLabels: Record<BottleBrainDecisionMode, string> = {
  tonight: "Tonight",
  guest: "Guest",
  cellar_risk: "Risk",
  buying: "Buying",
  learning: "Learning",
  occasion: "Occasion",
  audit: "Audit",
  general: "General",
};

async function askBottleBrain(question: string): Promise<BottleBrainResponse> {
  const response = await fetch("/api/bottle-brain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Bottle Brain could not answer.");
  }
  return data;
}

export default function BottleBrainPage() {
  const [question, setQuestion] = useState(starterQuestions[0]);
  const [answer, setAnswer] = useState<BottleBrainResponse | null>(null);

  const mutation = useMutation({
    mutationFn: askBottleBrain,
    onSuccess: setAnswer,
  });

  const submitQuestion = (nextQuestion = question) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    mutation.mutate(trimmed);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 px-8 py-8 shadow-[0_20px_60px_-40px_rgba(120,24,40,0.35)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Brain className="h-3.5 w-3.5" /> Bottle Brain Trust Layer
            </div>
            <div className="space-y-2">
              <h1 className="font-playfair text-5xl font-semibold tracking-tight text-foreground">Ask the cellar</h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Citation-constrained cellar intelligence: decisions from actual bottles, drink windows, tasting memory,
                Brian-Fit signal, and explicit uncertainty.
              </p>
            </div>
          </div>
          <Link href="/cellar">
            <Button variant="outline" className="h-11 rounded-full px-5">
              Back to cellar
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[28px] border-border/60 bg-background/96 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 tracking-tight">
              <Sparkles className="h-5 w-5 text-primary" /> Ask a real cellar question
            </CardTitle>
            <CardDescription>
              Decision modes are inferred automatically: tonight, guest, risk, buying, learning, occasion, or audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-32 rounded-3xl border-border/60 bg-background p-4 text-base"
              placeholder="Ask what to open, what is at risk, what to replace, or where the taste model is thin."
            />
            <Button
              className="h-11 w-full rounded-full"
              disabled={mutation.isPending || !question.trim()}
              onClick={() => submitQuestion()}
            >
              <Send className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Retrieving cited cellar evidence..." : "Ask Bottle Brain"}
            </Button>

            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Starter prompts</div>
              <div className="flex flex-wrap gap-2">
                {starterQuestions.map((starter) => (
                  <Button
                    key={starter}
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-full px-3 py-2 text-xs"
                    onClick={() => submitQuestion(starter)}
                    disabled={mutation.isPending}
                  >
                    {starter}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-background/96 shadow-sm">
          <CardHeader>
            <CardTitle className="tracking-tight">Answer</CardTitle>
            <CardDescription>
              {answer?.decisionMode
                ? `Mode: ${modeLabels[answer.decisionMode]} • Intent: ${answer.intent?.replace("_", " ") ?? "general"}`
                : "Ask a question to retrieve bottle-level context."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {mutation.isError ? (
              <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
                {mutation.error.message}
              </div>
            ) : answer ? (
              <>
                <div className="rounded-3xl border border-border/60 bg-muted/20 p-5 text-base leading-7 text-foreground">
                  {answer.answer}
                </div>
                {answer.confidenceNote && (
                  <div className="rounded-2xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Grounding:</span> {answer.confidenceNote}
                  </div>
                )}

                <ModeStrategy answer={answer} />

                <EvidenceSummary answer={answer} />

                <div className="space-y-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Evidence packets</div>
                  {answer.evidencePackets?.length ? (
                    answer.evidencePackets.map((packet) => <EvidencePacketCard key={packet.id} packet={packet} />)
                  ) : (
                    <p className="text-sm text-muted-foreground">No evidence packets returned yet.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Citations</div>
                  {answer.citations?.length ? (
                    answer.citations.map((citation) => <CitationCard key={citation.id} citation={citation} />)
                  ) : (
                    <p className="text-sm text-muted-foreground">No citations returned yet.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-muted-foreground">
                Bottle Brain is ready. Ask it something operational.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ModeStrategy({ answer }: { answer: BottleBrainResponse }) {
  if (!answer.modeProfile) return null;

  return (
    <div className="rounded-3xl border border-border/60 bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Decision strategy</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{answer.modeProfile.label}</div>
          <p className="mt-1 text-sm text-muted-foreground">{answer.modeProfile.promise}</p>
        </div>
        <Badge variant="secondary" className="rounded-full">{answer.modeProfile.primaryQuestion}</Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Priorities</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {answer.modeProfile.priorities.map((priority) => (
              <Badge key={priority} variant="outline" className="rounded-full capitalize">{priority.replaceAll("_", " ")}</Badge>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Guardrails</div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {answer.modeProfile.guardrails.slice(0, 2).map((guardrail) => <li key={guardrail}>{guardrail}</li>)}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tradeoffs</div>
          {answer.tradeoffs?.length ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {answer.tradeoffs.map((tradeoff) => <li key={`${tradeoff.winnerCitationId}-${tradeoff.label}`}>{tradeoff.label}: {tradeoff.reason}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No tradeoff needed yet.</p>
          )}
        </div>
      </div>
      {answer.occasionSignals?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {answer.occasionSignals.map((signal) => <Badge key={signal} className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">Occasion: {signal}</Badge>)}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceSummary({ answer }: { answer: BottleBrainResponse }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <ClaimList
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Known"
        claims={answer.knownFromCellar ?? []}
        empty="No hard cellar facts."
      />
      <ClaimList
        icon={<Sparkles className="h-4 w-4" />}
        title="Inferred"
        claims={answer.inferredFromBrianFit ?? []}
        empty="No Brian-Fit inference."
      />
      <SignalList signals={answer.nextSignals ?? []} />
    </div>
  );
}

function ClaimList({
  icon,
  title,
  claims,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  claims: BottleBrainEvidenceClaim[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {icon} {title}
      </div>
      {claims.length ? (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {claims.slice(0, 3).map((claim) => (
            <li key={`${claim.citationId}-${claim.text}`}>{claim.text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function SignalList({ signals }: { signals: BottleBrainNextSignal[] }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Lightbulb className="h-4 w-4" /> Next signal
      </div>
      {signals.length ? (
        <ul className="space-y-2 text-sm text-muted-foreground">
          {signals.slice(0, 3).map((signal) => (
            <li key={`${signal.citationId}-${signal.text}`}>{signal.text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No next signal yet.</p>
      )}
    </div>
  );
}

function EvidencePacketCard({ packet }: { packet: BottleBrainEvidencePacket }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{packet.displayName}</div>
          <div className="mt-1 text-sm text-muted-foreground">{packet.whyRetrieved}</div>
        </div>
        <Badge variant="outline" className="rounded-full capitalize">
          {packet.evidenceStrength} evidence
        </Badge>
        <Badge variant="secondary" className="rounded-full capitalize">
          {packet.modeRole.replace("_", " ")}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-full">{packet.readiness.label}</Badge>
        <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">Action: {packet.recommendedAction.replace("_", " ")}</Badge>
      </div>
      {packet.needsMoreSignal.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{packet.needsMoreSignal[0].text}</span>
        </div>
      )}
    </div>
  );
}

function CitationCard({ citation }: { citation: BottleBrainCitation }) {
  return (
    <Link
      href={citation.href}
      className="group block rounded-3xl border border-border/60 bg-muted/10 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground group-hover:text-primary">{citation.displayName}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {[citation.producer, citation.region].filter(Boolean).join(" • ") || "Producer/region not captured"}
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {citation.brian_fit_score != null && (
          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{citation.brian_fit_score} Brian-Fit</Badge>
        )}
        <Badge variant="outline" className="rounded-full">{citation.quantity} {citation.quantity === 1 ? "bottle" : "bottles"}</Badge>
        <Badge variant="secondary" className="rounded-full">{citation.whyRetrieved}</Badge>
        <Badge variant="outline" className="rounded-full capitalize">{citation.recommendedAction.replace("_", " ")}</Badge>
      </div>
    </Link>
  );
}
