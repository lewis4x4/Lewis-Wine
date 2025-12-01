import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedWine, ReceiptScanResult } from "@/types/database";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("receipt") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No receipt image provided" },
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
        { error: "Invalid image format. Please upload a JPEG, PNG, GIF, or WebP image." },
        { status: 400 }
      );
    }

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
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
              text: `Analyze this wine purchase receipt and extract all wine-related information. Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:

{
  "vendor": "store/winery name if visible",
  "vendor_type": "winery" | "retailer" | "auction" | "private" | "other" | null,
  "purchase_date": "YYYY-MM-DD format if visible, or null",
  "subtotal_cents": number in cents or null,
  "tax_cents": number in cents or null,
  "total_cents": number in cents or null,
  "wines": [
    {
      "name": "full wine name including vintage year if in name",
      "producer": "winery/producer name if identifiable separately from wine name",
      "vintage": 2020 (4-digit year as number, or null if not visible),
      "wine_type": "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | null,
      "quantity": 1 (number of bottles),
      "price_cents": 2500 (total line price in cents),
      "unit_price_cents": 2500 (price per bottle in cents),
      "confidence": 85 (0-100 confidence score for this extraction),
      "raw_text": "exact text from receipt for this line item",
      "region": "wine region if identifiable (e.g., Napa Valley, Bordeaux)",
      "country": "country if identifiable"
    }
  ],
  "raw_text": "full text transcription of the receipt"
}

Important guidelines:
- Extract ALL wine items, even partial information is valuable
- If a wine name includes the vintage year (e.g., "2019 Cabernet"), extract it to the vintage field
- Convert all prices to cents (e.g., $25.00 = 2500)
- For quantity, look for indicators like "2x", "qty: 2", or multiple of the same item
- Confidence should reflect how certain you are about the extraction (lower if text is blurry or ambiguous)
- If you can identify the wine type from the name (Cabernet = red, Chardonnay = white, etc.), include it
- Look for common wine retailers: Total Wine, BevMo, Wine.com, winery names, etc.
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
    let parsedResult: Omit<ReceiptScanResult, "success" | "wines"> & { wines: Omit<ExtractedWine, "id">[] };
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
        error: "Failed to parse receipt data",
        vendor: null,
        vendor_type: null,
        purchase_date: null,
        subtotal_cents: null,
        tax_cents: null,
        total_cents: null,
        raw_text: textContent.text,
        wines: [],
      });
    }

    // Add IDs to wines
    const winesWithIds: ExtractedWine[] = parsedResult.wines.map((wine, index) => ({
      ...wine,
      id: `extracted-${Date.now()}-${index}`,
    }));

    const result: ReceiptScanResult = {
      success: true,
      vendor: parsedResult.vendor,
      vendor_type: parsedResult.vendor_type,
      purchase_date: parsedResult.purchase_date,
      subtotal_cents: parsedResult.subtotal_cents,
      tax_cents: parsedResult.tax_cents,
      total_cents: parsedResult.total_cents,
      wines: winesWithIds,
      raw_text: parsedResult.raw_text || "",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Receipt scan error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scan receipt",
        vendor: null,
        vendor_type: null,
        purchase_date: null,
        subtotal_cents: null,
        tax_cents: null,
        total_cents: null,
        wines: [],
        raw_text: "",
      },
      { status: 500 }
    );
  }
}
