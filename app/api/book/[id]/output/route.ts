import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book, FinalOutput } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
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

    // Verify book belongs to user
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

    // Get the final output
    const output = await FinalOutput.findOne({
      bookId: id,
    }).select("-__v");

    if (!output) {
      return NextResponse.json(
        { success: false, error: "Output not available yet" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        markdown: output.markdown,
        wordCount: output.wordCount,
        ideaCount: output.ideaCount,
        compressionRatio: output.compressionRatio,
        createdAt: output.createdAt,
      },
    });
  } catch (err) {
    console.error("Get output error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch output" },
      { status: 500 }
    );
  }
}
