import { generateStructured, generateResponse } from "@/lib/ai";
import {
  ChapterCompressionSchema,
  buildChapterCompressionPrompt,
  buildBookAssemblyPrompt,
} from "@/lib/prompts/chapter-compression";
import { Book, Chapter, FinalOutput } from "@/models";
import { parallelMap } from "@/lib/parallel";
import { estimateTokens } from "@/lib/pdf-parser";
import type { Types } from "mongoose";
import type { IChapter } from "@/types";

// Concurrency for parallel chapter compression
const CONCURRENCY = 3;

interface CompressChaptersOptions {
  bookId: Types.ObjectId | string;
  onProgress?: (step: string, current: number, total: number) => void;
}

interface CompressResult {
  chaptersCompressed: number;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
}

/**
 * Compress all chapters in parallel while preserving author's voice
 */
export async function compressChapters({
  bookId,
  onProgress,
}: CompressChaptersOptions): Promise<CompressResult> {
  // Get book info
  const book = await Book.findById(bookId);
  if (!book) {
    throw new Error("Book not found");
  }

  // Get all chapters for this book
  const chapters = await Chapter.find({ bookId }).sort({ order: 1 });

  if (chapters.length === 0) {
    throw new Error("No chapters found for this book");
  }

  console.log(`[Compress] Starting compression of ${chapters.length} chapters`);
  const startTime = Date.now();

  // Compress chapters in parallel
  const results = await parallelMap<IChapter, { compressed: string; insights: string[]; tokens: number } | null>(
    chapters,
    async (chapter, index) => {
      try {
        onProgress?.("Compressing chapters", index + 1, chapters.length);

        const prompt = buildChapterCompressionPrompt(
          chapter.title,
          chapter.originalContent,
          book.title,
          index === 0
        );

        const result = await generateStructured(ChapterCompressionSchema, prompt, {
          model: "reasoning",
        });

        const compressedTokens = estimateTokens(result.compressed_content);

        // Update chapter in database
        await Chapter.findByIdAndUpdate(chapter._id, {
          $set: {
            compressedContent: result.compressed_content,
            keyInsights: result.key_insights,
            compressedTokenCount: compressedTokens,
          },
        });

        return {
          compressed: result.compressed_content,
          insights: result.key_insights,
          tokens: compressedTokens,
        };
      } catch (error) {
        console.error(`[Compress] Error compressing chapter ${index}:`, error);
        return null;
      }
    },
    {
      concurrency: CONCURRENCY,
      onProgress: (completed, total) => {
        onProgress?.("Compressing chapters", completed, total);
      },
    }
  );

  // Calculate statistics
  type SuccessResult = { compressed: string; insights: string[]; tokens: number };
  const successfulResults = results.filter((r): r is SuccessResult => r !== null && !(r instanceof Error));
  const originalTokens = chapters.reduce((sum, ch) => sum + ch.originalTokenCount, 0);
  const compressedTokens = successfulResults.reduce((sum, r) => sum + r.tokens, 0);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Compress] Completed: ${successfulResults.length}/${chapters.length} chapters in ${elapsed}s`);
  console.log(`[Compress] Compression: ${originalTokens} -> ${compressedTokens} tokens (${((compressedTokens / originalTokens) * 100).toFixed(1)}%)`);

  // Update book status
  await Book.findByIdAndUpdate(bookId, {
    $set: {
      status: "assembling",
      currentStep: "Chapters compressed",
    },
  });

  return {
    chaptersCompressed: successfulResults.length,
    originalTokens,
    compressedTokens,
    compressionRatio: compressedTokens / originalTokens,
  };
}

/**
 * Assemble compressed chapters into final markdown output
 */
export async function assembleBook({
  bookId,
  onProgress,
}: CompressChaptersOptions): Promise<{ wordCount: number; markdown: string }> {
  const book = await Book.findById(bookId);
  if (!book) {
    throw new Error("Book not found");
  }

  // Get all compressed chapters
  const chapters = await Chapter.find({
    bookId,
    compressedContent: { $exists: true, $ne: "" }
  }).sort({ order: 1 });

  if (chapters.length === 0) {
    throw new Error("No compressed chapters found");
  }

  console.log(`[Assemble] Assembling ${chapters.length} chapters`);
  onProgress?.("Assembling book", 1, 2);

  // Build the final markdown document
  const compressedChapters = chapters.map(ch => ({
    title: ch.title,
    content: ch.compressedContent || "",
    insights: ch.keyInsights || [],
  }));

  // Generate overview and key takeaways using AI
  const prompt = buildBookAssemblyPrompt(book.title, book.author, compressedChapters);

  const markdown = await generateResponse(prompt, {
    model: "reasoning",
    system: "You are a book editor creating a cohesive, readable condensed version of a book. Maintain the author's voice and style throughout.",
  });

  onProgress?.("Assembling book", 2, 2);

  // Calculate word count
  const wordCount = markdown.split(/\s+/).length;

  // Save final output
  await FinalOutput.findOneAndUpdate(
    { bookId },
    {
      $set: {
        bookId,
        markdown,
        wordCount,
        ideaCount: chapters.length,
        compressionRatio: wordCount / (book.originalWordCount || wordCount),
      },
    },
    { upsert: true, new: true }
  );

  // Update book status
  await Book.findByIdAndUpdate(bookId, {
    $set: {
      status: "completed",
      currentStep: "Complete",
      progress: 100,
    },
  });

  console.log(`[Assemble] Complete: ${wordCount} words`);

  return { wordCount, markdown };
}

/**
 * Run the complete chapter compression pipeline
 */
export async function runChapterCompressionPipeline({
  bookId,
  onProgress,
}: CompressChaptersOptions): Promise<void> {
  try {
    // Step 1: Compress chapters
    await Book.findByIdAndUpdate(bookId, {
      $set: { status: "compressing_chapters", progress: 30 },
    });

    const compressResult = await compressChapters({ bookId, onProgress });
    console.log(`[Pipeline] Compressed ${compressResult.chaptersCompressed} chapters`);

    // Step 2: Assemble final output
    await Book.findByIdAndUpdate(bookId, {
      $set: { status: "assembling", progress: 80 },
    });

    const assembleResult = await assembleBook({ bookId, onProgress });
    console.log(`[Pipeline] Final output: ${assembleResult.wordCount} words`);

  } catch (error) {
    console.error("[Pipeline] Error:", error);
    await Book.findByIdAndUpdate(bookId, {
      $set: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
