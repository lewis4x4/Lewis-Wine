"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Brain, ArrowUpRight, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { BottleBrainCitation, BottleBrainIntent } from "@/lib/bottle-brain";

type BottleBrainResponse = {
  success: boolean;
  question?: string;
  intent?: BottleBrainIntent;
  answer?: string;
  confidenceNote?: string;
  citations?: BottleBrainCitation[];
  searchedRecords?: number;
  error?: string;
};

const starterQuestions = [
  "What should I open tonight with high Brian-Fit?",
  "Which bottles need tasting memory next?",
  "What is at risk or past peak?",
  "What should I replace before I run out?",
];

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
              <Brain className="h-3.5 w-3.5" /> Bottle Brain
            </div>
            <div className="space-y-2">
              <h1 className="font-playfair text-5xl font-semibold tracking-tight text-foreground">Ask the cellar</h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Retrieval-grounded answers from your actual bottles, tasting memory, scan notes, drink windows, and Brian-Fit signal.
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
              This is not generic wine chat. It retrieves from your cellar records first, then answers with citations.
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
              {mutation.isPending ? "Retrieving cellar context..." : "Ask Bottle Brain"}
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
              {answer?.intent ? `Intent: ${answer.intent.replace("_", " ")}` : "Ask a question to retrieve bottle-level context."}
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
      </div>
    </Link>
  );
}
