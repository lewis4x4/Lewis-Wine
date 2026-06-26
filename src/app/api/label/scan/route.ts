import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/anthropic-config";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_AI_IMAGE_UPLOAD_BYTES,
  checkRateLimit,
  isAllowedAiImageMimeType,
  validateAiImageUpload,
} from "@/lib/api-security";
import type { LabelScanResult } from "@/types/database";

type LabelImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type LabelImagePayload = {
  mediaType: LabelImageMediaType;
  base64: string;
};

function parseDataUrl(dataUrl: string): LabelImagePayload | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1] as LabelImageMediaType, base64: match[2] };
}

function validateBase64Image(mediaType: string, base64: string): { error: string; status: number } | null {
  if (!isAllowedAiImageMimeType(mediaType)) {
    return { error: "Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image.", status: 400 };
  }
  const normalized = base64.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    return { error: "Invalid image data. Please upload the label photo again.", status: 400 };
  }
  const byteLength = Buffer.byteLength(normalized, "base64");
  if (!byteLength) return { error: "Invalid image data. Please upload the label photo again.", status: 400 };
  if (byteLength > MAX_AI_IMAGE_UPLOAD_BYTES) return { error: "Image is too large. Maximum upload size is 8MB.", status: 400 };
  return null;
}

async function readLabelImage(request: NextRequest): Promise<LabelImagePayload | { error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: { data_url?: string; image_base64?: string; media_type?: string };
    try {
      body = await request.json() as { data_url?: string; image_base64?: string; media_type?: string };
    } catch {
      return { error: "Image payload was too large or incomplete. Please upload the label photo again.", status: 413 };
    }
    const payload = body.data_url ? parseDataUrl(body.data_url) : body.image_base64 && body.media_type ? { mediaType: body.media_type as LabelImageMediaType, base64: body.image_base64 } : null;
    if (!payload) return { error: "No label image provided", status: 400 };
    const validationError = validateBase64Image(payload.mediaType, payload.base64);
    return validationError ?? payload;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { error: "Invalid image upload body. Please choose the label photo again.", status: 400 };
  }
  const file =
    (formData.get("label") as File | null) ??
    (formData.get("image") as File | null);

  if (!file) return { error: "No label image provided", status: 400 };

  const uploadError = validateAiImageUpload(file);
  if (uploadError) return { error: uploadError, status: 400 };

  const bytes = await file.arrayBuffer();
  return { mediaType: file.type as LabelImageMediaType, base64: Buffer.from(bytes).toString("base64") };
}

export async function POST(request: NextRequest) {
  try {
    // Verify API key is configured
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "Service not configured", wine: null, raw_text: "" },
        { status: 503 }
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", wine: null, raw_text: "" },
        { status: 401 }
      );
    }

    const rateLimit = checkRateLimit(`label-scan:${user.id}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many label scans. Please wait before trying again.",
          wine: null,
          raw_text: "",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const anthropic = new Anthropic({
      apiKey,
    });

    const image = await readLabelImage(request);
    if ("error" in image) {
      return NextResponse.json(
        { success: false, error: image.error, wine: null, raw_text: "" },
        { status: image.status }
      );
    }

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.base64,
              },
            },
            {
              type: "text",
              text: `Analyze this wine bottle label and extract all wine information. Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:

{
  "name": "full wine name (e.g., 'Cabernet Sauvignon' or 'Estate Reserve Cabernet Sauvignon')",
  "producer": "winery/producer name (e.g., 'Harvester', 'Château Margaux')",
  "vintage": 2020 (4-digit year as number, or null if not visible),
  "wine_type": "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null,
  "region": "wine region (e.g., 'Paso Robles', 'Napa Valley', 'Bordeaux')",
  "sub_region": "sub-region or AVA if visible (e.g., 'Estrella District', 'Rutherford')",
  "country": "country of origin (e.g., 'USA', 'France', 'Italy')",
  "appellation": "appellation or designation if visible",
  "grape_varieties": ["array", "of", "grape", "varieties"] or null,
  "alcohol_percentage": 14.5 (as decimal number) or null,
  "confidence": 85 (0-100 confidence score for overall extraction quality),
  "detected_descriptors": ["dark fruit", "cedar", "full-bodied"] or [],
  "suggested_tasting_note": "short provisional tasting note based only on label-visible cues, or null",
  "brian_fit_hint": "short note explaining why this may or may not fit Brian's known palate, or null",
  "raw_text": "transcription of all visible text on the label"
}

Important guidelines:
- Extract information exactly as shown on the label
- The "name" should be the wine's name (varietal, blend name, or proprietary name), NOT the producer
- The "producer" should be the winery or producer name
- For wine_type, infer from the varietal if not explicitly stated:
  - Cabernet Sauvignon, Merlot, Pinot Noir, Zinfandel, Syrah = red
  - Chardonnay, Sauvignon Blanc, Riesling, Pinot Grigio = white
  - Look for "Rosé" or pink color indicators = rose
  - Look for "Brut", "Champagne", "Prosecco", "Cava" = sparkling
- For regions like "Paso Robles" or "Napa Valley", the country is "USA"
- Look for alcohol percentage usually shown as "XX% ALC/VOL" or "XX% ABV"
- Confidence should reflect how clearly you can read the label (lower if blurry, partial, or obscured)
- detected_descriptors should capture label/implied palate cues that may be useful later (fruit, oak, tannin, acidity, body, sweetness, earth, spice)
- suggested_tasting_note must be provisional; never pretend the wine was tasted from the label alone
- brian_fit_hint should reference likely fit signals only, not a final score
- Return ONLY the JSON object, no explanation or markdown formatting`,
            },
          ],
        },
      ],
    });

    // Extract the text content from the response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse the JSON response
    let parsedResult: LabelScanResult["wine"] & { raw_text: string };
    try {
      // Clean up the response - remove any markdown code blocks if present
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      parsedResult = JSON.parse(jsonText.trim());
    } catch {
      console.error("Failed to parse Claude response:", textContent.text);
      return NextResponse.json({
        success: false,
        error: "Failed to parse label data",
        wine: null,
        raw_text: textContent.text,
      });
    }

    const result: LabelScanResult = {
      success: true,
      wine: {
        name: parsedResult.name,
        producer: parsedResult.producer,
        vintage: parsedResult.vintage,
        wine_type: parsedResult.wine_type,
        region: parsedResult.region,
        sub_region: parsedResult.sub_region,
        country: parsedResult.country,
        appellation: parsedResult.appellation,
        grape_varieties: parsedResult.grape_varieties,
        alcohol_percentage: parsedResult.alcohol_percentage,
        confidence: parsedResult.confidence,
        detected_descriptors: parsedResult.detected_descriptors || null,
        suggested_tasting_note: parsedResult.suggested_tasting_note || null,
        brian_fit_hint: parsedResult.brian_fit_hint || null,
      },
      raw_text: parsedResult.raw_text || "",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Label scan error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scan label",
        wine: null,
        raw_text: "",
      },
      { status: 500 }
    );
  }
}
