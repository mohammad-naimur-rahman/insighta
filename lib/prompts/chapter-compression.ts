import { z } from "zod";

export const ChapterCompressionSchema = z.object({
  compressed_content: z.string().describe("The compressed chapter content"),
  key_insights: z.array(z.string()).describe("List of key insights from this chapter"),
  compression_notes: z.string().optional().describe("Notes about what was removed"),
});

export type ChapterCompressionResult = z.infer<typeof ChapterCompressionSchema>;

/**
 * Build a prompt that compresses a chapter while preserving its voice and style
 */
export function buildChapterCompressionPrompt(
  chapterTitle: string,
  chapterContent: string,
  bookTitle: string,
  isFirstChapter: boolean
): string {
  return `You are compressing a chapter from "${bookTitle}" while PRESERVING its original writing style and voice.

CHAPTER: ${chapterTitle}

CONTENT:
${chapterContent}

YOUR TASK:
Compress this chapter to approximately 30-40% of its original length while:

1. PRESERVING THE AUTHOR'S VOICE
   - Keep the author's unique phrases and expressions
   - Maintain their argumentative style
   - Preserve memorable quotes or statements
   - Keep the tone (formal, casual, academic, conversational)

2. REMOVING ONLY:
   - Redundant examples (keep the BEST one per point)
   - Repetitive explanations of the same concept
   - Excessive anecdotes that don't add new information
   - Filler phrases and unnecessary transitions
   - Obvious statements that don't add insight

3. KEEPING ALL:
   - Core arguments and reasoning
   - Novel insights and counterintuitive points
   - Specific advice, rules, or frameworks
   - Key examples that illustrate important points
   - Data, statistics, or evidence
   - The logical flow of ideas

4. STRUCTURE:
   - Keep paragraph structure similar to original
   - Maintain the chapter's narrative arc
   - Don't convert prose into bullet points
   ${isFirstChapter ? "- Include the chapter's opening hook" : ""}

5. NORMALIZE SECTION HEADERS:
   - Convert informal markers like "chunk 1:", "part a:", "section 1:", "step 1:" into clean markdown headers
   - Use ### for sub-sections (e.g., "chunk 1: syntax basics" becomes "### Syntax Basics")
   - Remove numbering prefixes from section titles
   - Keep the descriptive part of the title, capitalize properly

OUTPUT FORMAT:
Write the compressed chapter as natural prose, exactly as it would appear in a shorter version of the book.
Do NOT add commentary, summaries, or meta-text.
Do NOT start with phrases like "This chapter discusses..." or "The author argues..."
Just write the compressed content directly.

Also extract 2-5 key insights (single sentences) that capture the most important takeaways.`;
}

/**
 * Build a prompt for the final book assembly
 */
export function buildBookAssemblyPrompt(
  bookTitle: string,
  author: string | undefined,
  compressedChapters: { title: string; content: string; insights: string[] }[]
): string {
  const chaptersJson = compressedChapters.map((ch, i) => ({
    chapter_number: i + 1,
    title: ch.title,
    content: ch.content,
    key_insights: ch.insights,
  }));

  return `You are assembling the final compressed version of "${bookTitle}"${author ? ` by ${author}` : ""}.

COMPRESSED CHAPTERS:
${JSON.stringify(chaptersJson, null, 2)}

YOUR TASK:
Create a cohesive, readable book summary that:

1. STRUCTURE:
   - Start with a brief overview (2-3 paragraphs max) of what this book offers
   - Present each chapter with its original title
   - End with a "Key Takeaways" section listing the most important insights across all chapters

2. FORMAT:
   # ${bookTitle}
   ${author ? `*By ${author}*` : ""}

   ## Overview
   (brief intro)

   ## Chapter 1: [Title]
   (compressed content)

   ## Chapter 2: [Title]
   (compressed content)

   ...

   ## Key Takeaways
   (5-10 most important insights as bullet points)

3. RULES:
   - Do NOT rewrite the chapter content - use it as provided
   - Only write the Overview and Key Takeaways sections
   - Maintain the author's voice throughout
   - The result should read like a condensed version of the actual book

Output the complete markdown document.`;
}

/**
 * Build a prompt to generate a running context summary from previous chapters
 * This keeps the context small while maintaining narrative continuity
 */
export function buildContextSummaryPrompt(
  bookTitle: string,
  previousContext: string,
  currentChapterTitle: string,
  currentChapterInsights: string[]
): string {
  return `You are tracking the key narrative and concepts from "${bookTitle}".

PREVIOUS CONTEXT (running summary so far):
${previousContext || "This is the first chapter."}

CURRENT CHAPTER: ${currentChapterTitle}
KEY INSIGHTS FROM THIS CHAPTER:
${currentChapterInsights.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

YOUR TASK:
Create an updated running summary (max 200 words) that:
1. Integrates the new chapter's key insights with the existing context
2. Maintains the narrative flow and how ideas build on each other
3. Captures the most important concepts needed to understand future chapters
4. Drops redundant or superseded information

Output ONLY the updated context summary, nothing else.`;
}

/**
 * Build a prompt for generating just the book overview
 */
export function buildOverviewPrompt(
  bookTitle: string,
  author: string | undefined,
  chapterTitles: string[],
  allInsights: string[]
): string {
  return `You are writing an overview for the condensed version of "${bookTitle}"${author ? ` by ${author}` : ""}.

CHAPTER TITLES:
${chapterTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

KEY INSIGHTS FROM THE BOOK:
${allInsights.slice(0, 20).map((i, idx) => `- ${i}`).join("\n")}

YOUR TASK:
Write a brief overview (2-3 paragraphs, ~150-200 words) that:
1. Captures what this book is about and who it's for
2. Highlights the main themes and value proposition
3. Sets up what the reader will learn
4. Maintains the author's voice and tone

Output ONLY the overview text, no headers or formatting.`;
}

/**
 * Build a prompt for generating key takeaways from all chapter insights
 */
export function buildKeyTakeawaysPrompt(
  bookTitle: string,
  allInsights: string[]
): string {
  return `You are compiling the key takeaways from "${bookTitle}".

ALL INSIGHTS FROM THE BOOK:
${allInsights.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

YOUR TASK:
Select and refine the 7-10 most important takeaways that:
1. Represent the core value of the book
2. Are actionable or memorable
3. Cover different aspects of the book (don't cluster on one topic)
4. Are written as clear, standalone statements

Output as a markdown bullet list, one takeaway per line starting with "- ".`;
}
