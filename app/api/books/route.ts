import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    const books = await Book.find({ userId: user.userId })
      .sort({ createdAt: -1 })
      .select("-__v")
      .lean();

    return NextResponse.json({
      success: true,
      data: books,
    });
  } catch (err) {
    console.error("Get books error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch books" },
      { status: 500 }
    );
  }
}
