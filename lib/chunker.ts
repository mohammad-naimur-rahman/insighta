import { estimateTokens } from "./pdf-parser";

export interface Chunk {
  order: number;
  text: string;
  tokenCount: number;
}

export interface ChunkerOptions {
  minTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
}

const DEFAULT_OPTIONS: Required<ChunkerOptions> = {
  minTokens: 800,
  maxTokens: 1500,
  overlapTokens: 100,
};

/**
 * Split text into intelligent chunks that respect paragraph boundaries
 * Target: 800-1500 tokens per chunk, no mid-paragraph splits
 */
export function chunkText(text: string, options?: ChunkerOptions): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: Chunk[] = [];

  // Split into paragraphs (double newline or more)
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  let currentChunk: string[] = [];
  let currentTokenCount = 0;
  let chunkOrder = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    // If a single paragraph exceeds max tokens, split it by sentences
    if (paragraphTokens > opts.maxTokens) {
      // First, save any accumulated content
      if (currentChunk.length > 0) {
        chunks.push({
          order: chunkOrder++,
          text: currentChunk.join("\n\n"),
          tokenCount: currentTokenCount,
        });
        currentChunk = [];
        currentTokenCount = 0;
      }

      // Split large paragraph by sentences
      const sentences = splitIntoSentences(paragraph);
      let sentenceChunk: string[] = [];
      let sentenceTokenCount = 0;

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);

        if (sentenceTokenCount + sentenceTokens > opts.maxTokens && sentenceChunk.length > 0) {
          chunks.push({
            order: chunkOrder++,
            text: sentenceChunk.join(" "),
            tokenCount: sentenceTokenCount,
          });
          sentenceChunk = [];
          sentenceTokenCount = 0;
        }

        sentenceChunk.push(sentence);
        sentenceTokenCount += sentenceTokens;
      }

      // Add remaining sentences
      if (sentenceChunk.length > 0) {
        currentChunk = [sentenceChunk.join(" ")];
        currentTokenCount = sentenceTokenCount;
      }

      continue;
    }

    // Check if adding this paragraph would exceed max tokens
    if (currentTokenCount + paragraphTokens > opts.maxTokens && currentChunk.length > 0) {
      // Save current chunk if it meets minimum size
      if (currentTokenCount >= opts.minTokens) {
        chunks.push({
          order: chunkOrder++,
          text: currentChunk.join("\n\n"),
          tokenCount: currentTokenCount,
        });
        currentChunk = [];
        currentTokenCount = 0;
      }
    }

    // Add paragraph to current chunk
    currentChunk.push(paragraph);
    currentTokenCount += paragraphTokens;

    // If we've reached a good size, consider saving
    if (currentTokenCount >= opts.minTokens && currentTokenCount <= opts.maxTokens) {
      // Check if this is a natural break point (end of section, etc.)
      if (isNaturalBreakPoint(paragraph)) {
        chunks.push({
          order: chunkOrder++,
          text: currentChunk.join("\n\n"),
          tokenCount: currentTokenCount,
        });
        currentChunk = [];
        currentTokenCount = 0;
      }
    }
  }

  // Add any remaining content
  if (currentChunk.length > 0) {
    // If the last chunk is too small, merge with previous if possible
    if (currentTokenCount < opts.minTokens && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk.tokenCount + currentTokenCount <= opts.maxTokens * 1.2) {
        // Allow slight overflow for final chunk
        chunks[chunks.length - 1] = {
          order: lastChunk.order,
          text: lastChunk.text + "\n\n" + currentChunk.join("\n\n"),
          tokenCount: lastChunk.tokenCount + currentTokenCount,
        };
      } else {
        chunks.push({
          order: chunkOrder++,
          text: currentChunk.join("\n\n"),
          tokenCount: currentTokenCount,
        });
      }
    } else {
      chunks.push({
        order: chunkOrder++,
        text: currentChunk.join("\n\n"),
        tokenCount: currentTokenCount,
      });
    }
  }

  return chunks;
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space and capital letter
  // This is a simple heuristic that works for most English text
  const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])/g;
  return text.split(sentenceRegex).filter((s) => s.trim().length > 0);
}

/**
 * Check if a paragraph represents a natural break point
 * (e.g., end of section, conclusion of an idea)
 */
function isNaturalBreakPoint(paragraph: string): boolean {
  const text = paragraph.toLowerCase();

  // Check for section-ending patterns
  const endingPatterns = [
    /in conclusion/i,
    /to summarize/i,
    /in summary/i,
    /the key takeaway/i,
    /the main point/i,
    /this brings us to/i,
    /moving on/i,
    /next,? we/i,
    /let's now/i,
    /having established/i,
  ];

  for (const pattern of endingPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Check if paragraph ends with a concluding phrase
  if (text.endsWith(".") && text.length < 200) {
    // Short paragraphs that end sentences are often transitional
    return true;
  }

  return false;
}

/**
 * Get statistics about the chunks
 */
export function getChunkStats(chunks: Chunk[]): {
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalTokens: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
    };
  }

  const tokenCounts = chunks.map((c) => c.tokenCount);
  const totalTokens = tokenCounts.reduce((a, b) => a + b, 0);

  return {
    totalChunks: chunks.length,
    totalTokens,
    avgTokensPerChunk: Math.round(totalTokens / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
  };
}
