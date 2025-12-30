import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import {
  extractClaims,
  filterClaims,
  getFilteredClaims,
  clusterIdeas,
  reconstructBook,
} from "@/lib/pipeline";

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
    book.status = "extracting_claims";
    book.progress = 0;
    book.error = undefined;
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
 * This runs the full AI pipeline
 */
async function processBookInBackground(bookId: string): Promise<void> {
  try {
    await connectDB();

    // Step 1: Extract claims (20% progress)
    await updateBookStatus(bookId, "extracting_claims", 5);
    await extractClaims({
      bookId,
      onProgress: async (current, total) => {
        const progress = 5 + Math.round((current / total) * 15);
        await updateBookProgress(bookId, progress);
      },
    });

    // Step 2: Filter claims (40% progress)
    await updateBookStatus(bookId, "filtering_claims", 20);
    await filterClaims({
      bookId,
      onProgress: async (current, total) => {
        const progress = 20 + Math.round((current / total) * 20);
        await updateBookProgress(bookId, progress);
      },
    });

    // Step 3: Get filtered claims for clustering
    const filteredClaims = await getFilteredClaims(bookId);

    if (filteredClaims.length === 0) {
      throw new Error(
        "No valuable claims found in this book. The content may be too generic or already well-known."
      );
    }

    // Step 4: Cluster ideas (70% progress)
    await updateBookStatus(bookId, "clustering_ideas", 40);
    await clusterIdeas({
      bookId,
      filteredClaims,
      onProgress: async (step, current, total) => {
        const progress = 40 + Math.round((current / total) * 30);
        await updateBookProgress(bookId, progress);
      },
    });

    // Step 5: Reconstruct book (100% progress)
    await updateBookStatus(bookId, "reconstructing", 70);
    await reconstructBook({
      bookId,
      onProgress: async (step) => {
        if (step === "Generating final output") {
          await updateBookProgress(bookId, 85);
        } else if (step === "Saving output") {
          await updateBookProgress(bookId, 95);
        }
      },
    });

    // Done!
    await updateBookStatus(bookId, "completed", 100);
  } catch (error) {
    console.error("Pipeline error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Processing failed";
    await Book.findByIdAndUpdate(bookId, {
      status: "failed",
      error: errorMessage,
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
