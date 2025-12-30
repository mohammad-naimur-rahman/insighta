"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/EmptyState";
import { IconPlus, IconLoader } from "@tabler/icons-react";
import type { IBook } from "@/types";

interface BookWithId extends Omit<IBook, "_id" | "userId"> {
  _id: string;
}

export default function DashboardPage() {
  const [books, setBooks] = useState<BookWithId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const response = await fetch("/api/books");
        const data = await response.json();

        if (data.success) {
          setBooks(data.data);
        } else {
          setError(data.error || "Failed to fetch books");
        }
      } catch {
        setError("Failed to fetch books");
      } finally {
        setIsLoading(false);
      }
    }

    fetchBooks();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <IconLoader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Your Books</h1>
          <p className="text-muted-foreground">
            {books.length} book{books.length !== 1 ? "s" : ""} in your library
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <IconPlus className="mr-2 h-4 w-4" />
            Upload Book
          </Link>
        </Button>
      </div>

      {/* Books grid or empty state */}
      {books.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book._id}
              id={book._id}
              title={book.title}
              author={book.author}
              status={book.status}
              progress={book.progress}
              createdAt={book.createdAt.toString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
