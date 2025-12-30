import { PDFParse } from "pdf-parse";

export interface ParsedPDF {
  text: string;
  numPages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
  };
}

export interface PageText {
  pageNumber: number;
  text: string;
}

/**
 * Parse a PDF file and extract its text content
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  // Convert Buffer to Uint8Array for pdf-parse
  const data = new Uint8Array(buffer);

  const parser = new PDFParse({ data });

  // Get text from all pages
  const textResult = await parser.getText();
  const fullText = textResult.pages.map((page) => page.text).join("\n\n");

  // Get metadata
  const info = await parser.getInfo();

  // Access info dictionary for metadata
  const infoDict = info.info as Record<string, unknown> | undefined;

  return {
    text: cleanText(fullText),
    numPages: textResult.pages.length,
    metadata: {
      title: infoDict?.Title as string | undefined,
      author: infoDict?.Author as string | undefined,
      creator: infoDict?.Creator as string | undefined,
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
