import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const author = formData.get("author") as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: "Title is required" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File size must be less than 50MB" },
        { status: 400 }
      );
    }

    await connectDB();

    // Create book record
    const book = await Book.create({
      userId: user.userId,
      title: title.trim(),
      author: author?.trim() || undefined,
      originalFilename: file.name,
      status: "uploaded",
    });

    // Store the file content in the book record or a separate storage
    // For now, we'll process inline. In production, you'd want to use
    // a file storage service like S3 or Vercel Blob.

    // Read file as array buffer for later processing
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Store file buffer temporarily (in production, use proper storage)
    // For this implementation, we'll process immediately when user triggers processing

    // TODO: In Phase 5, we'll implement proper file storage and processing

    return NextResponse.json({
      success: true,
      data: {
        _id: book._id,
        title: book.title,
        author: book.author,
        status: book.status,
        createdAt: book.createdAt,
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { success: false, error: "Upload failed" },
      { status: 500 }
    );
  }
}
