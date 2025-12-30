import { createOpenAI } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { z } from "zod";

// Create z.ai client (OpenAI-compatible API)
// Z.ai Coding Plan endpoint: https://api.z.ai/api/coding/paas/v4/chat/completions
const zai = createOpenAI({
  baseURL: process.env.ZAI_API_BASE_URL || "https://api.z.ai/api/coding/paas/v4",
  apiKey: process.env.ZAI_API_KEY,
});

// Model configurations
// Use .chat() to force chat completions API instead of responses API
// Available models: GLM-4.7, GLM-4.5, GLM-4.5-Air
export const models = {
  // Cheaper model for initial extraction (high volume)
  extraction: zai.chat("GLM-4.5-Air"),
  // Medium model for filtering and scoring
  filtering: zai.chat("GLM-4.5-Air"),
  // Strong model for clustering and reconstruction
  reasoning: zai.chat("GLM-4.7"),
};

// Global system instruction for all prompts
export const SYSTEM_INSTRUCTION = `You are not a summarizer.
You are a signal extraction system.
If removing something does not reduce understanding, remove it.`;

/**
 * Generate structured output using text generation with JSON parsing
 * This is more compatible with non-OpenAI providers that don't support native structured output
 */
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

  // Add JSON instruction to prompt
  const schemaDesc = zodToJsonDescription(schema);
  const jsonPrompt = `${prompt}

IMPORTANT: Respond with ONLY valid JSON. No markdown, no explanation, no code blocks.
You MUST use EXACTLY the values shown for enum fields - do not use any other values.

Required JSON structure:
${JSON.stringify(schemaDesc, null, 2)}`;

  const result = await generateText({
    model,
    prompt: jsonPrompt,
    system,
  });

  // Extract JSON from response (handle potential markdown code blocks)
  const jsonText = extractJson(result.text);

  // Parse and validate with zod
  try {
    const parsed = JSON.parse(jsonText);

    // Normalize string values to lowercase for enum matching
    const normalized = normalizeForSchema(parsed);

    // Try to parse
    const result2 = schema.safeParse(normalized);
    if (result2.success) {
      return result2.data;
    }

    // If validation failed due to enum, try to coerce values
    const coerced = coerceEnumValues(normalized, schema);

    const result3 = schema.safeParse(coerced);
    if (result3.success) {
      return result3.data;
    }

    // If still failed, log and throw
    console.error("[AI] Zod validation failed:", result3.error.issues);
    throw result3.error;
  } catch (parseError) {
    console.error("[AI] JSON parse error:", parseError);
    console.error("[AI] Raw text was:", result.text);
    throw parseError;
  }
}

/**
 * Try to coerce values to match schema types (enums, numbers, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceEnumValues(obj: any, schema: any): unknown {
  if (obj === null || obj === undefined) return obj;

  // Handle number coercion (string "0.5" -> number 0.5)
  if (schema._def?.typeName === "ZodNumber" && typeof obj === "string") {
    const num = parseFloat(obj);
    if (!isNaN(num)) {
      return num;
    }
  }

  // Get the schema shape if it's an object
  const shape = schema.shape || schema._def?.shape?.();

  if (Array.isArray(obj)) {
    const elementSchema = schema.element || schema._def?.type;
    return obj.map((item) => coerceEnumValues(item, elementSchema));
  }

  if (typeof obj === "object" && shape) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const fieldSchema = shape[key];
      if (fieldSchema) {
        result[key] = coerceEnumValues(value, fieldSchema);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // Check if this field is an enum and try to match
  const enumValues = schema._def?.values;
  if (enumValues && typeof obj === "string") {
    // Exact match
    if (enumValues.includes(obj)) {
      return obj;
    }

    // Try to find a close match using simple heuristics
    const lowerObj = obj.toLowerCase().replace(/[\s-]/g, "_");

    // Check if normalized version matches (e.g., "core insight" -> "core_insight")
    if (enumValues.includes(lowerObj)) {
      return lowerObj;
    }

    // Common mappings for various enum types
    const enumMappings: Record<string, string> = {
      // Mood/sentiment mappings
      positive: "happy",
      good: "happy",
      great: "happy",
      excellent: "happy",
      negative: "sad",
      bad: "sad",
      unhappy: "sad",
      okay: "neutral",
      fine: "neutral",
      normal: "neutral",
      // Claim type mappings
      core: "core_insight",
      coreinsight: "core_insight",
      supporting: "supporting_insight",
      supportinginsight: "supporting_insight",
      duplicate: "redundant",
      repeated: "redundant",
      generic: "filler",
      obvious: "filler",
      lowvalue: "filler",
      low_value: "filler",
      // Claim extraction type mappings
      principles: "principle",
      rules: "rule",
      recommendations: "recommendation",
      constraints: "constraint",
      causals: "causal",
      causalinsight: "causal",
    };

    const mappedValue = enumMappings[lowerObj.replace(/_/g, "")];
    if (mappedValue && enumValues.includes(mappedValue)) {
      return mappedValue;
    }

    // Return first enum value as fallback
    return enumValues[0];
  }

  return obj;
}

/**
 * Convert camelCase or PascalCase to snake_case
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Recursively normalize object keys and string values for schema matching
 * - Converts camelCase keys to snake_case (e.g., ideaTitle -> idea_title)
 * - Lowercases string values for enum matching
 */
function normalizeForSchema(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(normalizeForSchema);
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert camelCase to snake_case and lowercase
      const normalizedKey = toSnakeCase(key);
      result[normalizedKey] = normalizeForSchema(value);
    }
    return result;
  }

  // Lowercase string values (for enum matching)
  // But preserve underscores in enum values like "core_insight"
  if (typeof obj === "string") {
    return obj.toLowerCase();
  }

  return obj;
}

/**
 * Extract JSON from text that might contain markdown code blocks
 */
function extractJson(text: string): string {
  // Try to extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object or array directly
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // Return as-is and hope for the best
  return text.trim();
}

/**
 * Convert zod schema to a simple JSON description for the prompt
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonDescription(schema: any): unknown {
  // Handle the schemas we use in the app
  if (schema._def?.typeName === "ZodObject" || schema.shape) {
    const shape = schema.shape || schema._def?.shape?.();
    if (shape) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) {
        result[key] = zodToJsonDescription(value);
      }
      return result;
    }
  }

  if (schema._def?.typeName === "ZodArray" || schema.element) {
    const element = schema.element || schema._def?.type;
    if (element) {
      return [zodToJsonDescription(element)];
    }
  }

  if (schema._def?.typeName === "ZodEnum" || schema._def?.values) {
    const values = schema._def?.values || schema.options;
    if (values) {
      return `one of: ${values.join(", ")}`;
    }
  }

  if (schema._def?.typeName === "ZodString") {
    return "string";
  }

  if (schema._def?.typeName === "ZodNumber") {
    return "number";
  }

  if (schema._def?.typeName === "ZodBoolean") {
    return "boolean";
  }

  if (schema._def?.typeName === "ZodOptional") {
    const inner = schema._def?.innerType || schema.unwrap?.();
    if (inner) {
      return `optional: ${zodToJsonDescription(inner)}`;
    }
  }

  return "any";
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
