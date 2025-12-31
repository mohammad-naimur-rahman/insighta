import { z } from "zod";
import { generateStructured } from "@/lib/ai";

/**
 * Schema for content density analysis result
 */
export const ContentDensitySchema = z.object({
  density_score: z
    .number()
    .min(1)
    .max(10)
    .describe("Content density score: 1=very fluffy/repetitive, 10=very dense/academic"),
  characteristics: z
    .array(z.string())
    .describe("Key characteristics of the writing style"),
  recommended_compression: z
    .number()
    .min(0.15)
    .max(0.6)
    .describe("Recommended compression ratio (0.2 = keep 20% of original)"),
  recommended_context_size: z
    .number()
    .min(100)
    .max(350)
    .describe("Recommended context size in words for chapter continuity"),
  analysis_notes: z.string().optional().describe("Brief explanation of the assessment"),
});

export type ContentDensityResult = z.infer<typeof ContentDensitySchema>;

/**
 * Density level classification for UI display
 */
export type DensityLevel = "fluffy" | "medium" | "dense";

/**
 * Build prompt for content density analysis
 */
export function buildContentDensityPrompt(sampleText: string): string {
  return `Analyze the following text sample from a book to determine its content density and recommend compression settings.

SAMPLE TEXT:
${sampleText}

YOUR TASK:
Evaluate the writing style and content density to determine how aggressively the book should be compressed.

DENSITY FACTORS TO CONSIDER:

HIGH DENSITY (score 7-10) - Less compression needed:
- Academic or technical writing with precise terminology
- Dense arguments with minimal repetition
- Few examples per concept (1-2 max)
- Little to no anecdotes or storytelling
- Tightly structured logical flow
- Every sentence adds new information

MEDIUM DENSITY (score 4-6) - Standard compression:
- Mix of explanation and examples
- Some repetition for emphasis but not excessive
- Moderate storytelling to illustrate points
- Clear structure with reasonable elaboration
- Business/self-help books with solid content

LOW DENSITY / FLUFFY (score 1-3) - Aggressive compression needed:
- Heavy use of anecdotes and personal stories
- Multiple examples for the same concept (3+ examples)
- Repetitive explanations of the same idea
- Motivational language and filler phrases
- Conversational/chatty style with tangents
- Same point restated multiple ways

COMPRESSION RATIO GUIDELINES:
- Score 1-3 (fluffy): 0.20 to 0.30 (keep 20-30%)
- Score 4-6 (medium): 0.30 to 0.40 (keep 30-40%)
- Score 7-10 (dense): 0.40 to 0.55 (keep 40-55%)

CONTEXT SIZE GUIDELINES:
- Fluffy books: 100-150 words (less nuance to preserve)
- Medium books: 150-220 words
- Dense books: 220-300 words (more concepts to track)

CHARACTERISTICS to identify (pick 3-5):
- "heavy_examples" - multiple examples per point
- "repetitive" - same ideas restated often
- "anecdotal" - lots of stories and personal experiences
- "academic" - formal, precise language
- "technical" - specialized terminology
- "conversational" - casual, chatty tone
- "motivational" - inspirational language, calls to action
- "structured" - clear logical organization
- "tangential" - frequent digressions
- "concise" - economical use of words`;
}

/**
 * Analyze content density of a book sample
 */
export async function analyzeContentDensity(
  sampleText: string
): Promise<ContentDensityResult> {
  // Need reasonable sample size for accurate analysis
  if (sampleText.length < 500) {
    // Default to medium density for very short samples
    return {
      density_score: 5,
      characteristics: ["insufficient_sample"],
      recommended_compression: 0.35,
      recommended_context_size: 180,
      analysis_notes: "Sample too short for accurate analysis, using defaults",
    };
  }

  const prompt = buildContentDensityPrompt(sampleText);

  try {
    const result = await generateStructured(ContentDensitySchema, prompt, {
      model: "extraction", // Use cheaper model
    });

    console.log(
      `[Density] Analysis complete: score=${result.density_score}, compression=${result.recommended_compression}`
    );

    return result;
  } catch (error) {
    console.error("[Density] Analysis failed:", error);
    // Return safe defaults
    return {
      density_score: 5,
      characteristics: ["analysis_failed"],
      recommended_compression: 0.35,
      recommended_context_size: 180,
      analysis_notes: "Analysis failed, using default settings",
    };
  }
}

/**
 * Get density level classification from score
 */
export function getDensityLevel(score: number): DensityLevel {
  if (score <= 3) return "fluffy";
  if (score <= 6) return "medium";
  return "dense";
}

/**
 * Get human-readable compression target percentage
 */
export function getCompressionTargetLabel(ratio: number): string {
  const percentage = Math.round(ratio * 100);
  return `${percentage}%`;
}

/**
 * Create a sample from chapters for analysis
 * Takes first chapter + samples from middle to get representative content
 */
export function createAnalysisSample(
  chapters: { content: string }[],
  maxTokens: number = 3000
): string {
  if (chapters.length === 0) return "";

  const samples: string[] = [];
  let totalLength = 0;
  const targetLength = maxTokens * 4; // ~4 chars per token

  // Always include first chapter (or portion of it)
  const firstChapter = chapters[0].content;
  const firstSample = firstChapter.slice(0, Math.min(firstChapter.length, targetLength * 0.4));
  samples.push(firstSample);
  totalLength += firstSample.length;

  // Sample from middle chapters if available
  if (chapters.length > 2) {
    const middleIndex = Math.floor(chapters.length / 2);
    const middleChapter = chapters[middleIndex].content;
    const middleSample = middleChapter.slice(
      0,
      Math.min(middleChapter.length, targetLength * 0.3)
    );
    samples.push(middleSample);
    totalLength += middleSample.length;
  }

  // Sample from later chapter if we have room
  if (chapters.length > 4 && totalLength < targetLength * 0.8) {
    const lateIndex = Math.floor(chapters.length * 0.75);
    const lateChapter = chapters[lateIndex].content;
    const lateSample = lateChapter.slice(
      0,
      Math.min(lateChapter.length, targetLength - totalLength)
    );
    samples.push(lateSample);
  }

  return samples.join("\n\n---\n\n");
}
