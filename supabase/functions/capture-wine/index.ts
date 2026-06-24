import { anthropicJson, fixtureEnabled, jsonResponse } from "../_shared/intelligence.ts";

type CaptureCandidate = {
  producer: string | null;
  label: string | null;
  vintage: number | null;
  region: string | null;
  subregion?: string | null;
  country?: string | null;
  varietal: string | null;
  wine_type: "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null;
  confidence: Record<string, number>;
  ambiguous_fields: string[];
};

const fixtureCandidate: CaptureCandidate = {
  producer: "Tapiz",
  label: "Alta Collection Cabernet Sauvignon",
  vintage: 2021,
  region: "Mendoza",
  subregion: "San Pablo Vineyard, Uco Valley",
  country: "Argentina",
  varietal: "Cabernet Sauvignon",
  wine_type: "red",
  confidence: { producer: 0.95, label: 0.9, vintage: 0.92, region: 0.86, varietal: 0.94, wine_type: 0.9 },
  ambiguous_fields: [],
};

function normalizeConfidence(value: unknown) {
  return typeof value === "number" ? Math.max(0, Math.min(1, value > 1 ? value / 100 : value)) : 0;
}

function followUp(candidate: CaptureCandidate) {
  const producerConfidence = normalizeConfidence(candidate.confidence?.producer) || (candidate.producer ? 0.75 : 0);
  const vintageConfidence = normalizeConfidence(candidate.confidence?.vintage) || (candidate.vintage ? 0.75 : 0);
  if (!candidate.producer || producerConfidence < 0.6) return "Who is the producer on this bottle?";
  if (!candidate.vintage || vintageConfidence < 0.6) return "What vintage year is this bottle?";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST required" }, 405);
  try {
    const body = await req.json();
    const candidate = fixtureEnabled()
      ? fixtureCandidate
      : await anthropicJson<CaptureCandidate>({
        model: "claude-sonnet-4-6",
        system: "You are a wine-label extraction engine. Return JSON only with producer,label,vintage,region,subregion,country,varietal,wine_type,confidence,ambiguous_fields. Confidence values must be 0-1. Never include prose outside JSON.",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Read this wine bottle label. Hint: ${body.hint ?? "none"}` },
            { type: "image", source: { type: "base64", media_type: body.media_type ?? "image/jpeg", data: body.image_base64 } },
          ],
        }],
      });
    const question = followUp(candidate);
    return jsonResponse({
      candidate,
      matched_wine_id: null,
      needs_follow_up: Boolean(question),
      follow_up_question: question,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("[BLOCKED") ? 424 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
});
