import { createOpenAI } from "@ai-sdk/openai";
import { generateText, generateObject, streamText } from "ai";
import { z } from "zod";

// Create z.ai client (OpenAI-compatible API)
const zai = createOpenAI({
  baseURL: process.env.ZAI_API_BASE_URL || "https://api.z.ai/v1",
  apiKey: process.env.ZAI_API_KEY,
});

// Model configurations
export const models = {
  // Cheaper model for initial extraction (high volume)
  extraction: zai("glm-4-flash"),
  // Medium model for filtering and scoring
  filtering: zai("glm-4-flash"),
  // Strong model for clustering and reconstruction
  reasoning: zai("glm-4"),
};

// Global system instruction for all prompts
export const SYSTEM_INSTRUCTION = `You are not a summarizer.
You are a signal extraction system.
If removing something does not reduce understanding, remove it.`;

// Generate structured output
export async function generateStructured<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  options?: {
    model?: keyof typeof models;
    system?: string;
  }
): Promise<T> {
  const model = models[options?.model || "extraction"];
  const system = options?.system || SYSTEM_INSTRUCTION;

  const result = await generateObject({
    model,
    schema,
    prompt,
    system,
  });

  return result.object;
}

// Generate text response
export async function generateResponse(
  prompt: string,
  options?: {
    model?: keyof typeof models;
    system?: string;
  }
): Promise<string> {
  const model = models[options?.model || "extraction"];
  const system = options?.system || SYSTEM_INSTRUCTION;

  const result = await generateText({
    model,
    prompt,
    system,
  });

  return result.text;
}

// Stream text response
export async function streamResponse(
  prompt: string,
  options?: {
    model?: keyof typeof models;
    system?: string;
    onToken?: (token: string) => void;
  }
): Promise<string> {
  const model = models[options?.model || "extraction"];
  const system = options?.system || SYSTEM_INSTRUCTION;

  const result = streamText({
    model,
    prompt,
    system,
  });

  let fullText = "";

  for await (const chunk of result.textStream) {
    fullText += chunk;
    options?.onToken?.(chunk);
  }

  return fullText;
}

// Export types for use in pipeline
export type ModelType = keyof typeof models;
