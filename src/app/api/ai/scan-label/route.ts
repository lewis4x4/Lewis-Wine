import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json(
                { error: "Image data is required" },
                { status: 400 }
            );
        }

        // Initialize Anthropic client
        // Note: This relies on ANTHROPIC_API_KEY being set in env vars
        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn("Missing ANTHROPIC_API_KEY");
            // Mock response for development if key is missing
            return NextResponse.json({
                name: "Mock Chateau Margaux",
                producer: "Chateau Margaux",
                vintage: "2015",
                region: "Bordeaux",
                varietal: "Cabernet Sauvignon"
            });
        }

        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        // Extract base64 data if it includes the prefix
        const base64Data = image.includes("base64,")
            ? image.split("base64,")[1]
            : image;

        const message = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: "image/jpeg", // Assuming jpeg/png, Claude assumes valid image
                                data: base64Data,
                            },
                        },
                        {
                            type: "text",
                            text: "Analyze this wine label (front or back). Extract the following details in strict JSON format: { \"name\": string, \"producer\": string, \"vintage\": string, \"region\": string, \"varietal\": string, \"description\": string }. \n\nFor the 'description' field: If this is a back label, extract the full story, tasting notes, winery history, or winemaking details. If it's a front label, just extract the basic info. \n\nIf any field is not visible, use null. Do not include markdown formatting.",
                        },
                    ],
                },
            ],
        });

        // Parse the response
        const content = message.content[0].type === 'text' ? message.content[0].text : "";
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(content);
        } catch (e) {
            // Fallback simple parsing if strict JSON failed
            console.error("Failed to parse AI response", content);
            return NextResponse.json(
                { error: "Failed to parse wine details" },
                { status: 500 }
            );
        }

        return NextResponse.json(jsonResponse);

    } catch (error) {
        console.error("Label scan error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
