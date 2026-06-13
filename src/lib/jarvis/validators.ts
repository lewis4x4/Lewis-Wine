import { z } from "zod";
import type { JarvisCaptureInput } from "@/lib/jarvis/types";

const jarvisBusinessLaneValues = [
  "executive",
  "product",
  "commercial",
  "finance",
  "operations",
  "talent",
  "relationships",
  "personal",
] as const;

const jarvisCaptureSourceValues = [
  "manual",
  "note",
  "transcript",
  "meeting",
  "email",
  "document",
] as const;

export const jarvisCaptureSchema = z.object({
  sourceType: z.enum(jarvisCaptureSourceValues),
  businessLane: z.enum(jarvisBusinessLaneValues),
  title: z.string().trim().min(3, "Add a clear title.").max(140, "Keep the title under 140 characters."),
  content: z
    .string()
    .trim()
    .min(20, "Capture enough detail to be useful later.")
    .max(12000, "Keep the first capture under 12,000 characters."),
  participants: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  happenedAt: z.string().trim().nullable().optional(),
});

export type JarvisCaptureSchemaInput = z.input<typeof jarvisCaptureSchema>;
export type JarvisCaptureSchemaOutput = JarvisCaptureInput;
