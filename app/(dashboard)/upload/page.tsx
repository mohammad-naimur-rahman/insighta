"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/FileUpload";
import { IconLoader, IconArrowRight } from "@tabler/icons-react";

interface UploadProgress {
  step: string;
  progress: number;
  message: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploadProgress(null);

    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a book title");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      if (author.trim()) {
        formData.append("author", author.trim());
      }

      // Use streaming endpoint for real-time progress
      const response = await fetch("/api/book/upload-stream", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read response");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                setUploadProgress({
                  step: data.step,
                  progress: data.progress,
                  message: data.message,
                });
              } else if (data.type === "result" && data.success) {
                router.push(`/book/${data.data._id}`);
                return;
              } else if (data.type === "error" || (data.type === "result" && !data.success)) {
                setError(data.error || "Upload failed");
                setIsUploading(false);
                return;
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    // Auto-fill title from filename if empty
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.pdf$/i, "");
      setTitle(nameWithoutExt);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Upload Book</h1>
        <p className="text-muted-foreground">
          Upload a PDF to extract its core insights.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Book Details</CardTitle>
          <CardDescription>
            Upload a non-fiction book in PDF format. We'll extract the signal
            and remove the noise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File upload */}
            <div className="space-y-2">
              <Label>PDF File</Label>
              <FileUpload
                onFileSelect={handleFileSelect}
                onFileRemove={() => setFile(null)}
                selectedFile={file}
                isUploading={isUploading}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Book Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter the book title"
                disabled={isUploading}
              />
            </div>

            {/* Author */}
            <div className="space-y-2">
              <Label htmlFor="author">Author (optional)</Label>
              <Input
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Enter the author's name"
                disabled={isUploading}
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Upload progress */}
            {isUploading && uploadProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{uploadProgress.message}</span>
                  <span className="font-medium">{uploadProgress.progress}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isUploading || !file}
            >
              {isUploading ? (
                <>
                  <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress?.message || "Processing..."}
                </>
              ) : (
                <>
                  Upload & Process
                  <IconArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Info box */}
      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">What happens next?</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>1. We extract text from your PDF</li>
          <li>2. The text is split into intelligent chunks</li>
          <li>3. AI extracts claims and filters noise</li>
          <li>4. Similar ideas are clustered together</li>
          <li>5. The book is reconstructed around key insights</li>
        </ul>
      </div>
    </div>
  );
}
