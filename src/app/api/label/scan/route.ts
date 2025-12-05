import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { LabelScanResult } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    // Verify API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
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

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get("label") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No label image provided", wine: null, raw_text: "" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Determine media type
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mediaType)) {
      return NextResponse.json(
        { success: false, error: "Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image.", wine: null, raw_text: "" },
        { status: 400 }
      );
    }

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
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
