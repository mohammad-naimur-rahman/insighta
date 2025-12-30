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
