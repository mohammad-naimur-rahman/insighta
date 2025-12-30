export interface IdeaForReconstruction {
  title: string;
  principle: string;
  behaviorDelta: string;
  example?: string;
}

export function buildFinalReconstructionPrompt(
  bookTitle: string,
  ideas: IdeaForReconstruction[]
): string {
  const ideasJson = JSON.stringify(ideas, null, 2);

  return `You are reconstructing a non-fiction book around IDEAS, not chapters.

BOOK: ${bookTitle}

GOAL:
Produce a signal-dense distillation of the book.

RULES:
- No chapters from the original book
- No repetition
- No motivational fluff
- No author voice or storytelling
- Prefer clarity over persuasion
- Each idea should be complete and standalone

STRUCTURE (MANDATORY):
Follow this exact markdown structure for each idea:

## Idea N: <Sharp Title>

### Core Principle
(the dense explanation)

### What This Changes
(the behavior delta - concrete changes to decisions)

### Best Example
(one example if available, or omit this section)

---

CONSTRAINTS:
- Max 7-12 ideas total (already filtered)
- Max 1 example per idea
- Remove anything that does not add understanding
- Start with a brief intro (2-3 sentences max about what this book offers)

INPUT IDEAS:
${ideasJson}

Generate the complete markdown document now.`;
}
