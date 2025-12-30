import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book, Chunk, Claim, Idea, FinalOutput } from "@/models";
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

    const book = await Book.findOne({
      _id: id,
      userId: user.userId,
    }).select("-__v");

    if (!book) {
      return NextResponse.json(
        { success: false, error: "Book not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: book,
    });
  } catch (err) {
    console.error("Get book error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch book" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const book = await Book.findOneAndDelete({
      _id: id,
      userId: user.userId,
    });

    if (!book) {
      return NextResponse.json(
        { success: false, error: "Book not found" },
        { status: 404 }
      );
    }

    // Delete all related data
    await Promise.all([
      Chunk.deleteMany({ bookId: id }),
      Claim.deleteMany({ bookId: id }),
      Idea.deleteMany({ bookId: id }),
      FinalOutput.deleteMany({ bookId: id }),
    ]);

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (err) {
    console.error("Delete book error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete book" },
      { status: 500 }
    );
  }
}
