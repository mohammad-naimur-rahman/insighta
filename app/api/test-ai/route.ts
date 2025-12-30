import { NextResponse } from "next/server";
import { generateResponse, generateStructured } from "@/lib/ai";
import { z } from "zod";

const TestSchema = z.object({
  greeting: z.string(),
  mood: z.enum(["happy", "neutral", "sad"]),
});

export async function GET() {
  try {
    console.log("[Test AI] Starting test...");
    console.log("[Test AI] API Key exists:", !!process.env.ZAI_API_KEY);
    console.log("[Test AI] Base URL:", process.env.ZAI_API_BASE_URL || "https://api.z.ai/api/coding/paas/v4");

    // Test simple text generation
    const textResponse = await generateResponse("Say hello in one word.", {
      model: "extraction",
    });
    console.log("[Test AI] Text Response:", textResponse);

    // Test structured output
    const structuredResponse = await generateStructured(
      TestSchema,
      "Generate a greeting and indicate your mood.",
      { model: "extraction" }
    );
    console.log("[Test AI] Structured Response:", structuredResponse);

    return NextResponse.json({
      success: true,
      textResponse,
      structuredResponse,
    });
  } catch (error) {
    console.error("[Test AI] Error:", error);

    const errorDetails: Record<string, unknown> = {
      message: error instanceof Error ? error.message : "Unknown error",
    };

    if (error && typeof error === "object") {
      if ("statusCode" in error) errorDetails.statusCode = error.statusCode;
      if ("responseBody" in error) errorDetails.responseBody = error.responseBody;
      if ("url" in error) errorDetails.url = error.url;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorDetails,
      },
      { status: 500 }
    );
  }
}
