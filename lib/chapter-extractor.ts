import { estimateTokens } from "./pdf-parser";

export interface Chapter {
  order: number;
  title: string;
  level: number; // 1 = chapter, 2 = section, 3 = subsection
  content: string;
  tokenCount: number;
}

export interface BookStructure {
  chapters: Chapter[];
  hasDetectedStructure: boolean;
}

/**
 * Common chapter/section heading patterns in books
 */
const CHAPTER_PATTERNS = [
  // "Chapter 1: Title" or "Chapter 1 - Title" or "Chapter One"
  /^(?:chapter|ch\.?)\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s:.\-–—]*(.*)$/i,
  // "Part 1: Title" or "Part One"
  /^(?:part)\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s:.\-–—]*(.*)$/i,
  // "1. Title" or "1 - Title" at start of line (numbered chapters)
  /^(\d{1,2})[\s.\-–—]+([A-Z][^.!?]*?)$/,
  // "Section 1: Title"
  /^(?:section)\s*(?:\d+)[\s:.\-–—]*(.*)$/i,
];

const SECTION_PATTERNS = [
  // ALL CAPS titles (common in many books)
  /^([A-Z][A-Z\s]{3,50})$/,
  // Title Case lines that are short (likely headings)
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,6})$/,
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
    };
  }

  return {
    chapters,
    hasDetectedStructure,
  };
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

  // Check section patterns (level 2)
  for (const pattern of SECTION_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const title = match[1].trim();
      // Make sure it's not a regular sentence fragment
      if (title.length >= 3 && title.length <= 60) {
        return { title, level: 2 };
      }
    }
  }

  return null;
}

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
