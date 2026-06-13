"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JARVIS_BUSINESS_LANES, JARVIS_CAPTURE_SOURCE_TYPES } from "@/lib/jarvis/constants";
import { normalizeParticipants } from "@/lib/jarvis/format";
import type { JarvisCaptureResult } from "@/lib/jarvis/types";

const captureFormSchema = z.object({
  sourceType: z.enum(["manual", "note", "transcript", "meeting", "email", "document"]),
  businessLane: z.enum([
    "executive",
    "product",
    "commercial",
    "finance",
    "operations",
    "talent",
    "relationships",
    "personal",
  ]),
  title: z.string().trim().min(3, "Add a clear title.").max(140),
  content: z
    .string()
    .trim()
    .min(20, "Capture enough detail so it is useful later.")
    .max(12000),
  participantsInput: z.string().max(400),
  happenedAt: z.string().optional(),
});

type CaptureFormValues = z.output<typeof captureFormSchema>;

const defaultValues: CaptureFormValues = {
  sourceType: "manual",
  businessLane: "executive",
  title: "",
  content: "",
  participantsInput: "",
  happenedAt: "",
};

export function CaptureForm() {
  const router = useRouter();
  const [result, setResult] = useState<JarvisCaptureResult | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const form = useForm<CaptureFormValues>({
    resolver: zodResolver(captureFormSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors();

    const happenedAt = values.happenedAt ? new Date(values.happenedAt).toISOString() : null;
    const payload = {
      sourceType: values.sourceType,
      businessLane: values.businessLane,
      title: values.title.trim(),
      content: values.content.trim(),
      participants: normalizeParticipants(values.participantsInput),
      happenedAt,
    };

    try {
      const response = await fetch("/api/jarvis/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as JarvisCaptureResult | { errors?: Record<string, string[]>; message?: string };

      if (!response.ok) {
        if ("errors" in json && json.errors) {
          Object.entries(json.errors).forEach(([field, messages]) => {
            const [firstMessage] = messages;
            form.setError(field as keyof CaptureFormValues, {
              message: firstMessage ?? "Please review this field.",
            });
          });
        }

        toast.error(("message" in json && json.message) || "JARVIS could not save this capture.");
        return;
      }

      const captureResult = json as JarvisCaptureResult;
      setResult(captureResult);

      if (captureResult.success) {
        toast.success(captureResult.message);
        form.reset(defaultValues);
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      toast.info(captureResult.message);
    } catch {
      toast.error("The JARVIS capture endpoint is unavailable right now.");
    }
  });

  const isBusy = form.formState.isSubmitting || isRefreshing;

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-border/70 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="font-playfair text-3xl font-semibold tracking-tight">
            Canonical capture intake
          </CardTitle>
          <CardDescription className="max-w-2xl leading-7">
            Paste the note, transcript, or operating context while it is still accurate. JARVIS saves the event and the primary text artifact through the same intake path.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="grid gap-6 lg:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a source type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {JARVIS_CAPTURE_SOURCE_TYPES.map((sourceType) => (
                            <SelectItem key={sourceType.value} value={sourceType.value}>
                              {sourceType.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How this memory entered the system.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessLane"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business lane</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a lane" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {JARVIS_BUSINESS_LANES.map((lane) => (
                            <SelectItem key={lane.value} value={lane.value}>
                              {lane.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Which operating lane should inherit this memory.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Board follow-up on pricing posture" {...field} />
                    </FormControl>
                    <FormDescription>
                      Keep it precise enough to scan later at speed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-56 resize-y"
                        placeholder="Paste the raw note, transcript excerpt, or operating context here."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      JARVIS stores the full primary text artifact here so future views stay evidence-backed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <FormField
                  control={form.control}
                  name="participantsInput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Participants</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe, CFO, Founder" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional comma-separated list for people involved in the moment.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="happenedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Happened at</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional backdating when the capture is written after the fact.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6">
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  The live path writes a capture event plus a primary text artifact. If the database is unavailable, the form still validates and returns a typed preview response instead of failing hard.
                </p>
                <Button
                  type="submit"
                  className="rounded-full px-5"
                  disabled={isBusy}
                >
                  {isBusy ? "Saving capture..." : "Save canonical capture"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result ? (
        <Alert className="rounded-2xl border-border/70 bg-background/90">
          <AlertTitle>
            {result.success ? "Capture persisted" : "Capture preview only"}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{result.message}</p>
            <p className="text-sm text-muted-foreground">
              Latest title: <span className="font-medium text-foreground">{result.echo.title}</span>
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
