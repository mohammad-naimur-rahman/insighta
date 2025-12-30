import { z } from "zod";

export const ClaimExtractionSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string().describe("The extracted claim, rewritten clearly"),
      type: z
        .enum(["principle", "rule", "recommendation", "constraint", "causal"])
        .describe("The type of claim"),
    })
  ),
});

export type ClaimExtractionResult = z.infer<typeof ClaimExtractionSchema>;

export function buildClaimExtractionPrompt(chunkText: string): string {
  return `You are extracting CLAIMS from a non-fiction book.

DEFINITION:
A claim is a statement that can stand alone as:
- a principle (a fundamental truth or proposition)
- a rule (a prescribed guide for conduct or action)
- a recommendation (advice on what to do)
- a causal insight (explains why something happens)
- a constraint (a limitation that affects decisions)

INSTRUCTIONS:
- Ignore storytelling, anecdotes, tone, and persuasion
- Ignore examples unless they introduce a new idea
- Rewrite claims clearly and precisely
- Do NOT summarize paragraphs
- Do NOT add new ideas
- Extract ONLY ideas that could be useful advice
- If no valid claims exist in the text, return an empty array

TEXT:
${chunkText}`;
}
