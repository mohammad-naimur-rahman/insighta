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

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

      const response = await fetch("/api/book/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/book/${data.data._id}`);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
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

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isUploading || !file}
            >
              {isUploading ? (
                <>
                  <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
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
