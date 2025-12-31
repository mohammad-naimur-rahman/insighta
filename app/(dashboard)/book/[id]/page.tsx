"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { ProcessingTimer } from "@/components/ProcessingTimer";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { DeleteBookDialog } from "@/components/DeleteBookDialog";
import type { BookStatus } from "@/types";
import {
  IconLoader,
  IconArrowLeft,
  IconPlayerPlay,
  IconDownload,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";

interface BookData {
  _id: string;
  title: string;
  author?: string;
  status: BookStatus;
  progress?: number;
  currentStep?: string;
  error?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  createdAt: string;
}

interface OutputData {
  markdown: string;
  wordCount: number;
  ideaCount: number;
  compressionRatio?: number;
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<BookData | null>(null);
  const [output, setOutput] = useState<OutputData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we should be polling
  const isPollingRef = useRef(false);

  // Fetch output
  const fetchOutput = useCallback(async () => {
    try {
      const response = await fetch(`/api/book/${bookId}/output`);
      const data = await response.json();

      if (data.success) {
        setOutput(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch output:", err);
    }
  }, [bookId]);

  // Fetch book data
  const fetchBook = useCallback(async () => {
    try {
      const response = await fetch(`/api/book/${bookId}`);
      const data = await response.json();

      if (data.success) {
        setBook(data.data);

        // Check if we should continue polling
        const status = data.data.status;
        isPollingRef.current =
          status !== "uploaded" &&
          status !== "completed" &&
          status !== "failed";

        // Fetch output if completed
        if (status === "completed") {
          fetchOutput();
        }
      } else {
        setError(data.error || "Failed to fetch book");
        isPollingRef.current = false;
      }
    } catch {
      setError("Failed to fetch book");
      isPollingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [bookId, fetchOutput]);

  // Start processing
  const startProcessing = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/book/${bookId}/process`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        // Enable polling to track progress
        isPollingRef.current = true;
        // Fetch immediately to get updated status
        fetchBook();
      } else {
        setError(data.error || "Processing failed");
      }
    } catch {
      setError("Failed to start processing");
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (output?.markdown) {
      await navigator.clipboard.writeText(output.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download markdown
  const downloadMarkdown = () => {
    if (output?.markdown && book) {
      const blob = new Blob([output.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${book.title.replace(/[^a-z0-9]/gi, "_")}_distilled.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    fetchBook();

    // Poll every 3 seconds if processing
    const interval = setInterval(() => {
      if (isPollingRef.current) {
        fetchBook();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [bookId, fetchBook]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <IconLoader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => router.push("/dashboard")}>
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!book) return null;

  const isProcessingStatus =
    book.status !== "uploaded" &&
    book.status !== "completed" &&
    book.status !== "failed";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/dashboard")}
      >
        <IconArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      {/* Book header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{book.title}</h1>
          {book.author && (
            <p className="text-muted-foreground">by {book.author}</p>
          )}
        </div>
        <DeleteBookDialog bookId={bookId} bookTitle={book.title} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Show output if completed */}
          {book.status === "completed" && output && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Distilled Output</CardTitle>
                    <CardDescription>
                      {output.ideaCount} ideas • {output.wordCount} words
                      {output.compressionRatio &&
                        ` • ${Math.round(output.compressionRatio * 100)}% of original`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                    >
                      {copied ? (
                        <IconCheck className="h-4 w-4" />
                      ) : (
                        <IconCopy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadMarkdown}
                    >
                      <IconDownload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <MarkdownRenderer content={output.markdown} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show start button if just uploaded */}
          {book.status === "uploaded" && (
            <Card>
              <CardHeader>
                <CardTitle>Ready to Process</CardTitle>
                <CardDescription>
                  Start the AI pipeline to extract insights from this book.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={startProcessing}
                  disabled={isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <IconPlayerPlay className="mr-2 h-4 w-4" />
                      Start Processing
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {book.status === "failed" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">
                  Processing Failed
                </CardTitle>
                <CardDescription>
                  {book.error || "An error occurred during processing."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={startProcessing} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <IconPlayerPlay className="mr-2 h-4 w-4" />
                      Retry Processing
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Processing status */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Processing Status</CardTitle>
                <ProcessingTimer
                  startedAt={book.processingStartedAt}
                  completedAt={book.processingCompletedAt}
                  isProcessing={isProcessingStatus}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ProcessingStatus
                currentStatus={book.status}
                progress={book.progress}
                currentStep={book.currentStep}
                error={book.error}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
