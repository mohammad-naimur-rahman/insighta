import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Book, Chunk } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { parsePDF, countWords } from "@/lib/pdf-parser";
import { chunkText } from "@/lib/chunker";

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
        { status: 500 }
      );
    }

    await connectDB();

    // Read file as buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Parse PDF and extract text
    let parsedPDF;
    try {
      parsedPDF = await parsePDF(fileBuffer);
    } catch (err) {
      console.error("PDF parsing error:", err);
      return NextResponse.json(
        { success: false, error: "Failed to parse PDF. Make sure it's a valid PDF file." },
        { status: 400 }
      );
    }

    // Check if we extracted any text
    if (!parsedPDF.text || parsedPDF.text.trim().length < 100) {
      return NextResponse.json(
        { success: false, error: "Could not extract text from PDF. The file may be scanned or image-based." },
        { status: 400 }
      );
    }

    // Create chunks from the extracted text
    const chunks = chunkText(parsedPDF.text);
    const wordCount = countWords(parsedPDF.text);

    // Create book record
    const book = await Book.create({
      userId: user.userId,
      title: title.trim(),
      author: author?.trim() || parsedPDF.metadata.author || undefined,
      originalFilename: file.name,
      totalPages: parsedPDF.numPages,
      totalChunks: chunks.length,
      rawText: parsedPDF.text,
      originalWordCount: wordCount,
      status: "uploaded",
    });

    // Save chunks to database
    if (chunks.length > 0) {
      const chunkDocs = chunks.map((chunk) => ({
        bookId: book._id,
        order: chunk.order,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
      }));

      await Chunk.insertMany(chunkDocs);
    }

    return NextResponse.json({
      success: true,
      data: {
        _id: book._id,
        title: book.title,
        author: book.author,
        status: book.status,
        totalPages: book.totalPages,
        totalChunks: book.totalChunks,
        originalWordCount: book.originalWordCount,
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
