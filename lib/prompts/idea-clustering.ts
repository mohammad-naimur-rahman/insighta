import { z } from "zod";

export const IdeaClusteringSchema = z.object({
  ideas: z.array(
    z.object({
      idea_title: z
        .string()
        .describe("A sharp, concise title for this idea cluster"),
      merged_claims: z
        .array(z.string())
        .describe("The original claims that were merged into this idea"),
      summary: z
        .string()
        .describe("A brief summary of what this idea represents"),
    })
  ),
});

export type IdeaClusteringResult = z.infer<typeof IdeaClusteringSchema>;

export function buildIdeaClusteringPrompt(filteredClaims: string[]): string {
  const claimsJson = JSON.stringify(filteredClaims, null, 2);

  return `You are clustering similar insights into IDEA CLUSTERS.

TASK:
- Merge claims that express the same underlying idea
- Remove wording differences
- Produce one clear, sharp idea per cluster

INSTRUCTIONS:
- Prefer fewer ideas over more. Aim for 7-12 total ideas maximum.
- Each idea must represent a unique decision rule
- Rewrite idea titles to be clear and concise
- The title should capture the essence of the insight
- Weak books should collapse into very few ideas

GUIDELINES FOR GOOD IDEA TITLES:
- Be specific, not generic ("Track time in 15-min blocks" not "Manage your time")
- Include the constraint or action ("Say no to meetings" not "Be selective")
- Make it memorable and actionable

CLAIMS TO CLUSTER:
${claimsJson}`;
}
