import { extractText, getDocumentProxy } from "unpdf";

export interface ParsedPDF {
  text: string;
  numPages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
  };
}

export interface ParsedPDFWithPages {
  pages: string[];
  numPages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
  };
}

/**
 * Parse a PDF file and extract its text content
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  // Create a copy of the buffer data to avoid detachment issues
  const uint8Array = new Uint8Array(buffer);

  // Get document proxy for metadata
  const pdf = await getDocumentProxy(new Uint8Array(uint8Array));

  // Extract text from all pages (create another copy for extractText)
  const result = await extractText(new Uint8Array(uint8Array), {
    mergePages: true,
  });

  // Get metadata
  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as Record<string, unknown> | undefined;

  // When mergePages is true, text is a string; otherwise it's an array
  const textContent = Array.isArray(result.text)
    ? result.text.join("\n\n")
    : result.text;

  return {
    text: cleanText(textContent),
    numPages: result.totalPages,
    metadata: {
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
      creator: info?.Creator as string | undefined,
    },
  };
}

/**
 * Clean extracted text by removing common artifacts
 */
function cleanText(text: string): string {
  let cleaned = text;

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, "\n");

  // Remove excessive whitespace while preserving paragraph breaks
  cleaned = cleaned.replace(/[ \t]+/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Remove common header/footer patterns (page numbers, etc.)
  // Pattern: standalone numbers that are likely page numbers
  cleaned = cleaned.replace(/^\s*\d+\s*$/gm, "");

  // Remove lines that are just dashes or underscores (separators)
  cleaned = cleaned.replace(/^[-_=]{3,}$/gm, "");

  // Trim each line
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Estimate token count (rough approximation)
 * Uses the rule of thumb: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Parse a PDF file and extract text per page
 * Used for TOC detection from first N pages
 */
export async function parsePDFWithPages(buffer: Buffer): Promise<ParsedPDFWithPages> {
  const uint8Array = new Uint8Array(buffer);

  // Get document proxy for metadata
  const pdf = await getDocumentProxy(new Uint8Array(uint8Array));

  // Extract text with mergePages: false to get array of page texts
  const result = await extractText(new Uint8Array(uint8Array), {
    mergePages: false,
  });

  // Get metadata
  const metadata = await pdf.getMetadata().catch(() => null);
  const info = metadata?.info as Record<string, unknown> | undefined;

  // Clean each page's text
  const pages = Array.isArray(result.text)
    ? result.text.map((pageText) => cleanText(pageText))
    : [cleanText(result.text)];

  return {
    pages,
    numPages: result.totalPages,
    metadata: {
      title: info?.Title as string | undefined,
      author: info?.Author as string | undefined,
      creator: info?.Creator as string | undefined,
    },
  };
}

/**
 * Get first N pages combined as text for TOC detection
 */
export function getFirstPages(pages: string[], n: number = 15): string {
  return pages.slice(0, n).join("\n\n--- PAGE BREAK ---\n\n");
}

/**
 * Merge all pages into a single text string
 */
export function mergePages(pages: string[]): string {
  return pages.join("\n\n");
}
