import { z } from "zod";

export const IdeaExpansionSchema = z.object({
  principle: z.string().describe("The core principle of this idea"),
  behavior_delta: z.string().describe("How this changes behavior"),
});

export type IdeaExpansionResult = z.infer<typeof IdeaExpansionSchema>;

/**
 * Combined prompt for generating both principle and behavior delta in one call
 * This reduces API calls by 50%
 */
export function buildIdeaExpansionPrompt(
  ideaTitle: string,
  mergedClaims: string[]
): string {
  const claimsJson = JSON.stringify(mergedClaims, null, 2);

  return `You are expanding an IDEA into a core principle and behavior change.

IDEA TITLE: ${ideaTitle}

MERGED CLAIMS:
${claimsJson}

GENERATE TWO OUTPUTS:

1. PRINCIPLE (2-4 short paragraphs):
- Be precise and dense
- Avoid motivational language
- Explain the idea as a decision rule
- Focus on the "why" - what makes this principle work
- Include any constraints or trade-offs
- Write in clear prose, no bullet points

2. BEHAVIOR_DELTA (2-3 bullet points):
- Explain how this changes decisions for someone who does NOT already believe it
- Be concrete and specific - avoid generic advice
- Focus on trade-offs - what you give up and what you gain
- Describe actual behavior changes, not feelings
- Each bullet should be specific enough to act on immediately

Format for behavior_delta:
If you already believe this, skip it.
If not, this should change how you:
- decide (what choices you make differently)
- prioritize (what you put first or last)
- schedule (how you allocate time)`;
}
