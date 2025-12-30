export function buildBehaviorDeltaPrompt(
  ideaTitle: string,
  principle: string
): string {
  return `You are generating a BEHAVIOR DELTA.

IDEA: ${ideaTitle}

PRINCIPLE:
${principle}

TASK:
Explain how this idea should change decisions for someone who does NOT already believe it.

RULES:
- Be concrete and specific
- Avoid generic advice like "be more mindful"
- Focus on trade-offs - what you give up and what you gain
- Describe actual behavior changes, not feelings

FORMAT:
If you already believe this, skip it.
If not, this should change how you:
- decide (what choices you make differently)
- prioritize (what you put first or last)
- schedule (how you allocate time)

Write 2-3 bullet points of concrete changes. Each should be specific enough to act on immediately.`;
}
