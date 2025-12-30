import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import {
  compressChapters,
  assembleBook,
} from "@/lib/pipeline/compress-chapters";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    // Verify book belongs to user and is in correct state
    const book = await Book.findOne({
      _id: id,
      userId: user.userId,
    });

    if (!book) {
      return NextResponse.json(
        { success: false, error: "Book not found" },
        { status: 404 }
      );
    }

    // Check if already processing or completed
    if (book.status !== "uploaded" && book.status !== "failed") {
      return NextResponse.json(
        { success: false, error: "Book is already being processed" },
        { status: 400 }
      );
    }

    // Start processing in background (non-blocking response)
    // The client will poll for status updates
    processBookInBackground(id).catch((error) => {
      console.error("Background processing error:", error);
    });

    // Update status to start processing
    book.status = "compressing_chapters";
    book.progress = 0;
    book.error = undefined;
    book.processingStartedAt = new Date();
    book.processingCompletedAt = undefined;
    await book.save();

    return NextResponse.json({
      success: true,
      data: {
        _id: book._id,
        status: book.status,
        message: "Processing started",
      },
    });
  } catch (err) {
    console.error("Process book error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to start processing" },
      { status: 500 }
    );
  }
}

/**
 * Process book in background
 * This runs the chapter-based compression pipeline
 */
async function processBookInBackground(bookId: string): Promise<void> {
  try {
    await connectDB();

    // Step 1: Compress chapters (70% progress)
    await updateBookStatus(bookId, "compressing_chapters", 5);
    await compressChapters({
      bookId,
      onProgress: async (step, current, total) => {
        const progress = 5 + Math.round((current / total) * 65);
        await updateBookProgress(bookId, progress);
      },
    });

    // Step 2: Assemble final book (100% progress)
    await updateBookStatus(bookId, "assembling", 75);
    await assembleBook({
      bookId,
      onProgress: async (step, current, total) => {
        const progress = 75 + Math.round((current / total) * 20);
        await updateBookProgress(bookId, progress);
      },
    });

    // Done!
    await Book.findByIdAndUpdate(bookId, {
      status: "completed",
      progress: 100,
      currentStep: "completed",
      processingCompletedAt: new Date(),
    });
  } catch (error) {
    console.error("Pipeline error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Processing failed";
    await Book.findByIdAndUpdate(bookId, {
      status: "failed",
      error: errorMessage,
      processingCompletedAt: new Date(),
    });
  }
}

async function updateBookStatus(
  bookId: string,
  status: string,
  progress: number
): Promise<void> {
  await Book.findByIdAndUpdate(bookId, {
    status,
    progress,
    currentStep: status.replace(/_/g, " "),
  });
}

async function updateBookProgress(
  bookId: string,
  progress: number
): Promise<void> {
  await Book.findByIdAndUpdate(bookId, { progress });
}
