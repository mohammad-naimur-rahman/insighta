import { estimateTokens } from "./pdf-parser";
import type { TOCExtractionResult, TOCEntry } from "./toc-extractor";

export interface Chapter {
  order: number;
  title: string;
  level: number; // 1 = chapter/part, 2 = section, 3 = subsection
  content: string;
  tokenCount: number;
}

export type ExtractionMethod = "toc" | "regex" | "artificial";

export interface BookStructure {
  chapters: Chapter[];
  hasDetectedStructure: boolean;
  extractionMethod: ExtractionMethod;
}

/**
 * Common chapter/section heading patterns in books
 */
const CHAPTER_PATTERNS = [
  // "Chapter 1: Title" or "Chapter 1 - Title" or "Chapter One"
  /^(?:chapter|ch\.?)\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s:.\-–—]*(.*)$/i,
  // "Part I: Title" or "Part 1: Title" or "Part One" (Roman numerals)
  /^(?:part)\s*(?:[IVX]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s:.\-–—]*(.*)$/i,
  // "1. Title" or "1 - Title" at start of line (numbered chapters)
  /^(\d{1,2})[\s.\-–—]+([A-Z][^.!?]*?)$/,
  // "Section 1: Title"
  /^(?:section)\s*(?:\d+)[\s:.\-–—]*(.*)$/i,
];

const SECTION_PATTERNS = [
  // ALL CAPS titles (2+ words, common section headers like "BUILDING WEALTH")
  /^([A-Z]{2,}(?:\s+[A-Z]{2,})+)$/,
  // Single ALL CAPS word that's likely a section (at least 5 chars)
  /^([A-Z]{5,})$/,
];

// Subsection patterns - more specific to avoid false positives
const SUBSECTION_PATTERNS = [
  // Title Case lines that look like subsection headings (2-7 words, no punctuation at end)
  /^([A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[a-z]+|to|of|the|a|an|in|on|for|with|by|is|are))+)$/,
];

/**
 * Extract chapter structure from book text
 * Falls back to paragraph-based chunking if no structure detected
 */
export function extractChapters(text: string): BookStructure {
  const lines = text.split("\n");
  const chapters: Chapter[] = [];

  let currentChapter: {
    title: string;
    level: number;
    content: string[];
    startLine: number;
  } | null = null;

  let detectedChapters = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for chapter heading
    const chapterMatch = matchChapterHeading(line);
    if (chapterMatch) {
      // Only create new chapters for level 1 (Parts) and level 2 (Major sections)
      // Level 3 (subsections) stay within the current chapter as content
      if (chapterMatch.level <= 2) {
        // Save previous chapter
        if (currentChapter && currentChapter.content.length > 0) {
          const content = currentChapter.content.join("\n").trim();
          if (content.length > 100) { // Only save if substantial content
            chapters.push({
              order: chapters.length,
              title: currentChapter.title,
              level: currentChapter.level,
              content,
              tokenCount: estimateTokens(content),
            });
          }
        }

        // Start new chapter
        currentChapter = {
          title: chapterMatch.title,
          level: chapterMatch.level,
          content: [],
          startLine: i,
        };
        detectedChapters++;
        continue;
      } else {
        // Level 3 subsections: add as a markdown header within content
        if (currentChapter) {
          currentChapter.content.push(`\n### ${chapterMatch.title}\n`);
          continue;
        }
      }
    }

    // Add line to current chapter
    if (currentChapter) {
      currentChapter.content.push(line);
    } else {
      // No chapter detected yet, start an intro/preface chapter
      currentChapter = {
        title: "Introduction",
        level: 1,
        content: [line],
        startLine: i,
      };
    }
  }

  // Save last chapter
  if (currentChapter && currentChapter.content.length > 0) {
    const content = currentChapter.content.join("\n").trim();
    if (content.length > 100) {
      chapters.push({
        order: chapters.length,
        title: currentChapter.title,
        level: currentChapter.level,
        content,
        tokenCount: estimateTokens(content),
      });
    }
  }

  // If we detected very few chapters, the book might not have clear structure
  // In that case, create artificial chapters based on content length
  const hasDetectedStructure = detectedChapters >= 3;

  if (!hasDetectedStructure && chapters.length <= 2) {
    return {
      chapters: createChaptersFromContent(text),
      hasDetectedStructure: false,
      extractionMethod: "artificial",
    };
  }

  // Split any chapters that are too large
  const finalChapters: Chapter[] = [];
  for (const chapter of chapters) {
    if (chapter.tokenCount > MAX_CHAPTER_TOKENS) {
      const splitChapters = splitLargeChapterInternal(chapter);
      // Re-number the split chapters
      for (const sc of splitChapters) {
        finalChapters.push({
          ...sc,
          order: finalChapters.length,
        });
      }
    } else {
      finalChapters.push({
        ...chapter,
        order: finalChapters.length,
      });
    }
  }

  return {
    chapters: finalChapters,
    hasDetectedStructure,
    extractionMethod: "regex",
  };
}

/**
 * Internal function to split a large chapter (used during extraction)
 */
function splitLargeChapterInternal(chapter: Chapter): Chapter[] {
  const subChapters: Chapter[] = [];
  const paragraphs = chapter.content.split(/\n{2,}/).filter(p => p.trim().length > 0);

  let currentContent: string[] = [];
  let currentTokens = 0;
  let partNum = 1;

  for (const paragraph of paragraphs) {
    const tokens = estimateTokens(paragraph);

    if (currentTokens + tokens > MAX_CHAPTER_TOKENS && currentContent.length > 0) {
      const content = currentContent.join("\n\n").trim();
      subChapters.push({
        order: 0, // Will be reassigned
        title: `${chapter.title} (Part ${partNum})`,
        level: chapter.level,
        content,
        tokenCount: estimateTokens(content),
      });
      partNum++;
      currentContent = [];
      currentTokens = 0;
    }

    currentContent.push(paragraph);
    currentTokens += tokens;
  }

  // Save last part
  if (currentContent.length > 0) {
    const content = currentContent.join("\n\n").trim();
    subChapters.push({
      order: 0, // Will be reassigned
      title: partNum > 1 ? `${chapter.title} (Part ${partNum})` : chapter.title,
      level: chapter.level,
      content,
      tokenCount: estimateTokens(content),
    });
  }

  return subChapters;
}

/**
 * Match a line against chapter heading patterns
 */
function matchChapterHeading(line: string): { title: string; level: number } | null {
  // Skip very long lines (not headings)
  if (line.length > 100) return null;

  // Skip lines that look like regular sentences
  if (line.match(/[.!?]$/) && line.length > 50) return null;

  // Check chapter patterns (level 1)
  for (const pattern of CHAPTER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      // Extract title - could be in match[1] or match[2] depending on pattern
      let title = match[2] || match[1] || line;
      title = title.trim();

      // If title is empty, use the whole line
      if (!title) title = line;

      return { title, level: 1 };
    }
  }

  // Check section patterns (level 2) - ALL CAPS headers
  for (const pattern of SECTION_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const title = match[1].trim();
      // Make sure it's not a regular sentence fragment
      if (title.length >= 5 && title.length <= 60) {
        return { title, level: 2 };
      }
    }
  }

  // Check subsection patterns (level 3) - Title Case headers
  for (const pattern of SUBSECTION_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const title = match[1].trim();
      // Subsections should be reasonably short (2-8 words)
      const wordCount = title.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 8 && title.length <= 60) {
        return { title, level: 3 };
      }
    }
  }

  return null;
}

// Maximum tokens per chapter to avoid API limits
const MAX_CHAPTER_TOKENS = 6000;

/**
 * Create artificial chapters from content when no structure is detected
 * Splits by natural topic boundaries or size
 */
function createChaptersFromContent(text: string): Chapter[] {
  const chapters: Chapter[] = [];
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);

  const TARGET_CHAPTER_TOKENS = 3000; // Aim for ~3000 tokens per chapter
  let currentContent: string[] = [];
  let currentTokens = 0;
  let chapterNum = 1;

  for (const paragraph of paragraphs) {
    const tokens = estimateTokens(paragraph);

    if (currentTokens + tokens > TARGET_CHAPTER_TOKENS && currentContent.length > 0) {
      // Save current chapter
      const content = currentContent.join("\n\n").trim();
      chapters.push({
        order: chapters.length,
        title: `Section ${chapterNum}`,
        level: 1,
        content,
        tokenCount: estimateTokens(content),
      });
      chapterNum++;
      currentContent = [];
      currentTokens = 0;
    }

    currentContent.push(paragraph);
    currentTokens += tokens;
  }

  // Save last chapter
  if (currentContent.length > 0) {
    const content = currentContent.join("\n\n").trim();
    chapters.push({
      order: chapters.length,
      title: `Section ${chapterNum}`,
      level: 1,
      content,
      tokenCount: estimateTokens(content),
    });
  }

  return chapters;
}

/**
 * Split a large chapter into smaller sub-chapters
 */
export function splitLargeChapter(chapter: Chapter): Chapter[] {
  if (chapter.tokenCount <= MAX_CHAPTER_TOKENS) {
    return [chapter];
  }

  const subChapters: Chapter[] = [];
  const paragraphs = chapter.content.split(/\n{2,}/).filter(p => p.trim().length > 0);

  let currentContent: string[] = [];
  let currentTokens = 0;
  let partNum = 1;

  for (const paragraph of paragraphs) {
    const tokens = estimateTokens(paragraph);

    if (currentTokens + tokens > MAX_CHAPTER_TOKENS && currentContent.length > 0) {
      const content = currentContent.join("\n\n").trim();
      subChapters.push({
        order: chapter.order,
        title: `${chapter.title} (Part ${partNum})`,
        level: chapter.level,
        content,
        tokenCount: estimateTokens(content),
      });
      partNum++;
      currentContent = [];
      currentTokens = 0;
    }

    currentContent.push(paragraph);
    currentTokens += tokens;
  }

  // Save last part
  if (currentContent.length > 0) {
    const content = currentContent.join("\n\n").trim();
    subChapters.push({
      order: chapter.order,
      title: partNum > 1 ? `${chapter.title} (Part ${partNum})` : chapter.title,
      level: chapter.level,
      content,
      tokenCount: estimateTokens(content),
    });
  }

  return subChapters;
}

/**
 * Get statistics about the book structure
 */
export function getBookStats(structure: BookStructure): {
  totalChapters: number;
  totalTokens: number;
  avgTokensPerChapter: number;
  hasStructure: boolean;
} {
  const tokenCounts = structure.chapters.map(c => c.tokenCount);
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);

  return {
    totalChapters: structure.chapters.length,
    totalTokens,
    avgTokensPerChapter: Math.round(totalTokens / structure.chapters.length) || 0,
    hasStructure: structure.hasDetectedStructure,
  };
}

// ============================================================================
// TOC-GUIDED CHAPTER EXTRACTION
// ============================================================================

/**
 * Normalize a string for fuzzy matching
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Fuzzy match a TOC title against text content
 * Returns the position and confidence score
 */
function fuzzyMatchTitle(
  text: string,
  tocTitle: string,
  startFrom: number = 0
): { position: number; confidence: number; matchedText: string } | null {
  const normalizedToc = normalizeForMatching(tocTitle);
  const searchText = text.slice(startFrom);
  const searchTextLower = searchText.toLowerCase();

  // Strategy 1: Exact match (after normalization)
  const exactPattern = new RegExp(
    normalizedToc.split(" ").join("\\s+"),
    "i"
  );
  const exactMatch = searchText.match(exactPattern);
  if (exactMatch && exactMatch.index !== undefined) {
    return {
      position: startFrom + exactMatch.index,
      confidence: 1.0,
      matchedText: exactMatch[0],
    };
  }

  // Strategy 2: Match with common chapter prefixes
  const prefixPatterns = [
    `chapter\\s*\\d+[:\\s\\-–—]*${normalizedToc.split(" ").join("\\s+")}`,
    `part\\s*[ivx\\d]+[:\\s\\-–—]*${normalizedToc.split(" ").join("\\s+")}`,
    `\\d+\\.?\\s*${normalizedToc.split(" ").join("\\s+")}`,
  ];

  for (const pattern of prefixPatterns) {
    try {
      const regex = new RegExp(pattern, "i");
      const match = searchText.match(regex);
      if (match && match.index !== undefined) {
        return {
          position: startFrom + match.index,
          confidence: 0.9,
          matchedText: match[0],
        };
      }
    } catch {
      // Invalid regex, skip
    }
  }

  // Strategy 3: Word overlap matching (for partial matches)
  const tocWords = normalizedToc.split(" ").filter((w) => w.length > 3);
  if (tocWords.length >= 2) {
    // Look for lines containing most of the key words
    const lines = searchText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      const lineNormalized = normalizeForMatching(line);

      // Count matching words
      const matchedWords = tocWords.filter((word) => lineLower.includes(word));
      const matchRatio = matchedWords.length / tocWords.length;

      // If most words match and line looks like a heading
      if (matchRatio >= 0.7 && line.length < 150) {
        const lineStart = searchText.indexOf(line);
        if (lineStart !== -1) {
          return {
            position: startFrom + lineStart,
            confidence: 0.6 + matchRatio * 0.2,
            matchedText: line,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Extract chapters using TOC entries as guide
 * Falls back to regex extraction if TOC matching fails
 */
export function extractChaptersWithTOC(
  text: string,
  toc: TOCExtractionResult
): BookStructure {
  if (!toc.has_toc || toc.entries.length === 0) {
    console.log("[TOC] No TOC entries, falling back to regex extraction");
    return extractChapters(text);
  }

  const chapters: Chapter[] = [];
  let lastPosition = 0;
  let failedMatches = 0;

  // Filter to level 1 and 2 entries (parts and chapters, not subsections)
  const chapterEntries = toc.entries.filter((e) => e.level <= 2);

  console.log(`[TOC] Attempting to match ${chapterEntries.length} chapter entries`);

  for (let i = 0; i < chapterEntries.length; i++) {
    const entry = chapterEntries[i];
    const nextEntry = chapterEntries[i + 1];

    // Find this chapter's start position
    const match = fuzzyMatchTitle(text, entry.normalized_title, lastPosition);

    if (!match) {
      console.warn(`[TOC] Could not find chapter: "${entry.title}" (normalized: "${entry.normalized_title}")`);
      failedMatches++;
      continue;
    }

    // Find next chapter's start (or end of text)
    let endPosition = text.length;
    if (nextEntry) {
      const nextMatch = fuzzyMatchTitle(
        text,
        nextEntry.normalized_title,
        match.position + 100
      );
      if (nextMatch) {
        endPosition = nextMatch.position;
      }
    }

    // Extract content between chapter boundaries
    const content = text.slice(match.position, endPosition).trim();

    if (content.length > 100) {
      // Clean up the title - remove chapter prefixes if present
      let cleanTitle = entry.title
        .replace(/^(?:chapter|ch\.?)\s*\d+[:\s\-–—]*/i, "")
        .replace(/^(?:part)\s*[ivx\d]+[:\s\-–—]*/i, "")
        .replace(/^\d+\.?\s*/, "")
        .trim();

      // If cleaning left it empty, use original
      if (!cleanTitle) cleanTitle = entry.title;

      chapters.push({
        order: chapters.length,
        title: cleanTitle,
        level: entry.level,
        content,
        tokenCount: estimateTokens(content),
      });

      console.log(
        `[TOC] Found chapter ${chapters.length}: "${cleanTitle}" (${estimateTokens(content)} tokens, confidence: ${match.confidence.toFixed(2)})`
      );
    }

    lastPosition = match.position + 100;
  }

  // Check if TOC matching was successful
  const matchRate = (chapterEntries.length - failedMatches) / chapterEntries.length;

  if (chapters.length < 3 || matchRate < 0.5) {
    console.log(
      `[TOC] Poor match rate (${(matchRate * 100).toFixed(0)}%), falling back to regex extraction`
    );
    return extractChapters(text);
  }

  console.log(
    `[TOC] Successfully extracted ${chapters.length} chapters (${(matchRate * 100).toFixed(0)}% match rate)`
  );

  // Split any chapters that are too large
  const finalChapters = splitLargeChaptersArray(chapters);

  return {
    chapters: finalChapters,
    hasDetectedStructure: true,
    extractionMethod: "toc",
  };
}

/**
 * Split an array of chapters, handling oversized ones
 */
function splitLargeChaptersArray(chapters: Chapter[]): Chapter[] {
  const result: Chapter[] = [];

  for (const chapter of chapters) {
    if (chapter.tokenCount > MAX_CHAPTER_TOKENS) {
      const split = splitLargeChapter(chapter);
      for (const sc of split) {
        result.push({
          ...sc,
          order: result.length,
        });
      }
    } else {
      result.push({
        ...chapter,
        order: result.length,
      });
    }
  }

  return result;
}
