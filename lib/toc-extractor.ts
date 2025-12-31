import { z } from "zod";
import { generateStructured } from "@/lib/ai";

/**
 * Schema for a single TOC entry
 */
export const TOCEntrySchema = z.object({
  title: z.string().describe("Chapter title as it appears in TOC"),
  normalized_title: z
    .string()
    .describe("Cleaned version without chapter numbers, page numbers, or dots for matching"),
  page_number: z.coerce.number().optional().describe("Page number if visible in TOC"),
  level: z.coerce
    .number()
    .describe("Hierarchy level: 1=Part/Book, 2=Chapter, 3=Section/Subsection"),
});

/**
 * Schema for TOC extraction result
 */
export const TOCExtractionSchema = z.object({
  has_toc: z.boolean().describe("Whether a clear Table of Contents was found"),
  entries: z.array(TOCEntrySchema).describe("TOC entries found, in order"),
  toc_start_page: z.coerce.number().optional().describe("Approximate page where TOC starts"),
  toc_end_page: z.coerce.number().optional().describe("Approximate page where TOC ends"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence in TOC detection accuracy"),
});

export type TOCEntry = z.infer<typeof TOCEntrySchema>;
export type TOCExtractionResult = z.infer<typeof TOCExtractionSchema>;

/**
 * Build prompt for TOC extraction from first pages of a book
 */
export function buildTOCExtractionPrompt(firstPagesText: string): string {
  return `Analyze the following text from the first pages of a book and extract the Table of Contents if present.

TEXT FROM FIRST PAGES:
${firstPagesText}

YOUR TASK:
1. Identify if there is a clear Table of Contents (TOC)
2. Extract all chapter/section entries with their titles
3. Create normalized titles suitable for fuzzy matching later
4. Determine hierarchy levels for each entry

SIGNS OF A TOC:
- "Contents", "Table of Contents", "CONTENTS" header
- List of items with page numbers (often with dots/dashes leading to numbers)
- Consistent formatting with chapter titles and numbers
- Usually in first 5-15 pages after title page

HIERARCHY LEVELS:
- Level 1: Major divisions like "Part I", "Part One", "Book One"
- Level 2: Chapters like "Chapter 1", "1. Title", numbered main sections
- Level 3: Sub-sections within chapters (if listed in TOC)

NORMALIZATION RULES for normalized_title:
- Remove "Chapter X:", "Part X:", or numbered prefixes like "1.", "2."
- Remove page numbers and leading dots/dashes
- Remove extra whitespace
- Keep the core descriptive title
- Example: "Chapter 3: The Power of Habit.................45" → "The Power of Habit"
- Example: "Part II - Building Momentum" → "Building Momentum"
- Example: "1. Getting Started" → "Getting Started"

CONFIDENCE LEVELS:
- high: Clear TOC with consistent formatting, page numbers, obvious structure
- medium: TOC exists but formatting is inconsistent or some entries unclear
- low: Uncertain if this is actually a TOC or just list of topics

If NO clear TOC is found, return has_toc: false with empty entries array.`;
}

/**
 * Extract Table of Contents from the first pages of a book
 */
export async function extractTOC(firstPagesText: string): Promise<TOCExtractionResult> {
  // Skip if text is too short to contain a useful TOC
  if (firstPagesText.length < 200) {
    return {
      has_toc: false,
      entries: [],
      confidence: "low",
    };
  }

  const prompt = buildTOCExtractionPrompt(firstPagesText);

  try {
    const result = await generateStructured(TOCExtractionSchema, prompt, {
      model: "extraction", // Use cheaper model for TOC detection
    });

    console.log(
      `[TOC] Extraction complete: has_toc=${result.has_toc}, entries=${result.entries.length}, confidence=${result.confidence}`
    );

    return result;
  } catch (error) {
    console.error("[TOC] Extraction failed:", error);
    return {
      has_toc: false,
      entries: [],
      confidence: "low",
    };
  }
}

/**
 * Validate TOC extraction result
 * Returns true if TOC seems reliable enough to use
 */
export function isTOCReliable(toc: TOCExtractionResult): boolean {
  if (!toc.has_toc) return false;
  if (toc.entries.length < 3) return false;
  if (toc.confidence === "low") return false;

  // Check for level 2 entries (actual chapters)
  const chapterEntries = toc.entries.filter((e) => e.level === 2);
  if (chapterEntries.length < 2) return false;

  return true;
}
