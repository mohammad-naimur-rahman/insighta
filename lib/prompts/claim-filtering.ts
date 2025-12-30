import { z } from "zod";

export const ClaimFilteringSchema = z.object({
  evaluations: z.array(
    z.object({
      claim: z.string().describe("The original claim text"),
      label: z
        .enum(["core_insight", "supporting_insight", "redundant", "filler"])
        .describe("The evaluation label"),
      reason: z.string().describe("Brief explanation for the label"),
      score: z
        .number()
        .min(0)
        .max(1)
        .describe("Usefulness score from 0 to 1"),
    })
  ),
});

export type ClaimFilteringResult = z.infer<typeof ClaimFilteringSchema>;

export function buildClaimFilteringPrompt(claims: string[]): string {
  const claimsJson = JSON.stringify(claims, null, 2);

  return `You are evaluating extracted claims from a non-fiction book.

TASK:
Label each claim based on its actual usefulness.

LABEL DEFINITIONS:
- core_insight: Changes decisions or introduces a real constraint. These are the key ideas.
- supporting_insight: Clarifies or strengthens a core insight. Useful but not central.
- redundant: Repeats an idea already stated elsewhere in this list.
- filler: Obvious, generic, or low-value advice that most readers already know.

EVALUATION CRITERIA:
- Would an intelligent reader already know this?
- Does this introduce a trade-off?
- Does this change behavior?
- Does this add a constraint or limitation?
- Is this specific enough to be actionable?

INSTRUCTIONS:
- Be strict. Most claims should NOT survive as core insights.
- Do not justify weak claims.
- Score from 0 (useless) to 1 (essential).
- Mark as redundant if similar to another claim in the list.

CLAIMS TO EVALUATE:
${claimsJson}`;
}
