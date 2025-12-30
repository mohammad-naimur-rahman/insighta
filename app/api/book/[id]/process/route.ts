import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book } from "@/models";
import { getCurrentUser } from "@/lib/auth";

// This is a placeholder for the processing endpoint
// The actual AI pipeline will be implemented in Phase 6-7

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

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
    if (
      book.status !== "uploaded" &&
      book.status !== "failed"
    ) {
      return NextResponse.json(
        { success: false, error: "Book is already being processed" },
        { status: 400 }
      );
    }

    // Update status to start processing
    book.status = "extracting";
    book.progress = 0;
    book.error = undefined;
    await book.save();

    // TODO: In Phase 6-7, we'll implement the actual AI pipeline
    // For now, this just updates the status
    // The real implementation will:
    // 1. Extract text from PDF
    // 2. Chunk the text
    // 3. Extract claims using LLM
    // 4. Filter and score claims
    // 5. Select examples
    // 6. Cluster ideas
    // 7. Rewrite principles
    // 8. Generate behavior deltas
    // 9. Reconstruct the book
    // 10. Run quality check

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
