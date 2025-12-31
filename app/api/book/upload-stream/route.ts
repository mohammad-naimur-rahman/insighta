import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Book, Chapter } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import {
  parsePDFWithPages,
  getFirstPages,
  mergePages,
  countWords,
} from "@/lib/pdf-parser";
import { extractChapters, extractChaptersWithTOC } from "@/lib/chapter-extractor";
import { extractTOC, isTOCReliable } from "@/lib/toc-extractor";
import {
  analyzeContentDensity,
  createAnalysisSample,
} from "@/lib/content-analyzer";

interface UploadProgress {
  step: string;
  progress: number;
  message: string;
}

interface UploadResult {
  success: boolean;
  data?: {
    _id: string;
    title: string;
    author?: string;
    status: string;
    totalPages?: number;
    totalChapters?: number;
    originalWordCount?: number;
    extractionMethod?: string;
    contentDensityScore?: number;
    recommendedCompression?: number;
    createdAt: Date;
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (progress: UploadProgress) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`)
        );
      };

      const sendResult = (result: UploadResult) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "result", ...result })}\n\n`)
        );
        controller.close();
      };

      const sendError = (error: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`)
        );
        controller.close();
      };

      try {
        // Auth check
        sendProgress({ step: "auth", progress: 0, message: "Authenticating..." });
        const user = await getCurrentUser();

        if (!user) {
          sendError("Unauthorized");
          return;
        }

        // Parse form data
        sendProgress({ step: "parsing", progress: 5, message: "Reading file..." });
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const title = formData.get("title") as string | null;
        const author = formData.get("author") as string | null;

        if (!file) {
          sendError("No file provided");
          return;
        }

        if (!title?.trim()) {
          sendError("Title is required");
          return;
        }

        if (file.type !== "application/pdf") {
          sendError("Only PDF files are allowed");
          return;
        }

        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
          sendError("File size must be less than 50MB");
          return;
        }

        await connectDB();

        // Parse PDF
        sendProgress({ step: "pdf", progress: 10, message: "Parsing PDF..." });
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        let parsedPDF;
        try {
          parsedPDF = await parsePDFWithPages(fileBuffer);
        } catch (err) {
          console.error("PDF parsing error:", err);
          sendError("Failed to parse PDF. Make sure it's a valid PDF file.");
          return;
        }

        sendProgress({ step: "pdf", progress: 20, message: "Extracting text..." });
        const fullText = mergePages(parsedPDF.pages);

        if (!fullText || fullText.trim().length < 100) {
          sendError("Could not extract text from PDF. The file may be scanned or image-based.");
          return;
        }

        // Extract TOC
        sendProgress({ step: "toc", progress: 30, message: "Detecting table of contents..." });
        const firstPagesText = getFirstPages(parsedPDF.pages, 15);
        const tocResult = await extractTOC(firstPagesText);

        // Extract chapters
        sendProgress({ step: "chapters", progress: 50, message: "Extracting chapters..." });
        let bookStructure;
        if (isTOCReliable(tocResult)) {
          sendProgress({ step: "chapters", progress: 55, message: `Found ${tocResult.entries.length} TOC entries...` });
          bookStructure = extractChaptersWithTOC(fullText, tocResult);
        } else {
          sendProgress({ step: "chapters", progress: 55, message: "Using pattern-based extraction..." });
          bookStructure = extractChapters(fullText);
        }

        sendProgress({
          step: "chapters",
          progress: 65,
          message: `Found ${bookStructure.chapters.length} chapters`,
        });

        // Analyze content density
        sendProgress({ step: "density", progress: 70, message: "Analyzing content density..." });
        const sampleText = createAnalysisSample(
          bookStructure.chapters.map((c) => ({ content: c.content }))
        );
        const densityResult = await analyzeContentDensity(sampleText);

        sendProgress({
          step: "density",
          progress: 85,
          message: `Density: ${densityResult.density_score}/10, Compression: ${Math.round(densityResult.recommended_compression * 100)}%`,
        });

        // Save to database
        sendProgress({ step: "saving", progress: 90, message: "Saving book..." });
        const wordCount = countWords(fullText);

        const book = await Book.create({
          userId: user.userId,
          title: title.trim(),
          author: author?.trim() || parsedPDF.metadata.author || undefined,
          originalFilename: file.name,
          totalPages: parsedPDF.numPages,
          totalChapters: bookStructure.chapters.length,
          originalWordCount: wordCount,
          status: "uploaded",
          extractionMethod: bookStructure.extractionMethod,
          contentDensityScore: densityResult.density_score,
          recommendedCompression: densityResult.recommended_compression,
          recommendedContextSize: densityResult.recommended_context_size,
        });

        if (bookStructure.chapters.length > 0) {
          const chapterDocs = bookStructure.chapters.map((chapter) => ({
            bookId: book._id,
            order: chapter.order,
            title: chapter.title,
            level: chapter.level,
            originalContent: chapter.content,
            originalTokenCount: chapter.tokenCount,
          }));

          await Chapter.insertMany(chapterDocs);
        }

        sendProgress({ step: "complete", progress: 100, message: "Upload complete!" });

        sendResult({
          success: true,
          data: {
            _id: book._id.toString(),
            title: book.title,
            author: book.author,
            status: book.status,
            totalPages: book.totalPages,
            totalChapters: book.totalChapters,
            originalWordCount: book.originalWordCount,
            extractionMethod: book.extractionMethod,
            contentDensityScore: book.contentDensityScore,
            recommendedCompression: book.recommendedCompression,
            createdAt: book.createdAt,
          },
        });
      } catch (err) {
        console.error("Upload error:", err);
        sendError("Upload failed. Please try again.");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
