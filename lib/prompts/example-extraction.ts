import { z } from "zod";

export const ExampleExtractionSchema = z.object({
  examples: z.array(
    z.object({
      insight: z.string().describe("The core insight this example supports"),
      example: z.string().describe("The extracted example, condensed"),
      reason_kept: z
        .enum(["clarifies_application", "removes_ambiguity"])
        .describe("Why this example is valuable"),
    })
  ),
});

export type ExampleExtractionResult = z.infer<typeof ExampleExtractionSchema>;

export function buildExampleExtractionPrompt(
  originalText: string,
  coreInsights: string[]
): string {
  const insightsJson = JSON.stringify(coreInsights, null, 2);

  return `You are extracting EXAMPLES that clarify core insights.

RULES:
- Examples must clarify application (how to use the insight)
- Examples must be generalizable (applicable beyond the specific case)
- Keep at most 1-2 examples per insight
- Reject emotional or personal stories
- Reject author-centric anecdotes
- Reject examples that are just for illustration without adding understanding

INSTRUCTIONS:
- Keep examples only if they increase understanding
- Do NOT keep examples just because they're interesting
- Shorten examples aggressively - condense to the essential lesson
- If no good example exists for an insight, don't force one

CORE INSIGHTS:
${insightsJson}

ORIGINAL TEXT (to find examples):
${originalText}`;
}
