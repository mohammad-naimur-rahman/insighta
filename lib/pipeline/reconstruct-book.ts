import { generateResponse } from "@/lib/ai";
import {
  buildFinalReconstructionPrompt,
  type IdeaForReconstruction,
} from "@/lib/prompts/final-reconstruction";
import { Idea, Book, FinalOutput } from "@/models";
import { countWords } from "@/lib/pdf-parser";
import type { Types } from "mongoose";

interface ReconstructBookOptions {
  bookId: Types.ObjectId | string;
  onProgress?: (step: string) => void;
}

export async function reconstructBook({
  bookId,
  onProgress,
}: ReconstructBookOptions): Promise<{
  markdown: string;
  wordCount: number;
  ideaCount: number;
  compressionRatio?: number;
}> {
  // Get book details
  const book = await Book.findById(bookId);
  if (!book) {
    throw new Error("Book not found");
  }

  // Get all ideas for the book
  onProgress?.("Loading ideas");
  const ideas = await Idea.find({ bookId }).sort({ order: 1 });

  if (ideas.length === 0) {
    throw new Error("No ideas found for this book");
  }

  // Prepare ideas for reconstruction
  const ideasForReconstruction: IdeaForReconstruction[] = ideas.map((idea) => ({
    title: idea.title,
    principle: idea.principle || "",
    behaviorDelta: idea.behaviorDelta || "",
    example: idea.examples?.[0]?.text,
  }));

  // Generate final markdown
  onProgress?.("Generating final output");
  const prompt = buildFinalReconstructionPrompt(
    book.title,
    ideasForReconstruction
  );
  const markdown = await generateResponse(prompt, {
    model: "reasoning",
  });

  // Calculate statistics
  const outputWordCount = countWords(markdown);
  const compressionRatio = book.originalWordCount
    ? outputWordCount / book.originalWordCount
    : undefined;

  // Save final output
  onProgress?.("Saving output");

  // Delete any existing output
  await FinalOutput.deleteOne({ bookId });

  // Create new output
  await FinalOutput.create({
    bookId,
    markdown,
    wordCount: outputWordCount,
    ideaCount: ideas.length,
    compressionRatio,
  });

  // Update book status to completed
  await Book.findByIdAndUpdate(bookId, {
    status: "completed",
    progress: 100,
    currentStep: "Completed",
  });

  return {
    markdown,
    wordCount: outputWordCount,
    ideaCount: ideas.length,
    compressionRatio,
  };
}
