export function buildPrincipleRewritePrompt(
  ideaTitle: string,
  mergedClaims: string[]
): string {
  const claimsJson = JSON.stringify(mergedClaims, null, 2);

  return `You are writing the CORE PRINCIPLE of an idea.

IDEA TITLE: ${ideaTitle}

MERGED CLAIMS:
${claimsJson}

RULES:
- Be precise and dense
- Avoid motivational language
- Avoid repetition
- Avoid examples here (those come separately)
- Explain the idea as a decision rule
- Focus on the "why" - what makes this principle work
- Include any constraints or trade-offs

OUTPUT:
Write 2-4 short paragraphs maximum. Each paragraph should be essential.
Do not use bullet points. Write in clear prose.`;
}
